import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { CopyLinkButton } from "./CopyLinkButton";

export const dynamic = "force-dynamic";

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { include: { supplement: true } },
      postings: { include: { line: { include: { supplement: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const postingSum = order.postings.reduce((s, p) => s + p.amountCents, 0);
  const paidAttempt = order.payments.find((p) => p.status === "SUCCEEDED");
  const isPaid = order.status === "PAID";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="text-sm font-medium text-[var(--cerbo-muted)]">
            <Link href="/provider" className="text-[var(--cerbo-blue)] hover:underline">
              Dashboard
            </Link>{" "}
            / order <span className="font-mono">{order.id.slice(-8)}</span>
          </div>
          <h1 className="serif-heading page-title">
            Order for {order.patientName}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`status-pill ${
                isPaid
                  ? "bg-[#ecfdf3] text-[#067647]"
                  : "bg-[#fffaeb] text-[#b54708]"
              }`}
            >
              {order.status.replaceAll("_", " ").toLowerCase()}
            </span>
            <p className="text-sm text-[var(--cerbo-muted)]">
              {isPaid && order.paidAt
              ? `Paid ${order.paidAt.toLocaleString()}`
                : `Created ${order.createdAt.toLocaleString()} - awaiting payment`}
            </p>
          </div>
        </div>
        {order.status === "AWAITING_PAYMENT" && (
          <CopyLinkButton path={`/pay/${order.id}`} />
        )}
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Lines (price &amp; cost snapshotted at order time)</h2>
        <div className="brand-card overflow-x-auto">
          <table className="brand-table min-w-[880px]">
            <thead>
              <tr>
                <th>Supplement</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Line total</th>
                <th className="text-right">COGS</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id}>
                  <td className="font-bold text-[var(--cerbo-navy)]">
                    {line.supplement.name}
                  </td>
                  <td className="text-right">{line.quantity}</td>
                  <td className="text-right">{formatCents(line.unitPriceCents)}</td>
                  <td className="text-right">{formatCents(line.totalCents)}</td>
                  <td className="text-right text-[var(--cerbo-muted)]">
                    {formatCents(line.cogsCents)}
                  </td>
                  <td className="text-right text-[var(--cerbo-muted)]">
                    {formatCents(line.feeCents)}
                  </td>
                  <td className="text-right font-bold text-[#067647]">
                    {formatCents(line.marginCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td />
                <td />
                <td className="text-right">{formatCents(order.totalCents)}</td>
                <td className="text-right">{formatCents(order.cogsCents)}</td>
                <td className="text-right">{formatCents(order.feeCents)}</td>
                <td className="text-right text-[#067647]">
                  {formatCents(order.marginCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Ledger - where every cent went</h2>
        {order.postings.length === 0 ? (
          <p className="brand-card border-dashed p-6 text-sm text-[var(--cerbo-muted)]">
            No ledger entries. Postings are written only when payment succeeds -
            an unpaid order has no money movement to account for.
          </p>
        ) : (
          <>
            <div className="brand-card overflow-x-auto">
              <table className="brand-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Party</th>
                    <th>Reason</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.postings.map((p) => (
                    <tr key={p.id}>
                      <td className="text-[var(--cerbo-muted)]">
                        {p.line.supplement.name}
                      </td>
                      <td>{p.party.toLowerCase()}</td>
                      <td>
                        {p.reason.replaceAll("_", " ").toLowerCase()}
                      </td>
                      <td className="text-right">{formatCents(p.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      Sum of postings
                    </td>
                    <td className="text-right">{formatCents(postingSum)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p
              className={`status-pill ${
                postingSum === order.totalCents
                  ? "bg-[#ecfdf3] text-[#067647]"
                  : "bg-[#fef3f2] text-[#b42318]"
              }`}
            >
              {postingSum === order.totalCents
                ? `OK: Postings sum exactly to the ${formatCents(order.totalCents)} the patient paid`
                : `INVARIANT VIOLATION: postings ${formatCents(postingSum)} do not equal paid ${formatCents(order.totalCents)}`}
            </p>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Payment attempts</h2>
        {order.payments.length === 0 ? (
          <p className="text-sm text-[var(--cerbo-muted)]">None yet.</p>
        ) : (
          <ul className="brand-card divide-y divide-[var(--cerbo-soft-border)] text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-[var(--cerbo-ink)]">
                <span>
                  {p.createdAt.toLocaleString()} - card ****{p.cardLast4}
                </span>
                {p.status === "SUCCEEDED" ? (
                  <span className="font-bold text-[#067647]">
                    succeeded ({formatCents(p.amountCents)})
                  </span>
                ) : (
                  <span className="font-bold text-red-600">
                    declined ({p.failureReason})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {paidAttempt && (
          <p className="text-sm text-[var(--cerbo-muted)]">
            Money flow: patient paid the platform {formatCents(paidAttempt.amountCents)};
            the platform retains COGS + fee and owes the provider{" "}
            {formatCents(order.marginCents)} via the (stubbed) payout leg.
          </p>
        )}
      </section>
    </div>
  );
}
