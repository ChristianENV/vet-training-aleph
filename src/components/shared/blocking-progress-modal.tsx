"use client";

import { useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BlockingProgressModalStep = {
  id: string;
  label: string;
};

export function BlockingProgressModal({
  open,
  title,
  description,
  steps,
  currentStepIndex,
}: {
  open: boolean;
  title: string;
  description: string;
  steps: BlockingProgressModalStep[];
  currentStepIndex: number;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-border/80 bg-background/95 p-5 shadow-[0_16px_60px_-20px_rgba(22,36,63,0.28)]",
        )}
      >
        <div className="flex items-start gap-3">
          <Loader2 className="text-brand-cyan-600 size-7 animate-spin" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-brand-navy-900 text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="mt-4">
          <ol className="space-y-2" aria-label="Progress steps">
            {steps.map((s, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full border text-[0.7rem] font-semibold",
                      isDone
                        ? "border-success-500/60 bg-success-500/15 text-success-500"
                        : isCurrent
                          ? "border-brand-cyan-600/60 bg-brand-cyan-600/10 text-brand-cyan-600"
                          : "border-border/70 bg-muted/25 text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {isDone ? <Check className="size-3.5" /> : isCurrent ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  </span>
                  <span className={cn("text-sm", isCurrent ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

