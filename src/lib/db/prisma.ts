import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/config/env";

/**
 * Prisma ORM 7 uses a driver adapter for PostgreSQL. Access only from Node runtimes (route handlers, server actions).
 * TODO: switch to an explicit `pg.Pool` if you need pool tuning; pass `PoolConfig` here for the MVP scaffold.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getServerEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  return new PrismaClient({ adapter });
}

/**
 * In production, reuse one client on `globalThis` (avoids exhausting connections on hot/serverless).
 * In development, avoid caching on `globalThis`: after `prisma generate`, a stale client would keep the
 * old schema until process restart; a fresh instance tracks the regenerated `src/generated/prisma` client.
 */
export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : createPrismaClient();
