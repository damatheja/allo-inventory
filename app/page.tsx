import { ProductList } from "@/components/ProductList";

export const revalidate = 0;

async function getProducts() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_BASE_URL is missing");
  }

  const res = await fetch(`${baseUrl}/api/products`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch products");
  }

  return res.json();
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reserve items to hold them for 10 minutes while you check out.
        </p>
      </div>
      <ProductList initialProducts={products} />
    </div>
  );
}
