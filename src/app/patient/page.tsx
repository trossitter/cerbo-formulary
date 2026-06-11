import Link from "next/link";
import { cookies } from "next/headers";
import { CreditCard, ShieldCheck, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { PATIENTS, ROLE_COOKIE } from "@/lib/actors";

export const dynamic = "force-dynamic";

export default async function PatientHome() {
  const jar = await cookies();
  const role = jar.get(ROLE_COOKIE)?.value ?? "";
  const patient = PATIENTS.find((p) => p.id === role) ?? PATIENTS[0];

  const orders = await prisma.order.findMany({
    where: { patientName: patient.name },
    orderBy: { createdAt: "desc" },
    include: { lines: { include: { supplement: true } } },
  });
  const unpaidCount = orders.filter((order) => order.status !== "PAID").length;

  return (
    <div className="patient-workspace space-y-7">
      <section className="patient-hero">
        <div className="space-y-3">
          <p className="section-label">Patient portal</p>
          <h1 className="serif-heading page-title">
            Hi {patient.name.split(" ")[0]} - your supplement orders
          </h1>
          <p className="page-subtitle">
            Orders your provider has assembled for you, ready for review and payment.
          </p>
        </div>

        <aside className="patient-identity-card">
          <div className="patient-avatar" aria-hidden="true">
            <UserRound size={24} strokeWidth={2.3} />
          </div>
          <div>
            <p className="label-copy">Viewing patient</p>
            <p className="mt-1 text-lg font-bold text-[var(--cerbo-navy)]">
              {patient.name}
            </p>
          </div>
          <div className="patient-id-row">
            <ShieldCheck size={16} strokeWidth={2.3} aria-hidden="true" />
            {unpaidCount === 0
              ? "No payments due"
              : `${unpaidCount} payment${unpaidCount === 1 ? "" : "s"} due`}
          </div>
        </aside>
      </section>

      {orders.length === 0 && (
        <p className="brand-card border-dashed p-6 text-sm text-[var(--cerbo-muted)]">
          No orders yet. (Switch to the provider view to create one.)
        </p>
      )}

      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="patient-order-card brand-card p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--cerbo-muted)]">
                  {o.createdAt.toLocaleDateString()} - {o.lines.length} item
                  {o.lines.length === 1 ? "" : "s"}
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--cerbo-navy)]">
                  {o.lines
                    .map((l) => `${l.quantity}x ${l.supplement.name}`)
                    .join(", ")}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-2xl font-bold text-[var(--cerbo-navy)]">
                  {formatCents(o.totalCents)}
                </span>
                {o.status === "PAID" ? (
                  <span className="status-pill bg-[#ecfdf3] text-[#067647]">
                    paid
                  </span>
                ) : (
                  <Link
                    href={`/pay/${o.id}`}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    <CreditCard size={16} strokeWidth={2.4} aria-hidden="true" />
                    Pay now
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
