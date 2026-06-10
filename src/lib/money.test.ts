import { describe, expect, it } from "vitest";
import {
  MoneyError,
  computeLineSplit,
  computeOrderSplit,
  formatCents,
  platformFeeCents,
  priceForTargetMargin,
} from "./money";

describe("platformFeeCents", () => {
  it("computes 75 bps with half-up rounding", () => {
    expect(platformFeeCents(10_000)).toBe(75); // $100.00 → $0.75
    expect(platformFeeCents(100)).toBe(1); // $1.00 → 0.75¢ rounds to 1¢
    expect(platformFeeCents(66)).toBe(0); // 0.495¢ rounds to 0¢
    expect(platformFeeCents(67)).toBe(1); // 0.5025¢ rounds to 1¢
    expect(platformFeeCents(0)).toBe(0);
  });

  it("rounds exactly-half cases up", () => {
    // 2000¢ × 0.0075 = 15¢ exactly; 2_000_00¢... pick a true .5 case:
    // amount × 75 / 10000 ends in .5 when amount × 75 ≡ 5000 (mod 10000)
    expect(platformFeeCents(200)).toBe(2); // 1.5¢ → 2¢
    expect(platformFeeCents(600)).toBe(5); // 4.5¢ → 5¢
  });

  it("rejects floats and negatives", () => {
    expect(() => platformFeeCents(10.5)).toThrow(MoneyError);
    expect(() => platformFeeCents(-1)).toThrow(MoneyError);
  });
});

describe("computeLineSplit", () => {
  it("splits a simple line exactly", () => {
    // 2 × $40.00 patient price, $25.00 COGS each
    const split = computeLineSplit({
      unitPriceCents: 4000,
      unitCogsCents: 2500,
      quantity: 2,
    });
    expect(split.totalCents).toBe(8000);
    expect(split.cogsCents).toBe(5000);
    expect(split.feeCents).toBe(60); // 8000 × 0.0075
    expect(split.marginCents).toBe(2940);
    expect(split.cogsCents + split.marginCents + split.feeCents).toBe(split.totalCents);
  });

  it("margin absorbs the rounding residual (exact-sum invariant)", () => {
    const split = computeLineSplit({
      unitPriceCents: 3333,
      unitCogsCents: 1999,
      quantity: 3,
    });
    expect(split.cogsCents + split.marginCents + split.feeCents).toBe(split.totalCents);
  });

  it("rejects a price that cannot cover COGS + fee", () => {
    expect(() =>
      computeLineSplit({ unitPriceCents: 2000, unitCogsCents: 2500, quantity: 1 }),
    ).toThrow(/negative margin/);
  });

  it("allows an exactly break-even line (zero margin)", () => {
    // price 10000, cogs 9925, fee 75 → margin 0
    const split = computeLineSplit({
      unitPriceCents: 10_000,
      unitCogsCents: 9925,
      quantity: 1,
    });
    expect(split.marginCents).toBe(0);
  });

  it("rejects zero or negative quantity", () => {
    expect(() =>
      computeLineSplit({ unitPriceCents: 1000, unitCogsCents: 500, quantity: 0 }),
    ).toThrow(MoneyError);
    expect(() =>
      computeLineSplit({ unitPriceCents: 1000, unitCogsCents: 500, quantity: -1 }),
    ).toThrow(MoneyError);
  });
});

describe("computeOrderSplit", () => {
  it("rolls line splits up to order totals", () => {
    const order = computeOrderSplit([
      { unitPriceCents: 4000, unitCogsCents: 2500, quantity: 2 },
      { unitPriceCents: 1995, unitCogsCents: 1200, quantity: 1 },
      { unitPriceCents: 6450, unitCogsCents: 4100, quantity: 3 },
    ]);
    expect(order.totalCents).toBe(8000 + 1995 + 19_350);
    expect(order.cogsCents + order.marginCents + order.feeCents).toBe(order.totalCents);
    expect(order.feeCents).toBe(
      order.lines.reduce((s, l) => s + l.feeCents, 0),
    );
  });

  it("rejects an empty order", () => {
    expect(() => computeOrderSplit([])).toThrow(MoneyError);
  });

  it("property: exact-sum invariant holds across 10k random orders", () => {
    let seed = 42;
    const rand = (max: number) => {
      // deterministic LCG so failures are reproducible
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % max;
    };
    for (let i = 0; i < 10_000; i++) {
      const lineCount = 1 + rand(4);
      const inputs = Array.from({ length: lineCount }, () => {
        const unitCogsCents = rand(20_000);
        // minimum valid price is COGS / (1 − fee rate); +1 covers half-up fee rounding
        const minPriceCents = Math.ceil((unitCogsCents * 10_000) / 9925) + 1;
        const unitPriceCents = minPriceCents + rand(30_000);
        return { unitPriceCents, unitCogsCents, quantity: 1 + rand(5) };
      });
      const order = computeOrderSplit(inputs);
      expect(order.cogsCents + order.marginCents + order.feeCents).toBe(order.totalCents);
      for (const line of order.lines) {
        expect(line.cogsCents + line.marginCents + line.feeCents).toBe(line.totalCents);
      }
    }
  });
});

describe("priceForTargetMargin (gross-up path)", () => {
  it("realized margin always meets or exceeds the target by at most a cent", () => {
    for (const cogs of [0, 1, 999, 2500, 9925, 123_456]) {
      for (const target of [0, 1, 50, 1000, 2940, 99_999]) {
        const { unitPriceCents, realizedMarginCents } = priceForTargetMargin(cogs, target);
        expect(realizedMarginCents).toBeGreaterThanOrEqual(target);
        expect(realizedMarginCents - target).toBeLessThanOrEqual(1);
        // and the resulting line still satisfies the invariant
        const split = computeLineSplit({
          unitPriceCents,
          unitCogsCents: cogs,
          quantity: 1,
        });
        expect(split.marginCents).toBe(realizedMarginCents);
      }
    }
  });

  it("grosses up so the fee comes out of the patient price, not the margin", () => {
    // COGS $25.00, target margin $14.00 → price must exceed $39.00
    const { unitPriceCents } = priceForTargetMargin(2500, 1400);
    expect(unitPriceCents).toBeGreaterThan(3900);
  });
});

describe("formatCents", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(123_456)).toBe("$1,234.56");
    expect(formatCents(-75)).toBe("-$0.75");
  });
});
