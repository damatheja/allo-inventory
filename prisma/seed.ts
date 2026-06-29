import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.idempotencyKey.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const [wh1, wh2] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Central", location: "Mumbai, MH" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore South", location: "Bangalore, KA" },
    }),
  ]);

  // Products
  const [p1, p2, p3, p4] = await Promise.all([
    prisma.product.create({
      data: {
        name: "Noise-Cancelling Headphones",
        sku: "NCH-001",
        description: "Premium over-ear headphones with active noise cancellation.",
        price: 12999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard",
        sku: "MKB-002",
        description: "Compact TKL layout with tactile switches.",
        price: 7499,
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Mouse",
        sku: "MSE-003",
        description: "Vertical ergonomic design for all-day comfort.",
        price: 3499,
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Hub",
        sku: "HUB-004",
        description: "7-in-1 hub with HDMI, USB 3.0, and SD card slots.",
        price: 2999,
      },
    }),
  ]);

  // Stocks
  await Promise.all([
    // Headphones
    prisma.stock.create({ data: { productId: p1.id, warehouseId: wh1.id, totalUnits: 8 } }),
    prisma.stock.create({ data: { productId: p1.id, warehouseId: wh2.id, totalUnits: 3 } }),
    // Keyboard
    prisma.stock.create({ data: { productId: p2.id, warehouseId: wh1.id, totalUnits: 15 } }),
    prisma.stock.create({ data: { productId: p2.id, warehouseId: wh2.id, totalUnits: 2 } }),
    // Mouse
    prisma.stock.create({ data: { productId: p3.id, warehouseId: wh1.id, totalUnits: 20 } }),
    prisma.stock.create({ data: { productId: p3.id, warehouseId: wh2.id, totalUnits: 5 } }),
    // USB Hub - intentionally limited stock
    prisma.stock.create({ data: { productId: p4.id, warehouseId: wh1.id, totalUnits: 1 } }),
    prisma.stock.create({ data: { productId: p4.id, warehouseId: wh2.id, totalUnits: 0 } }),
  ]);

  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
