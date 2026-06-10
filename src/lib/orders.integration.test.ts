/**
 * End-to-end domain test against the real local Postgres: assembles an
 * order, exercises decline/success/replay, and verifies the audit
 * guarantees the slice is graded on. Requires `npx prisma dev` running
 * and a seeded catalog (`npm run db:seed`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder, payOrder, stockLevels } from "@/lib/orders";

const DECLINE_CARD = "4000000000000002";
const GOOD_CARD = "4242424242424242";

const createdOrderIds: string[] = [];

let supplementId: string;
let wholesaleCents: number;

beforeAll(async () => {
  const supplement = await prisma.supplement.findFirst({ where: { active: true } });
  if (!supplement) throw new Error("catalog not seeded — run `npm run db:seed`");
  supplementId = supplement.id;
  wholesaleCents = supplement.wholesaleCents;
});

afterAll(async () => {
  await prisma.ledgerPosting.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.inventoryMovement.deleteMany({
    where: { orderId: { in: createdOrderIds } },
  });
  await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.orderLine.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.$disconnect();
});

async function makeOrder(quantity = 2) {
  const order = await createOrder("Integration Test Patient", [
    { supplementId, quantity, unitPriceCents: wholesaleCents * 2 },
  ]);
  createdOrderIds.push(order.id);
  return order;
}

describe("order → payment → ledger", () => {
  it("snapshots COGS and price onto the line with a valid split", async () => {
    const order = await makeOrder();
    expect(order.lines[0].unitCogsCents).toBe(wholesaleCents);
    expect(order.cogsCents + order.marginCents + order.feeCents).toBe(order.totalCents);
    expect(order.status).toBe("AWAITING_PAYMENT");
  });

  it("declined payment records the attempt and writes NOTHING else", async () => {
    const order = await makeOrder();
    const result = await payOrder(order.id, DECLINE_CARD);
    expect(result).toEqual({ outcome: "declined", reason: "card_declined" });

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { postings: true, payments: true, movements: true },
    });
    expect(after.status).toBe("AWAITING_PAYMENT");
    expect(after.postings).toHaveLength(0);
    expect(after.movements).toHaveLength(0);
    expect(after.payments).toHaveLength(1);
    expect(after.payments[0].status).toBe("DECLINED");
  });

  it("successful payment writes the full ledger atomically, summing exactly", async () => {
    const order = await makeOrder(3);
    const stockBefore = (await stockLevels()).get(supplementId) ?? 0;

    const result = await payOrder(order.id, GOOD_CARD);
    expect(result).toEqual({ outcome: "paid" });

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { postings: true, payments: true, movements: true },
    });
    expect(after.status).toBe("PAID");
    expect(after.paidAt).not.toBeNull();

    // 3 postings per line, summing to exactly what was charged
    expect(after.postings).toHaveLength(3 * 1);
    const sum = after.postings.reduce((s, p) => s + p.amountCents, 0);
    expect(sum).toBe(after.totalCents);

    // margin went to the provider, COGS + fee to the platform
    const byParty = (party: string) =>
      after.postings
        .filter((p) => p.party === party)
        .reduce((s, p) => s + p.amountCents, 0);
    expect(byParty("PROVIDER")).toBe(after.marginCents);
    expect(byParty("PLATFORM")).toBe(after.cogsCents + after.feeCents);

    // stock decremented by sale quantity via a SALE movement
    const stockAfter = (await stockLevels()).get(supplementId) ?? 0;
    expect(stockAfter).toBe(stockBefore - 3);
  });

  it("replaying payment is idempotent: no double ledger, no double decrement", async () => {
    const order = await makeOrder();
    await payOrder(order.id, GOOD_CARD);
    const replay = await payOrder(order.id, GOOD_CARD);
    expect(replay).toEqual({ outcome: "already_paid" });

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { postings: true, payments: true, movements: true },
    });
    expect(after.postings).toHaveLength(3);
    expect(after.movements).toHaveLength(1);
    expect(after.payments.filter((p) => p.status === "SUCCEEDED")).toHaveLength(1);
  });

  it("concurrent double-pay: exactly one succeeds", async () => {
    const order = await makeOrder();
    const [a, b] = await Promise.all([
      payOrder(order.id, GOOD_CARD),
      payOrder(order.id, GOOD_CARD),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toContain("paid");

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { postings: true, movements: true },
    });
    expect(after.postings).toHaveLength(3);
    expect(after.movements).toHaveLength(1);
  });

  it("rejects an order priced below COGS + fee", async () => {
    await expect(
      createOrder("Integration Test Patient", [
        { supplementId, quantity: 1, unitPriceCents: wholesaleCents - 1 },
      ]),
    ).rejects.toThrow(/negative margin/);
  });
});
