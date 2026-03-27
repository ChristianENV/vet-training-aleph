"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "?";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return (local + "?").slice(0, 2).toUpperCase();
}

type AppHeaderProps = {
  email: string;
  role: UserRole;
  name?: string | null;
};

export function AppHeader({ email, role, name }: AppHeaderProps) {
  const router = useRouter();
  const display = name?.trim() || email;

  return (
    <header className="bg-background/80 border-border supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 backdrop-blur md:px-6">
      <div className="min-w-0 md:hidden">
        <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">Workspace</p>
      </div>
      <div className="hidden flex-1 md:block" />

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "border-border max-w-full gap-2 pl-1.5 pr-2",
          )}
          aria-label="Account menu"
        >
          <Avatar className="size-7" size="sm">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initialsFromEmail(email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-1 text-left md:block">
            <span className="block truncate text-sm font-medium">{display}</span>
            <span className="text-muted-foreground block truncate text-xs">{role}</span>
          </span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground text-sm font-medium">{email}</span>
                <span className="text-muted-foreground text-xs">Role: {role}</span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void (async () => {
                await signOut({ redirect: false });
                router.push("/login");
                router.refresh();
              })();
            }}
            className="gap-2"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
