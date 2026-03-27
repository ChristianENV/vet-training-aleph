import type { ReactNode } from "react";

/** Consistent loading / empty hints for client data views. */

export function QueryLoadingHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
      {children}
    </p>
  );
}

export function QueryErrorHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-destructive text-sm" role="alert">
      {children}
    </p>
  );
}
