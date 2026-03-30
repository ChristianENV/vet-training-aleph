"use client";

import type { MainNavItem } from "@/lib/auth/nav";
import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { MainNavLinks } from "./main-nav-links";

type DesktopSidebarProps = {
  items: MainNavItem[];
};

/**
 * Desktop (lg+): fixed column shell — sticky viewport-height sidebar with internal scroll if needed.
 */
export function DesktopSidebar({ items }: DesktopSidebarProps) {
  return (
    <aside
      className="bg-card border-border hidden w-56 shrink-0 border-r lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:max-h-screen lg:flex-col lg:self-start"
      aria-label="Main navigation"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="flex flex-col gap-6">
            <Link
              href="/dashboard"
              className="hover:bg-accent/60 -m-1 block rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BrandMark variant="sidebar" />
              <p className="text-muted-foreground mt-2 text-[10px] font-medium tracking-widest uppercase">
                Training workspace
              </p>
            </Link>
            <MainNavLinks items={items} variant="sidebar" />
          </div>
        </div>
      </div>
    </aside>
  );
}
