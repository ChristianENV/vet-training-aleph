"use client";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/generated/prisma/enums";
import { AccountMenu } from "@/components/shared/account-menu";
import { BrandMark } from "@/components/shared/brand-mark";
import { Menu } from "lucide-react";
import Link from "next/link";

type AppHeaderProps = {
  email: string;
  role: UserRole;
  name?: string | null;
  /** Toggles the mobile navigation drawer (below `lg`). */
  onToggleMobileNav?: () => void;
  /** Controlled state for `aria-expanded` on the menu control. */
  mobileNavOpen?: boolean;
};

export function AppHeader({ email, role: _role, name, onToggleMobileNav, mobileNavOpen = false }: AppHeaderProps) {
  return (
    <header className="bg-background/90 border-border supports-[backdrop-filter]:bg-background/75 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur-md sm:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileNavOpen}
          onClick={() => onToggleMobileNav?.()}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
        <Link
          href="/dashboard"
          className="hover:opacity-90 min-w-0 shrink py-1 transition-opacity focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandMark variant="header" className="min-w-0" />
        </Link>
      </div>

      <div className="hidden flex-1 lg:block" aria-hidden />

      <AccountMenu email={email} name={name} />
    </header>
  );
}
