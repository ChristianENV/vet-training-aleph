import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { credentialsLoginSchema } from "@/modules/auth/validators";

/**
 * Auth.js (NextAuth v5) — credentials + JWT sessions.
 * Prisma is imported only inside `authorize` (dynamic) so middleware bundles stay Edge-safe.
 * TODO: add rate limiting, account lockout, and refresh-token strategy if needed.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { prisma } = await import("@/lib/db/prisma");
        const bcrypt = await import("bcrypt");

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
            console.error(
              "[auth] Prisma P2021: a required table is missing. Apply migrations to the same DATABASE_URL this app uses: npx prisma migrate deploy (or migrate dev), then npm run db:seed. Restart next dev after changing .env.",
            );
            throw new Error(
              "Database schema is not applied for this DATABASE_URL. Run `npx prisma migrate deploy` (or `migrate dev`), then `npm run db:seed`, and restart the dev server.",
            );
          }
          throw e;
        }

        if (!user) return null;
        if (!user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
            console.error(
              "[auth] Prisma P2021 on user update — same fix as findUnique: migrate + seed against DATABASE_URL.",
            );
            throw new Error(
              "Database schema is not applied for this DATABASE_URL. Run `npx prisma migrate deploy` (or `migrate dev`), then `npm run db:seed`, and restart the dev server.",
            );
          }
          throw e;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role as UserRole,
          isProtectedAccount: user.isProtectedAccount,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email ?? "";
        token.role = user.role;
        token.isProtectedAccount = user.isProtectedAccount;
        token.isActive = user.isActive;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = typeof token.email === "string" ? token.email : "";
        session.user.role = token.role as UserRole;
        session.user.isProtectedAccount = Boolean(token.isProtectedAccount);
        session.user.isActive = Boolean(token.isActive ?? true);
      }
      return session;
    },
  },
});
