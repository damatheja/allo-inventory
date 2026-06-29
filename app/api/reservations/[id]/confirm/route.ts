import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Idempotency
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return NextResponse.json(existing.responseBody, {
        status: (existing.responseBody as { _status?: number })._status ?? 200,
        headers: { "Idempotency-Replayed": "true" },
      });
    }
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { stock: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json({ message: "Already confirmed", id }, { status: 200 });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({ error: "Reservation already released" }, { status: 410 });
  }

  if (new Date() > reservation.expiresAt) {
    // Mark as released since it expired
    await prisma.$transaction([
      prisma.reservation.update({ where: { id }, data: { status: "RELEASED" } }),
      prisma.stock.update({
        where: { id: reservation.stockId },
        data: { reserved: { decrement: reservation.quantity } },
      }),
    ]);
    const body = { error: "Reservation has expired", code: "RESERVATION_EXPIRED" };
    if (idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: { key: idempotencyKey, reservationId: id, endpoint: `POST /api/reservations/${id}/confirm`, responseBody: { ...body, _status: 410 } },
      }).catch(() => {});
    }
    return NextResponse.json(body, { status: 410 });
  }

  // Confirm: decrement actual stock (reserved was already held)
  const [updated] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "CONFIRMED" },
    }),
    prisma.stock.update({
      where: { id: reservation.stockId },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    }),
  ]);

  const responseBody = {
    id: updated.id,
    status: updated.status,
    message: "Reservation confirmed",
  };

  if (idempotencyKey) {
    await prisma.idempotencyKey.create({
      data: { key: idempotencyKey, reservationId: id, endpoint: `POST /api/reservations/${id}/confirm`, responseBody: { ...responseBody, _status: 200 } },
    }).catch(() => {});
  }

  return NextResponse.json(responseBody);
}
