"use client";

import { getVisibleNavItems } from "@/lib/auth/nav";
import type { UserRole } from "@/generated/prisma/enums";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

type AppShellUser = {
  email: string;
  role: UserRole;
  name?: string | null;
};

type AppShellProps = {
  children: React.ReactNode;
  user: AppShellUser;
};

export function AppShell({ children, user }: AppShellProps) {
  const navItems = getVisibleNavItems(user.role);

  return (
    <div className="bg-background flex min-h-screen flex-col md:flex-row">
      <AppSidebar items={navItems} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader email={user.email} role={user.role} name={user.name} />
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
