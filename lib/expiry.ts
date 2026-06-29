import { prisma } from "./prisma";

/**
 * Release all expired PENDING reservations, returning reserved units to stock.
 * Called lazily on product list reads and by cron job in production.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, stockId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  // Release each in a transaction
  await prisma.$transaction(
    expired.map((r) =>
      prisma.$transaction([
        prisma.reservation.update({
          where: { id: r.id },
          data: { status: "RELEASED" },
        }),
        prisma.stock.update({
          where: { id: r.stockId },
          data: { reserved: { decrement: r.quantity } },
        }),
      ])
    )
  );

  return expired.length;
}

export const RESERVATION_TTL_MINUTES = 10;
