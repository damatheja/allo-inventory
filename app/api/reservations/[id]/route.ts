import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      stock: {
        include: { product: true, warehouse: true },
      },
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: reservation.id,
    stockId: reservation.stockId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
    stock: {
      product: {
        id: reservation.stock.product.id,
        name: reservation.stock.product.name,
        sku: reservation.stock.product.sku,
        price: reservation.stock.product.price.toString(),
      },
      warehouse: reservation.stock.warehouse,
    },
  });
}
