import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { stockLevels } from "@/lib/orders";
import { formatCents } from "@/lib/money";
import { PROVIDER } from "@/lib/actors";
import { ImpactBand } from "@/components/ImpactBand";
import {
  ProviderDashboardTables,
  type CatalogRow,
  type RecentOrderRow,
} from "@/components/ProviderDashboardTables";

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
  const statAccentClasses = ["metric-blue", "metric-pink", "metric-teal", "metric-green"];
  const catalogRows: CatalogRow[] = supplements.map((s) => {
    const sold = soldBySupplement.get(s.id);
    return {
      id: s.id,
      name: s.name,
      wholesaleCents: s.wholesaleCents,
      defaultPriceCents: s.defaultPriceCents,
      unitsSold: sold?._sum.quantity ?? 0,
      revenueCents: sold?._sum.totalCents ?? 0,
      stockOnHand: stock.get(s.id) ?? 0,
    };
  });
  const recentOrderRows: RecentOrderRow[] = recentOrders.map((order) => ({
    id: order.id,
    patientName: order.patientName,
    status: order.status,
    totalCents: order.totalCents,
    marginCents: order.marginCents,
    feeCents: order.feeCents,
    createdAtMs: order.createdAt.getTime(),
  }));

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div className="space-y-3">
          <p className="section-label">Cerbo formulary workspace</p>
          <h1 className="serif-heading page-title">{PROVIDER.practice}</h1>
          <p className="page-subtitle">
            A compact provider flow for in-house supplements: build the order,
            collect the patient payment, update inventory, and prove exactly where
            the money went.
          </p>
        </div>
        <div className="brand-card p-5">
          <p className="label-copy">Active provider</p>
          <p className="mt-1 text-xl font-bold text-[var(--cerbo-navy)]">
            {PROVIDER.name}
          </p>
          <Link
            href="/provider/orders/new"
            className="btn-primary mt-4 w-full px-4 py-2.5 text-sm"
          >
            <PackagePlus size={17} strokeWidth={2.4} aria-hidden="true" />
            New order
          </Link>
        </div>
      </section>

      <ImpactBand />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, index) => (
          <div key={s.label} className={`metric-card ${statAccentClasses[index]}`}>
            <div className="section-label">{s.label}</div>
            <div className="metric-value mt-2">{s.value}</div>
          </div>
        ))}
      </section>

      <ProviderDashboardTables
        catalogRows={catalogRows}
        recentOrderRows={recentOrderRows}
      />
    </div>
  );
}
