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

type AppSidebarProps = {
  items: MainNavItem[];
};

export function AppSidebar({ items }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="bg-card border-border flex w-full shrink-0 flex-col border-b md:h-screen md:w-56 md:border-r md:border-b-0">
      <div className="flex flex-col gap-6 p-4 md:flex-1 md:overflow-y-auto">
        <Link href="/dashboard" className="hover:bg-accent/50 -m-1 rounded-lg p-1 transition-colors">
          <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">Vet English</p>
          <p className="text-foreground font-semibold tracking-tight">Training</p>
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {items.map((item) => {
            const Icon = iconForHref(item.href);
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
