import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status !== "PENDING") {
    return NextResponse.json(
      { message: "Reservation already settled", status: reservation.status },
      { status: 200 }
    );
  }

  await prisma.$transaction([
    prisma.reservation.update({ where: { id }, data: { status: "RELEASED" } }),
    prisma.stock.update({
      where: { id: reservation.stockId },
      data: { reserved: { decrement: reservation.quantity } },
    }),
  ]);

  return NextResponse.json({ id, status: "RELEASED", message: "Reservation released" });
}
