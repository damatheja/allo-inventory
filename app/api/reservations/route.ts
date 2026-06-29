import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLock } from "@/lib/redis";
import { ReserveSchema } from "@/lib/schemas";
import { RESERVATION_TTL_MINUTES } from "@/lib/expiry";

export async function POST(req: NextRequest) {
  // --- Idempotency ---
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

  // --- Parse & validate ---
  const body = await req.json().catch(() => null);
  const parsed = ReserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { productId, warehouseId, quantity } = parsed.data;

  // --- Find stock row ---
  const stock = await prisma.stock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  if (!stock) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  // --- Concurrency-safe reservation via distributed lock + DB transaction ---
  try {
    const reservation = await withLock(
      `stock:${stock.id}`,
      async () => {
        // Re-read inside the lock to get fresh values
        const freshStock = await prisma.stock.findUniqueOrThrow({
          where: { id: stock.id },
        });

        const available = freshStock.totalUnits - freshStock.reserved;
        if (available < quantity) {
          throw new InsufficientStockError(
            `Only ${available} unit(s) available`
          );
        }

        const expiresAt = new Date(
          Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
        );

        // Atomic: increment reserved + create reservation
        const [, reservation] = await prisma.$transaction([
          prisma.stock.update({
            where: { id: stock.id },
            data: { reserved: { increment: quantity } },
          }),
          prisma.reservation.create({
            data: {
              stockId: stock.id,
              quantity,
              expiresAt,
            },
            include: {
              stock: {
                include: {
                  product: true,
                  warehouse: true,
                },
              },
            },
          }),
        ]);

        return reservation;
      }
    );

    const responseBody = serializeReservation(reservation);

    // Store idempotency key
    if (idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          reservationId: reservation.id,
          endpoint: "POST /api/reservations",
          responseBody: { ...responseBody, _status: 201 },
        },
      }).catch(() => {}); // ignore race on concurrent duplicate keys
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      const body = { error: err.message, code: "INSUFFICIENT_STOCK" };
      if (idempotencyKey) {
        await prisma.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            endpoint: "POST /api/reservations",
            responseBody: { ...body, _status: 409 },
          },
        }).catch(() => {});
      }
      return NextResponse.json(body, { status: 409 });
    }
    console.error("Reservation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

class InsufficientStockError extends Error {}

function serializeReservation(r: {
  id: string;
  stockId: string;
  quantity: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  stock: {
    product: { id: string; name: string; sku: string; price: object };
    warehouse: { id: string; name: string; location: string };
  };
}) {
  return {
    id: r.id,
    stockId: r.stockId,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    stock: {
      product: {
        id: r.stock.product.id,
        name: r.stock.product.name,
        sku: r.stock.product.sku,
        price: r.stock.product.price.toString(),
      },
      warehouse: r.stock.warehouse,
    },
  };
}
