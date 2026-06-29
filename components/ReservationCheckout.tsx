"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Reservation = {
  id: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  stock: {
    product: { id: string; name: string; sku: string; price: string };
    warehouse: { id: string; name: string; location: string };
  };
};

function useCountdown(expiresAt: string) {
  const getRemaining = useCallback(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [getRemaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { remaining, formatted: `${mins}:${secs.toString().padStart(2, "0")}` };
}

export function ReservationCheckout({ reservation: initial }: { reservation: Reservation }) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initial);
  const [actionLoading, setActionLoading] = useState<"confirm" | "release" | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const { remaining, formatted } = useCountdown(reservation.expiresAt);

  const isExpired = remaining === 0 && reservation.status === "PENDING";
  const isSettled = reservation.status !== "PENDING";

  async function confirm() {
    setActionLoading("confirm");
    setApiError(null);
    const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.status === 410) {
      setApiError("Your reservation expired before payment could be confirmed.");
      setReservation((r) => ({ ...r, status: "RELEASED" }));
    } else if (!res.ok) {
      setApiError(data.error || "Something went wrong.");
    } else {
      setReservation((r) => ({ ...r, status: "CONFIRMED" }));
    }
    setActionLoading(null);
  }

  async function release() {
    setActionLoading("release");
    setApiError(null);
    const res = await fetch(`/api/reservations/${reservation.id}/release`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json();
      setApiError(data.error || "Something went wrong.");
    } else {
      setReservation((r) => ({ ...r, status: "RELEASED" }));
    }
    setActionLoading(null);
  }

  const product = reservation.stock.product;
  const warehouse = reservation.stock.warehouse;
  const total = Number(product.price) * reservation.quantity;

  return (
    <div className="space-y-4">
      {/* Order summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Order summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{product.sku}</p>
            </div>
            <p className="font-medium">₹{Number(product.price).toLocaleString("en-IN")}</p>
          </div>
          <div className="text-sm text-gray-500 flex justify-between">
            <span>Quantity</span>
            <span>{reservation.quantity}</span>
          </div>
          <div className="text-sm text-gray-500 flex justify-between">
            <span>Ships from</span>
            <span>{warehouse.name}</span>
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Reservation status */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Reservation</p>
            <p className="font-mono text-xs text-gray-400 mt-0.5">{reservation.id}</p>
          </div>
          <StatusBadge status={reservation.status} expired={isExpired} />
        </div>

        {reservation.status === "PENDING" && !isExpired && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className={`text-2xl font-mono font-bold tabular-nums ${
                remaining < 60 ? "text-red-500" : remaining < 180 ? "text-amber-500" : "text-indigo-600"
              }`}
            >
              {formatted}
            </div>
            <p className="text-sm text-gray-500">remaining to confirm</p>
          </div>
        )}

        {(isExpired || reservation.status === "RELEASED") && (
          <p className="mt-4 text-sm text-gray-500">
            This reservation has been released. The items are back in stock.
          </p>
        )}

        {reservation.status === "CONFIRMED" && (
          <p className="mt-4 text-sm text-green-700">
            Payment confirmed. Your order is being processed.
          </p>
        )}
      </div>

      {/* Error */}
      {apiError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Actions */}
      {!isSettled && !isExpired && (
        <div className="flex gap-3">
          <button
            onClick={confirm}
            disabled={!!actionLoading}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white
              hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {actionLoading === "confirm" ? "Confirming…" : "Confirm purchase"}
          </button>
          <button
            onClick={release}
            disabled={!!actionLoading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium
              text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            {actionLoading === "release" ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      )}

      {(isSettled || isExpired) && (
        <button
          onClick={() => router.push("/")}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium
            text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to products
        </button>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  expired,
}: {
  status: string;
  expired: boolean;
}) {
  if (expired || status === "RELEASED") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        Released
      </span>
    );
  }
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        Confirmed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
      Pending
    </span>
  );
}
