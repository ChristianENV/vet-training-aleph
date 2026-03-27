import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      email: string;
      role: UserRole;
      isProtectedAccount: boolean;
      isActive: boolean;
    };
  }

  interface User {
    role?: UserRole;
    isProtectedAccount?: boolean;
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string;
    role?: UserRole;
    isProtectedAccount?: boolean;
    isActive?: boolean;
  }
}
