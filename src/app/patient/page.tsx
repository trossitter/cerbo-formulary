import Link from "next/link";
import { cookies } from "next/headers";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          Hi {patient.name.split(" ")[0]} — your supplement orders
        </h1>
        <p className="text-sm text-stone-500">
          Orders your provider has assembled for you.
        </p>
      </div>

      {orders.length === 0 && (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
          No orders yet. (Switch to the provider view to create one.)
        </p>
      )}

      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-stone-500">
                  {o.createdAt.toLocaleDateString()} · {o.lines.length} item
                  {o.lines.length === 1 ? "" : "s"}
                </div>
                <div className="mt-1 text-sm text-stone-700">
                  {o.lines
                    .map((l) => `${l.quantity}× ${l.supplement.name}`)
                    .join(", ")}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold">{formatCents(o.totalCents)}</span>
                {o.status === "PAID" ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                    paid
                  </span>
                ) : (
                  <Link
                    href={`/pay/${o.id}`}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                  >
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
