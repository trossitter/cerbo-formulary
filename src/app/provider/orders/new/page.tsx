import { prisma } from "@/lib/db";
import { stockLevels } from "@/lib/orders";
import { PATIENTS } from "@/lib/actors";
import { OrderBuilder } from "./OrderBuilder";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [supplements, stock] = await Promise.all([
    prisma.supplement.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    stockLevels(),
  ]);

  return (
    <OrderBuilder
      patients={PATIENTS.map((p) => p.name)}
      catalog={supplements.map((s) => ({
        id: s.id,
        name: s.name,
        wholesaleCents: s.wholesaleCents,
        defaultPriceCents: s.defaultPriceCents,
        stock: stock.get(s.id) ?? 0,
      }))}
    />
  );
}
