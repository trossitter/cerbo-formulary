import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATALOG = [
  {
    name: "Omega-3 Fish Oil 1000mg (120 softgels)",
    description: "High-potency EPA/DHA for cardiovascular support.",
    wholesaleCents: 1450,
    defaultPriceCents: 2900,
    initialStock: 80,
  },
  {
    name: "Vitamin D3 5000 IU (90 capsules)",
    description: "Cholecalciferol with MCT oil for absorption.",
    wholesaleCents: 620,
    defaultPriceCents: 1495,
    initialStock: 120,
  },
  {
    name: "Magnesium Glycinate 400mg (180 capsules)",
    description: "Chelated magnesium for sleep and muscle recovery.",
    wholesaleCents: 1105,
    defaultPriceCents: 2250,
    initialStock: 60,
  },
  {
    name: "Probiotic 50B CFU (30 capsules)",
    description: "Multi-strain, shelf-stable probiotic.",
    wholesaleCents: 2210,
    defaultPriceCents: 4400,
    initialStock: 45,
  },
  {
    name: "Curcumin Phytosome 500mg (60 capsules)",
    description: "Enhanced-absorption turmeric extract.",
    wholesaleCents: 1830,
    defaultPriceCents: 3675,
    initialStock: 50,
  },
];

async function main() {
  const existing = await prisma.supplement.count();
  if (existing > 0) {
    console.log(`Catalog already seeded (${existing} supplements); skipping.`);
    return;
  }

  for (const item of CATALOG) {
    const { initialStock, ...data } = item;
    await prisma.supplement.create({
      data: {
        ...data,
        movements: {
          create: { delta: initialStock, reason: "INITIAL", note: "opening stock" },
        },
      },
    });
  }
  console.log(`Seeded ${CATALOG.length} supplements with opening stock.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
