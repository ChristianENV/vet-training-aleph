"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "?";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return (local + "?").slice(0, 2).toUpperCase();
}

function initialsFromUser(name: string | null | undefined, email: string): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    if (n.length >= 2) return n.slice(0, 2).toUpperCase();
    if (n.length === 1) return `${n[0] ?? "?"}?`.toUpperCase();
  }
  return initialsFromEmail(email);
}

export type AccountMenuProps = {
  email: string;
  name?: string | null;
};

/**
 * Compact account trigger (avatar + optional name + chevron) and a polished identity dropdown.
 */
export function AccountMenu({ email, name }: AccountMenuProps) {
  const router = useRouter();
  const trimmedName = name?.trim();
  const triggerLabel = trimmedName || email;
  const identityTitle = trimmedName || email;
  const showEmailInPanel = Boolean(trimmedName);
  const initials = initialsFromUser(name, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "group/account-trigger text-foreground",
          "inline-flex h-10 max-w-full min-w-0 shrink-0 items-center gap-2 rounded-xl px-2",
          "border-0 bg-transparent shadow-none outline-none",
          "transition-colors",
          "hover:bg-muted/50 active:bg-muted/65",
          "data-[popup-open]:bg-muted/40",
          "focus-visible:ring-ring/45 focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        aria-label="Account menu"
        aria-haspopup="menu"
      >
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-primary/12 text-primary text-[0.8125rem] font-semibold tracking-tight">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "hidden min-w-0 flex-1 truncate text-left text-sm font-semibold leading-none sm:block",
            "max-w-[9rem] md:max-w-[11rem] lg:max-w-[13.5rem]",
          )}
        >
          {triggerLabel}
        </span>
        <ChevronDownIcon
          className="text-muted-foreground size-3.5 shrink-0 opacity-80 transition-transform duration-200 ease-out group-data-[popup-open]/account-trigger:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="border-border/80 w-[min(17.5rem,calc(100vw-1rem))] overflow-hidden rounded-xl p-0 shadow-lg ring-1 ring-foreground/10"
      >
        <div className="border-border/80 bg-muted/20 border-b px-4 py-3.5">
          <p className="text-foreground truncate text-sm font-semibold leading-snug">{identityTitle}</p>
          {showEmailInPanel ? (
            <p className="text-muted-foreground mt-1 truncate text-xs leading-relaxed">{email}</p>
          ) : null}
        </div>
        <div className="p-1.5">
          <DropdownMenuItem
            onClick={() => {
              void (async () => {
                await signOut({ redirect: false });
                router.push("/login");
                router.refresh();
              })();
            }}
            className="gap-2 rounded-lg py-2.5 text-sm"
          >
            <LogOutIcon className="size-4 opacity-80" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
