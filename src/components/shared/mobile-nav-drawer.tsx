"use client";

import type { MainNavItem } from "@/lib/auth/nav";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandMark } from "./brand-mark";
import { MainNavLinks } from "./main-nav-links";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MainNavItem[];
};

/**
 * Mobile (below lg): left off-canvas navigation with backdrop; closes via overlay, close button, or
 * after navigation.
 */
export function MobileNavDrawer({ open, onOpenChange, items }: MobileNavDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex h-full max-h-[100dvh] w-[min(100%,20rem)] flex-col gap-0 p-0 sm:max-w-sm"
        showCloseButton
      >
        <SheetHeader className="border-border bg-muted/20 shrink-0 space-y-1 border-b px-4 py-4 text-left">
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Primary navigation links for the training workspace.
          </SheetDescription>
          <Link
            href="/dashboard"
            onClick={() => onOpenChange(false)}
            className="hover:bg-accent/50 -m-1 block rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandMark variant="drawer" />
            <p className="text-muted-foreground mt-2 text-[10px] font-medium tracking-widest uppercase">
              Training workspace
            </p>
          </Link>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <MainNavLinks items={items} variant="drawer" onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
