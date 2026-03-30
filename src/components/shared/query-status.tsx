import type { ReactNode } from "react";

/** Consistent loading / empty hints for client data views. */

export function QueryLoadingHint({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-muted-foreground bg-muted/30 border-border/80 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
      role="status"
      aria-live="polite"
    >
      {children}
    </p>
  );
}

export function QueryErrorHint({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-destructive border-destructive/25 bg-error-100/60 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
      role="alert"
    >
      {children}
    </p>
  );
}
