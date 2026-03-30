"use client";

import { CheckCircle2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MicrophonePreflightStatus } from "@/hooks/use-microphone-preflight";

type Props = {
  status: MicrophonePreflightStatus;
  detailMessage: string | null;
  checking: boolean;
  starting: boolean;
  onCheckMicrophone: () => void;
  onContinue: () => void;
};

export function MicrophonePrepCard({
  status,
  detailMessage,
  checking,
  starting,
  onCheckMicrophone,
  onContinue,
}: Props) {
  const showRetry =
    status === "permission_denied" ||
    status === "no_microphone" ||
    status === "failed" ||
    status === "idle";

  return (
    <Card className="border-brand-navy-600/10 overflow-hidden shadow-md">
      <CardHeader className="bg-muted/25 border-b border-border/60 space-y-3 pb-5">
        <p className="text-brand-cyan-700 text-[0.6875rem] font-semibold tracking-wide uppercase dark:text-brand-cyan-500">
          Audio check
        </p>
        <CardTitle className="text-brand-navy-900 text-lg font-semibold tracking-tight">
          Prepare your microphone
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm leading-relaxed">
          This assessment uses short spoken answers. We only verify access here — nothing is recorded until you
          start the prompts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {status === "permission_denied" ? (
          <p
            className="text-foreground border-warning-500/25 bg-warning-100/80 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
            role="alert"
          >
            Microphone access is turned off for this site. Allow the microphone in your browser settings for this
            page, then try again.
          </p>
        ) : null}

        {status === "no_microphone" ? (
          <p
            className="text-foreground border-warning-500/25 bg-warning-100/80 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
            role="alert"
          >
            We couldn&apos;t find a microphone. Plug one in or enable your built-in mic, then try again.
          </p>
        ) : null}

        {status === "failed" && detailMessage ? (
          <p
            className="text-foreground border-border bg-muted/40 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
            role="alert"
          >
            {detailMessage}
          </p>
        ) : null}

        {status === "failed" && !detailMessage ? (
          <p
            className="text-foreground border-border bg-muted/40 rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
            role="alert"
          >
            Something went wrong while checking your microphone. You can try again.
          </p>
        ) : null}

        {status === "ready" ? (
          <div
            className="border-success-500/25 bg-success-100 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
            role="status"
          >
            <CheckCircle2 className="text-success-500 mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              Your microphone is ready. When you continue, we&apos;ll build your spoken prompts—this may take a
              few seconds.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          {status !== "ready" ? (
            <Button type="button" onClick={onCheckMicrophone} disabled={checking || starting}>
              <Mic className="mr-2 size-4" aria-hidden />
              {checking ? "Checking…" : showRetry && status !== "idle" ? "Try again" : "Check microphone"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant={status === "ready" ? "default" : "secondary"}
            className="sm:min-w-[12rem]"
            disabled={status !== "ready" || starting}
            onClick={onContinue}
          >
            {starting ? "Starting…" : "Continue to prompts"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
