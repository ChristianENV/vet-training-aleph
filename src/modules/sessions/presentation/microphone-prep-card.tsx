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
    <Card className="border-muted-foreground/20">
      <CardHeader>
        <CardTitle className="text-base">Prepare your microphone</CardTitle>
        <CardDescription>
          This practice uses short voice answers. We need access to your microphone before we create your
          prompts—nothing is recorded during this step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "permission_denied" ? (
          <p className="text-sm leading-relaxed" role="alert">
            Microphone access is turned off for this site. Allow the microphone in your browser settings for
            this page, then try again.
          </p>
        ) : null}

        {status === "no_microphone" ? (
          <p className="text-sm leading-relaxed" role="alert">
            We couldn&apos;t find a microphone. Plug one in or enable your built-in mic, then try again.
          </p>
        ) : null}

        {status === "failed" && detailMessage ? (
          <p className="text-sm leading-relaxed" role="alert">
            {detailMessage}
          </p>
        ) : null}

        {status === "failed" && !detailMessage ? (
          <p className="text-sm leading-relaxed" role="alert">
            Something went wrong while checking your microphone. You can try again.
          </p>
        ) : null}

        {status === "ready" ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm"
            role="status"
          >
            <CheckCircle2 className="text-emerald-600 mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              Your microphone is ready. When you continue, we&apos;ll build your spoken prompts—this may take a
              few seconds.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {status !== "ready" ? (
            <Button type="button" onClick={onCheckMicrophone} disabled={checking || starting}>
              <Mic className="mr-2 size-4" aria-hidden />
              {checking ? "Checking…" : showRetry && status !== "idle" ? "Try again" : "Check microphone"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant={status === "ready" ? "default" : "secondary"}
            disabled={status !== "ready" || starting}
            onClick={onContinue}
          >
            {starting ? "Starting…" : "Continue to oral prompts"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
