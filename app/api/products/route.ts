import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  // Lazy cleanup: release expired reservations before computing available stock
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = products.map((p: typeof products[0]) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    price: p.price.toString(),
    stocks: p.stocks.map((s: typeof p.stocks[0]) => ({
      id: s.id,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      totalUnits: s.totalUnits,
      reserved: s.reserved,
      available: s.totalUnits - s.reserved,
    })),
  }));

  return NextResponse.json(result);
}
