import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { PayForm } from "./PayForm";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { supplement: true } } },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <p className="section-label">Secure patient checkout</p>
        <h1 className="serif-heading page-title">Pay for your supplements</h1>
        <p className="page-subtitle">
          Prescribed by {order.providerName} for {order.patientName}
        </p>
      </div>

      <div className="brand-card p-5">
        <ul className="divide-y divide-[var(--cerbo-soft-border)] text-sm">
          {order.lines.map((line) => (
            <li key={line.id} className="flex justify-between py-2">
              <span className="font-medium text-[var(--cerbo-ink)]">
                {line.quantity}x {line.supplement.name}
              </span>
              <span className="font-bold text-[var(--cerbo-navy)]">
                {formatCents(line.totalCents)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-[var(--cerbo-border)] pt-3 font-bold">
          <span>Total</span>
          <span className="text-xl text-[var(--cerbo-navy)]">
            {formatCents(order.totalCents)}
          </span>
        </div>
      </div>

      {order.status === "PAID" ? (
        <div className="success-panel p-4 text-sm font-semibold">
          Payment of {formatCents(order.totalCents)} succeeded - thank you! A
          receipt has been (pretend) emailed to you.
        </div>
      ) : (
        <PayForm orderId={order.id} amountLabel={formatCents(order.totalCents)} />
      )}
    </div>
  );
}
