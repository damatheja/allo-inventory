import { ReservationCheckout } from "@/components/ReservationCheckout";
import { notFound } from "next/navigation";

async function getReservation(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/reservations/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load reservation");
  return res.json();
}

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <a
          href="/"
          className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          ← Back to products
        </a>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Checkout</h1>
      <ReservationCheckout reservation={reservation} />
    </div>
  );
}
