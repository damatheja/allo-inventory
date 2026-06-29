import { z } from "zod";

export const ReserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive().max(100),
});
export type ReserveInput = z.infer<typeof ReserveSchema>;

export const ReservationStatusSchema = z.enum(["PENDING", "CONFIRMED", "RELEASED"]);

export const ReservationSchema = z.object({
  id: z.string(),
  stockId: z.string(),
  quantity: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  stock: z.object({
    product: z.object({ id: z.string(), name: z.string(), sku: z.string(), price: z.string() }),
    warehouse: z.object({ id: z.string(), name: z.string(), location: z.string() }),
  }),
});
export type Reservation = z.infer<typeof ReservationSchema>;
