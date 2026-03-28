/**
 * Prisma CLI and `prisma/seed.ts` run outside Next.js, which only auto-loads `.env` via `dotenv/config`.
 * Mirror Next.js behavior: load `.env`, then `.env.local` (override).
 */
import { config } from "dotenv";
import { resolve } from "node:path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
