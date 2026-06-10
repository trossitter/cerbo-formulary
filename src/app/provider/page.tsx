import Link from "next/link";
import { prisma } from "@/lib/db";
import { stockLevels } from "@/lib/orders";
import { formatCents } from "@/lib/money";
import { PROVIDER } from "@/lib/actors";
import { restockAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ProviderDashboard() {
  const [paidAgg, paidLines, supplements, stock, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalCents: true, cogsCents: true, feeCents: true, marginCents: true },
      _count: true,
    }),
    prisma.orderLine.groupBy({
      by: ["supplementId"],
      where: { order: { status: "PAID" } },
      _sum: { quantity: true, totalCents: true, marginCents: true },
    }),
    prisma.supplement.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    stockLevels(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { lines: true },
    }),
  ]);

  const soldBySupplement = new Map(paidLines.map((l) => [l.supplementId, l]));
  const sums = paidAgg._sum;

  const stats = [
    { label: "GMV (paid orders)", value: formatCents(sums.totalCents ?? 0) },
    { label: "Platform fees (75 bps)", value: formatCents(sums.feeCents ?? 0) },
    { label: "Your margin", value: formatCents(sums.marginCents ?? 0) },
    { label: "Orders paid", value: String(paidAgg._count) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            {PROVIDER.practice}
          </h1>
          <p className="text-sm text-stone-500">{PROVIDER.name}</p>
        </div>
        <Link
          href="/provider/orders/new"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          New order
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-stone-500">{s.label}</div>
            <div className="mt-1 text-lg font-semibold text-stone-900">{s.value}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Catalog, sales &amp; inventory
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Supplement</th>
                <th className="px-4 py-2 text-right">COGS</th>
                <th className="px-4 py-2 text-right">Default price</th>
                <th className="px-4 py-2 text-right">Units sold</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2 text-right">Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {supplements.map((s) => {
                const sold = soldBySupplement.get(s.id);
                const onHand = stock.get(s.id) ?? 0;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium text-stone-800">{s.name}</td>
                    <td className="px-4 py-2 text-right text-stone-600">
                      {formatCents(s.wholesaleCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-600">
                      {formatCents(s.defaultPriceCents)}
                    </td>
                    <td className="px-4 py-2 text-right">{sold?._sum.quantity ?? 0}</td>
                    <td className="px-4 py-2 text-right">
                      {formatCents(sold?._sum.totalCents ?? 0)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        onHand <= 10 ? "text-red-600" : "text-stone-800"
                      }`}
                    >
                      {onHand}
                    </td>
                    <td className="px-4 py-2">
                      <form action={restockAction} className="flex justify-end gap-1">
                        <input type="hidden" name="supplementId" value={s.id} />
                        <input
                          type="number"
                          name="quantity"
                          placeholder="qty"
                          className="w-16 rounded border border-stone-300 px-1 py-0.5 text-right"
                        />
                        <button
                          type="submit"
                          className="rounded bg-stone-200 px-2 py-0.5 text-xs hover:bg-stone-300"
                        >
                          Add
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          Stock is derived from the inventory movement log (initial + restocks − sales).
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Recent orders
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Patient</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Margin</th>
                <th className="px-4 py-2 text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                    No orders yet — create the first one.
                  </td>
                </tr>
              )}
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/provider/orders/${o.id}`}
                      className="font-mono text-xs text-emerald-700 hover:underline"
                    >
                      {o.id.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{o.patientName}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-2 text-right">{formatCents(o.totalCents)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(o.marginCents)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(o.feeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-800",
    AWAITING_PAYMENT: "bg-amber-100 text-amber-800",
    CANCELED: "bg-stone-100 text-stone-500",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}
    >
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
