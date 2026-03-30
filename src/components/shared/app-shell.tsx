"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getVisibleNavItems } from "@/lib/auth/nav";
import type { UserRole } from "@/generated/prisma/enums";
import { AppHeader } from "./app-header";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileNavDrawer } from "./mobile-nav-drawer";

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
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="bg-background flex min-h-screen flex-col lg:flex-row">
      <DesktopSidebar items={navItems} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader
          email={user.email}
          role={user.role}
          name={user.name}
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={() => setMobileNavOpen((o) => !o)}
        />
        <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} items={navItems} />
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
