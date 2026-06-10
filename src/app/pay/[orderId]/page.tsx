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
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          Pay for your supplements
        </h1>
        <p className="text-sm text-stone-500">
          Prescribed by {order.providerName} for {order.patientName}
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <ul className="divide-y divide-stone-100 text-sm">
          {order.lines.map((line) => (
            <li key={line.id} className="flex justify-between py-2">
              <span>
                {line.quantity}× {line.supplement.name}
              </span>
              <span>{formatCents(line.totalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 font-semibold">
          <span>Total</span>
          <span>{formatCents(order.totalCents)}</span>
        </div>
      </div>

      {order.status === "PAID" ? (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          This order is paid — thank you! A receipt has been (pretend) emailed to you.
        </div>
      ) : (
        <PayForm orderId={order.id} amountLabel={formatCents(order.totalCents)} />
      )}
    </div>
  );
}
