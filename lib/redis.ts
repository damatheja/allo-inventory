import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis };

function createRedisClient() {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL not set — distributed locking unavailable");
    return null;
  }
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  client.on("error", (err) => console.error("Redis error:", err));
  return client;
}

export const redis = globalForRedis.redis ?? (createRedisClient() as Redis);
if (process.env.NODE_ENV !== "production" && redis) globalForRedis.redis = redis;

const LOCK_TTL_MS = 5000; // 5 second max hold

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!redis) {
    // No Redis: fall back to DB-level locking via transaction
    return fn();
  }

  const lockKey = `lock:${key}`;
  const token = crypto.randomUUID();

  // Acquire lock with NX + PX (atomic)
  const acquired = await redis.set(lockKey, token, "PX", LOCK_TTL_MS, "NX");
  if (!acquired) {
    throw new LockConflictError(`Could not acquire lock on ${key}`);
  }

  try {
    return await fn();
  } finally {
    // Release lock only if we still own it (Lua script for atomicity)
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(releaseScript, 1, lockKey, token);
  }
}

export class LockConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockConflictError";
  }
}
