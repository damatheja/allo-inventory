# Allo Inventory — Take-Home Exercise

A Next.js inventory and reservation platform for multi-warehouse retail. Customers can reserve stock during checkout, with automatic expiry if payment doesn't complete.

## Running locally

### Prerequisites
- Node.js 18+
- Hosted Postgres (Supabase, Neon, or Railway)
- Optionally: Redis (Upstash) for distributed locking

### Setup

```bash
git clone <repo-url>
cd allo-inventory
npm install
cp .env.example .env.local
# Fill in DATABASE_URL and optionally REDIS_URL
npx prisma migrate dev
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
npm run dev
```

Open http://localhost:3000.

---

## How the reservation works

### Race-condition safety

Two concurrent requests for the last unit of a SKU must not both succeed. I handle this at two layers:

**Layer 1 — Distributed lock (Redis)**

When a reservation arrives, we acquire a Redis lock on `stock:<id>` using `SET NX PX` (atomic). Only one request holds the lock per stock row at a time. Inside the lock, we re-read `reserved` from Postgres (fresh value), check availability, then increment `reserved` + create the reservation in a single `$transaction`.

Lock release uses a Lua script that checks we still own the token before deleting, so a slow request can't accidentally release a lock it no longer holds.

**Layer 2 — Prisma transaction (fallback)**

If Redis is unavailable, the Prisma `$transaction` still provides isolation at the DB level. This is sufficient for moderate traffic; Redis adds headroom for bursts without retrying at the DB.

### Expiry mechanism (production)

A **Vercel Cron job** hits `GET /api/cron/release-expired` every minute. It finds all `PENDING` reservations past `expiresAt`, then for each runs a transaction: `status = RELEASED` + `reserved -= quantity`.

**Lazy cleanup fallback**: `GET /api/products` also calls `releaseExpiredReservations()` before computing available counts. So even if the cron is delayed, a page load will clear stale holds.

Trade-off: reservations can remain held for up to ~1 minute past expiry. An alternative is treating `expiresAt < now()` as implicitly released in every query, removing the async gap at the cost of more query complexity.

---

## Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header.

1. On arrival, look up the key in the `IdempotencyKey` table.
2. If found, replay the stored response (including HTTP status) without repeating the side effect.
3. If not found, proceed normally; store the result after.

The stored `responseBody` JSON includes a `_status` field for replay. There's a small race if two identical requests arrive simultaneously before either stores the key — the Redis lock prevents both from producing a reservation, but I'd use Redis `SETNX` to gate the idempotency check atomically in production.

---

## Trade-offs and what I'd do differently

**Kept simple:**
- No auth — a real system ties reservations to user sessions
- Quantity hardcoded to 1 in UI (API accepts any quantity)
- Confirm button simulates payment succeeding instantly, no real payment provider

**With more time:**
- SWR/React Query for optimistic product list updates
- Proper payment webhook (Stripe/Razorpay) triggering confirm/release
- Rate limiting per user/IP on the reservation endpoint
- `SELECT FOR UPDATE SKIP LOCKED` + worker queue for extreme throughput

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| ORM | Prisma |
| Database | Postgres (Neon/Supabase) |
| Locking | Redis via ioredis (Upstash) |
| Validation | Zod |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| Cron | Vercel Cron (every minute) |
