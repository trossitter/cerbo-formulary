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

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-stone-500">
            <Link href="/provider" className="hover:underline">
              Dashboard
            </Link>{" "}
            / order <span className="font-mono">{order.id.slice(-8)}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold text-stone-900">
            Order for {order.patientName}
          </h1>
          <p className="text-sm text-stone-500">
            {order.status === "PAID" && order.paidAt
              ? `Paid ${order.paidAt.toLocaleString()}`
              : `Created ${order.createdAt.toLocaleString()} — awaiting payment`}
          </p>
        </div>
        {order.status === "AWAITING_PAYMENT" && (
          <CopyLinkButton path={`/pay/${order.id}`} />
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Lines (price &amp; cost snapshotted at order time)
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Supplement</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit price</th>
                <th className="px-4 py-2 text-right">Line total</th>
                <th className="px-4 py-2 text-right">COGS</th>
                <th className="px-4 py-2 text-right">Fee</th>
                <th className="px-4 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {order.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2 font-medium text-stone-800">
                    {line.supplement.name}
                  </td>
                  <td className="px-4 py-2 text-right">{line.quantity}</td>
                  <td className="px-4 py-2 text-right">{formatCents(line.unitPriceCents)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(line.totalCents)}</td>
                  <td className="px-4 py-2 text-right text-stone-600">
                    {formatCents(line.cogsCents)}
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600">
                    {formatCents(line.feeCents)}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-700">
                    {formatCents(line.marginCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-stone-50 font-medium">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td />
                <td />
                <td className="px-4 py-2 text-right">{formatCents(order.totalCents)}</td>
                <td className="px-4 py-2 text-right">{formatCents(order.cogsCents)}</td>
                <td className="px-4 py-2 text-right">{formatCents(order.feeCents)}</td>
                <td className="px-4 py-2 text-right text-emerald-700">
                  {formatCents(order.marginCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Ledger — where every cent went
        </h2>
        {order.postings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
            No ledger entries. Postings are written only when payment succeeds —
            an unpaid order has no money movement to account for.
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-2">Line</th>
                    <th className="px-4 py-2">Party</th>
                    <th className="px-4 py-2">Reason</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {order.postings.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-stone-600">
                        {p.line.supplement.name}
                      </td>
                      <td className="px-4 py-2">{p.party.toLowerCase()}</td>
                      <td className="px-4 py-2">
                        {p.reason.replaceAll("_", " ").toLowerCase()}
                      </td>
                      <td className="px-4 py-2 text-right">{formatCents(p.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-stone-50 font-medium">
                  <tr>
                    <td className="px-4 py-2" colSpan={3}>
                      Sum of postings
                    </td>
                    <td className="px-4 py-2 text-right">{formatCents(postingSum)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                postingSum === order.totalCents
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {postingSum === order.totalCents
                ? `✓ Postings sum exactly to the ${formatCents(order.totalCents)} the patient paid`
                : `✗ INVARIANT VIOLATION: postings ${formatCents(postingSum)} ≠ paid ${formatCents(order.totalCents)}`}
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Payment attempts
        </h2>
        {order.payments.length === 0 ? (
          <p className="text-sm text-stone-500">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="text-stone-600">
                {p.createdAt.toLocaleString()} — card ····{p.cardLast4} —{" "}
                {p.status === "SUCCEEDED" ? (
                  <span className="font-medium text-emerald-700">
                    succeeded ({formatCents(p.amountCents)})
                  </span>
                ) : (
                  <span className="font-medium text-red-600">
                    declined ({p.failureReason})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {paidAttempt && (
          <p className="mt-3 text-xs text-stone-400">
            Money flow: patient paid the platform {formatCents(paidAttempt.amountCents)};
            the platform retains COGS + fee and owes the provider{" "}
            {formatCents(order.marginCents)} via the (stubbed) payout leg.
          </p>
        )}
      </section>
    </div>
  );
}
