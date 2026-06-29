"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StockInfo = {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reserved: number;
  available: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: string;
  stocks: StockInfo[];
};

export function ProductList({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // stockId being reserved

  async function reserve(productId: string, warehouseId: string, stockId: string) {
    setLoading(stockId);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setError(data.error || "Not enough stock available.");
        return;
      }

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      router.push(`/reservations/${data.id}`);
    } finally {
      setLoading(null);
    }
  }

  const totalAvailable = (p: Product) =>
    p.stocks.reduce((sum, s) => sum + s.available, 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {initialProducts.map((product) => (
        <div
          key={product.id}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold">{product.name}</h2>
                <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {product.sku}
                </span>
                {totalAvailable(product) === 0 && (
                  <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    Out of stock
                  </span>
                )}
              </div>
              {product.description && (
                <p className="mt-1 text-sm text-gray-500">{product.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-semibold text-gray-900">
                ₹{Number(product.price).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {product.stocks.map((stock) => (
              <div
                key={stock.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{stock.warehouseName}</p>
                  <p className="text-xs text-gray-400">{stock.warehouseLocation}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      <span
                        className={
                          stock.available === 0
                            ? "text-red-500"
                            : stock.available <= 3
                            ? "text-amber-600"
                            : "text-green-600"
                        }
                      >
                        {stock.available}
                      </span>
                      <span className="text-gray-400"> / {stock.totalUnits}</span>
                    </p>
                    <p className="text-xs text-gray-400">available</p>
                  </div>
                  <button
                    onClick={() =>
                      reserve(product.id, stock.warehouseId, stock.id)
                    }
                    disabled={stock.available === 0 || loading === stock.id}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                      hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                      transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {loading === stock.id ? "Reserving…" : "Reserve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
