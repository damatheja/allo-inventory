import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Allo — Inventory",
  description: "Multi-warehouse inventory and checkout",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}>
        <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-2">
          <a href="/" className="text-xl font-semibold tracking-tight text-indigo-600 hover:text-indigo-700">
            allo
          </a>
          <span className="text-sm text-gray-400">inventory</span>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
