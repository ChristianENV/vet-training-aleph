"use client";

import { cn } from "@/lib/utils";
import type { MainNavItem } from "@/lib/auth/nav";
import { BookOpen, LayoutDashboard, LineChart, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const iconForHref = (href: string) => {
  switch (href) {
    case "/dashboard":
      return LayoutDashboard;
    case "/sessions":
      return BookOpen;
    case "/analyses":
      return LineChart;
    case "/users":
      return Users;
    default:
      return LayoutDashboard;
  }
};

type MainNavLinksProps = {
  items: MainNavItem[];
  /** Called after a nav item is activated (e.g. close mobile drawer). */
  onNavigate?: () => void;
  /** Larger touch targets and type for drawer. */
  variant?: "sidebar" | "drawer";
};

export function MainNavLinks({ items, onNavigate, variant = "sidebar" }: MainNavLinksProps) {
  const pathname = usePathname();
  const isDrawer = variant === "drawer";

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const Icon = iconForHref(item.href);
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg font-medium transition-colors",
              isDrawer ? "min-h-12 px-4 py-3 text-base" : "px-3 py-2 text-sm",
              active
                ? "bg-accent text-accent-foreground border border-brand-cyan-600/15"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("shrink-0 opacity-80", isDrawer ? "size-5" : "size-4")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
