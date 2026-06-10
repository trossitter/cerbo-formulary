/**
 * Money-split core. All amounts are integer cents — floats never touch money.
 *
 * Composition model (per order line, rolled up to the order):
 *   fee    = round(0.0075 × lineTotal)         — 75 bps on the patient-facing total
 *   margin = lineTotal − COGS − fee            — margin is the residual
 *
 * Because margin absorbs the rounding residual, the invariant
 *   COGS + margin + fee === amountPaid
 * holds exactly, by construction, for every line and for the order.
 */

export const PLATFORM_FEE_BPS = 75;
const BPS_DENOMINATOR = 10_000;

export interface LineInput {
  /** Patient-facing price per unit, in cents (snapshotted at order time). */
  unitPriceCents: number;
  /** Wholesale cost (COGS) per unit, in cents (snapshotted at order time). */
  unitCogsCents: number;
  quantity: number;
}

export interface LineSplit {
  totalCents: number;
  cogsCents: number;
  feeCents: number;
  marginCents: number;
}

export interface OrderSplit {
  lines: LineSplit[];
  totalCents: number;
  cogsCents: number;
  feeCents: number;
  marginCents: number;
}

function assertIntCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of cents, got ${value}`);
  }
}

export class MoneyError extends Error {}

/** Round-half-up integer division: round(numerator / denominator). */
function roundHalfUpDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator / 2) / denominator);
}

/** 75 bps of `amountCents`, rounded half-up, in integer math. */
export function platformFeeCents(amountCents: number): number {
  assertIntCents(amountCents, "amountCents");
  if (amountCents < 0) throw new MoneyError("fee base cannot be negative");
  return roundHalfUpDiv(amountCents * PLATFORM_FEE_BPS, BPS_DENOMINATOR);
}

/**
 * Split a single order line. Throws if the resulting margin is negative —
 * an order that loses money per line is a provider input error, caught
 * before the order can be created.
 */
export function computeLineSplit(input: LineInput): LineSplit {
  const { unitPriceCents, unitCogsCents, quantity } = input;
  assertIntCents(unitPriceCents, "unitPriceCents");
  assertIntCents(unitCogsCents, "unitCogsCents");
  assertIntCents(quantity, "quantity");
  if (quantity <= 0) throw new MoneyError("quantity must be positive");
  if (unitPriceCents < 0) throw new MoneyError("price cannot be negative");
  if (unitCogsCents < 0) throw new MoneyError("COGS cannot be negative");

  const totalCents = unitPriceCents * quantity;
  const cogsCents = unitCogsCents * quantity;
  const feeCents = platformFeeCents(totalCents);
  const marginCents = totalCents - cogsCents - feeCents;

  if (marginCents < 0) {
    throw new MoneyError(
      `negative margin: price ${totalCents}¢ does not cover COGS ${cogsCents}¢ + fee ${feeCents}¢`,
    );
  }

  return { totalCents, cogsCents, feeCents, marginCents };
}

/** Split every line and roll up. Order totals are sums of line splits. */
export function computeOrderSplit(inputs: LineInput[]): OrderSplit {
  if (inputs.length === 0) throw new MoneyError("order must have at least one line");
  const lines = inputs.map(computeLineSplit);
  const order: OrderSplit = {
    lines,
    totalCents: lines.reduce((s, l) => s + l.totalCents, 0),
    cogsCents: lines.reduce((s, l) => s + l.cogsCents, 0),
    feeCents: lines.reduce((s, l) => s + l.feeCents, 0),
    marginCents: lines.reduce((s, l) => s + l.marginCents, 0),
  };
  assertExactSum(order);
  return order;
}

/** The audit invariant: every cent of the total is accounted for, exactly. */
export function assertExactSum(split: OrderSplit): void {
  for (const line of split.lines) {
    if (line.cogsCents + line.marginCents + line.feeCents !== line.totalCents) {
      throw new MoneyError("line split does not sum to line total");
    }
  }
  if (split.cogsCents + split.marginCents + split.feeCents !== split.totalCents) {
    throw new MoneyError("order split does not sum to order total");
  }
}

/**
 * Inverse path: the provider sets a target margin instead of a price (FR1).
 * Gross up: price ≈ (COGS + margin) / (1 − 0.0075), rounded to the nearest
 * cent, then nudged up if fee rounding left the realized margin short.
 * Returns the price plus the *realized* margin so the UI can show the
 * provider exactly what they will earn (it may differ by a cent).
 */
export function priceForTargetMargin(
  unitCogsCents: number,
  targetMarginCents: number,
): { unitPriceCents: number; realizedMarginCents: number } {
  assertIntCents(unitCogsCents, "unitCogsCents");
  assertIntCents(targetMarginCents, "targetMarginCents");
  if (unitCogsCents < 0) throw new MoneyError("COGS cannot be negative");
  if (targetMarginCents < 0) throw new MoneyError("target margin cannot be negative");

  const base = unitCogsCents + targetMarginCents;
  let price = roundHalfUpDiv(base * BPS_DENOMINATOR, BPS_DENOMINATOR - PLATFORM_FEE_BPS);

  // Fee rounding can leave the realized margin one cent short; nudge up.
  while (price - unitCogsCents - platformFeeCents(price) < targetMarginCents) {
    price += 1;
  }

  const realizedMarginCents = price - unitCogsCents - platformFeeCents(price);
  return { unitPriceCents: price, realizedMarginCents };
}

/** Format integer cents as a dollar string, e.g. 123456 → "$1,234.56". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const remainder = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${remainder}`;
}
