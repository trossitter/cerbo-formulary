import "server-only";
import { prisma } from "@/lib/db";
import { gateway } from "@/lib/gateway";
import { computeOrderSplit, MoneyError } from "@/lib/money";
import { PROVIDER } from "@/lib/actors";

export interface NewOrderLine {
  supplementId: string;
  quantity: number;
  /** Patient-facing price per unit, integer cents, set by the provider. */
  unitPriceCents: number;
}

/**
 * Assemble an order. Price and COGS are snapshotted from the catalog onto
 * each line NOW — later catalog edits must not change a placed order's
 * economics. The full split is computed and persisted up front; ledger
 * postings are NOT written here (only payment writes the ledger).
 */
export async function createOrder(patientName: string, lines: NewOrderLine[]) {
  if (lines.length === 0) throw new MoneyError("order must have at least one line");

  const supplements = await prisma.supplement.findMany({
    where: { id: { in: lines.map((l) => l.supplementId) }, active: true },
  });
  const byId = new Map(supplements.map((s) => [s.id, s]));

  const enriched = lines.map((line) => {
    const supplement = byId.get(line.supplementId);
    if (!supplement) throw new MoneyError(`unknown supplement: ${line.supplementId}`);
    return {
      ...line,
      unitCogsCents: supplement.wholesaleCents,
    };
  });

  // Throws MoneyError on negative margin, bad quantity, etc. — the order
  // is never created with an invalid split.
  const split = computeOrderSplit(
    enriched.map(({ unitPriceCents, unitCogsCents, quantity }) => ({
      unitPriceCents,
      unitCogsCents,
      quantity,
    })),
  );

  return prisma.order.create({
    data: {
      providerName: PROVIDER.name,
      patientName,
      totalCents: split.totalCents,
      cogsCents: split.cogsCents,
      feeCents: split.feeCents,
      marginCents: split.marginCents,
      lines: {
        create: enriched.map((line, i) => ({
          supplementId: line.supplementId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          unitCogsCents: line.unitCogsCents,
          totalCents: split.lines[i].totalCents,
          cogsCents: split.lines[i].cogsCents,
          feeCents: split.lines[i].feeCents,
          marginCents: split.lines[i].marginCents,
        })),
      },
    },
    include: { lines: true },
  });
}

export type PayResult =
  | { outcome: "paid" }
  | { outcome: "already_paid" }
  | { outcome: "declined"; reason: string };

/**
 * Take payment for an order. Guarantees:
 *
 *  - Idempotent: an order can only transition AWAITING_PAYMENT → PAID once,
 *    enforced by an atomic compare-and-set on the status row. Replays and
 *    double-clicks observe "already_paid" and write nothing.
 *  - Atomic: ledger postings, SALE inventory movements, the payment record
 *    and the status flip commit in ONE transaction. A declined payment
 *    records the attempt and nothing else; a paid order always has a
 *    complete ledger.
 *  - Exact: postings are written from the per-line split persisted at order
 *    time and re-verified to sum to the charged amount before commit.
 */
export async function payOrder(orderId: string, cardNumber: string): Promise<PayResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order) throw new Error("order not found");
  if (order.status === "PAID") return { outcome: "already_paid" };
  if (order.status === "CANCELED") throw new Error("order is canceled");

  const charge = await gateway.charge({ amountCents: order.totalCents, cardNumber });

  if (!charge.ok) {
    await prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        amountCents: order.totalCents,
        status: "DECLINED",
        cardLast4: charge.cardLast4,
        failureReason: charge.declineReason,
      },
    });
    return { outcome: "declined", reason: charge.declineReason };
  }

  return prisma.$transaction(async (tx) => {
    // Atomic compare-and-set: only one caller ever flips the status.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "AWAITING_PAYMENT" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return { outcome: "already_paid" as const };

    await tx.paymentAttempt.create({
      data: {
        orderId: order.id,
        amountCents: order.totalCents,
        status: "SUCCEEDED",
        cardLast4: charge.cardLast4,
        successfulOrderKey: order.id,
      },
    });

    // Final audit gate: postings must sum to exactly the charged amount.
    let postingSum = 0;
    const postings = order.lines.flatMap((line) => {
      postingSum += line.cogsCents + line.feeCents + line.marginCents;
      return [
        {
          orderId: order.id,
          orderLineId: line.id,
          party: "PLATFORM" as const,
          reason: "COGS" as const,
          amountCents: line.cogsCents,
        },
        {
          orderId: order.id,
          orderLineId: line.id,
          party: "PLATFORM" as const,
          reason: "PLATFORM_FEE" as const,
          amountCents: line.feeCents,
        },
        {
          orderId: order.id,
          orderLineId: line.id,
          party: "PROVIDER" as const,
          reason: "PROVIDER_MARGIN" as const,
          amountCents: line.marginCents,
        },
      ];
    });
    if (postingSum !== order.totalCents) {
      // Aborts the transaction — status flip and attempt roll back too.
      throw new MoneyError(
        `ledger drift: postings sum ${postingSum}¢ != charged ${order.totalCents}¢`,
      );
    }
    await tx.ledgerPosting.createMany({ data: postings });

    await tx.inventoryMovement.createMany({
      data: order.lines.map((line) => ({
        supplementId: line.supplementId,
        delta: -line.quantity,
        reason: "SALE" as const,
        orderId: order.id,
      })),
    });

    return { outcome: "paid" as const };
  });
}

/** Stock on hand per supplement = sum of movement deltas. */
export async function stockLevels(): Promise<Map<string, number>> {
  const sums = await prisma.inventoryMovement.groupBy({
    by: ["supplementId"],
    _sum: { delta: true },
  });
  return new Map(sums.map((s) => [s.supplementId, s._sum.delta ?? 0]));
}

export async function restock(supplementId: string, quantity: number, note?: string) {
  if (!Number.isSafeInteger(quantity) || quantity === 0) {
    throw new Error("restock quantity must be a non-zero integer");
  }
  return prisma.inventoryMovement.create({
    data: {
      supplementId,
      delta: quantity,
      reason: quantity > 0 ? "RESTOCK" : "ADJUSTMENT",
      note,
    },
  });
}
