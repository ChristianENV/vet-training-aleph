import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type LoadingStateProps = {
  /** Visible title (also used for screen readers when `embedded`). */
  title: string;
  /** Supporting line under the title. */
  description?: string;
  /** Optional contextual tip (lighter, smaller). */
  hint?: string;
  /**
   * `inline` — bordered panel for sections and lists.
   * `fullscreen` — centered block suitable for initial page/data loads (not `position: fixed`).
   */
  layout?: "inline" | "fullscreen";
  /** `sm` — denser; `md` — default emphasis. */
  size?: "sm" | "md";
  /**
   * Use inside a `Card` (or similar) that already has a title/description.
   * Renders a compact row: spinner + optional hint only.
   */
  embedded?: boolean;
  className?: string;
};

/**
 * Polished loading UI: spinner, hierarchy, optional hint — navy/cyan system.
 */
export function LoadingState({
  title,
  description,
  hint,
  layout = "inline",
  size = "md",
  embedded = false,
  className,
}: LoadingStateProps) {
  if (embedded) {
    return (
      <div
        className={cn("flex items-start gap-3", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{title}</span>
        <Loader2
          className={cn(
            "text-brand-cyan-600 shrink-0 animate-spin",
            size === "sm" ? "size-5" : "size-6",
          )}
          aria-hidden
        />
        {hint ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{hint}</p>
        ) : description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
    );
  }

  const isFullscreen = layout === "fullscreen";
  const titleClass =
    size === "sm"
      ? "text-brand-navy-900 text-sm font-semibold tracking-tight"
      : "text-brand-navy-900 text-base font-semibold tracking-tight sm:text-lg";

  return (
    <div
      className={cn(
        "border-border/80 bg-muted/15 flex flex-col items-center text-center",
        isFullscreen
          ? "min-h-[min(52vh,440px)] w-full justify-center rounded-xl border px-6 py-12 sm:px-10"
          : "rounded-xl border px-5 py-8 sm:px-8",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className={cn(
          "text-brand-cyan-600 mb-5 animate-spin",
          size === "sm" ? "size-7" : "size-9",
        )}
        aria-hidden
      />
      <h2 className={cn(titleClass, "max-w-md")}>{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed sm:text-[0.9375rem]">
          {description}
        </p>
      ) : null}
      {hint ? (
        <p className="text-muted-foreground/90 mt-3 max-w-md text-xs leading-relaxed sm:text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
