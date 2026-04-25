"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type MicStatus = "checking" | "ready" | "denied" | "unavailable"

interface StartScreenProps {
  micStatus: MicStatus
  onStart: () => void
  onRetry: () => void
}

export function StartScreen({ micStatus, onStart, onRetry }: StartScreenProps) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center text-center max-w-sm w-full gap-8">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="size-20 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-2xl">
            <Mic className="size-8 text-zinc-300" />
          </div>
          <div className="absolute -inset-2 rounded-full bg-white/5 -z-10" />
        </div>

        {/* Title and description */}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Voice session
          </h1>
          <p className="text-muted-foreground leading-relaxed text-balance">
            {"You'll speak naturally with the AI assistant. It will listen, respond, and guide you through the session."}
          </p>
        </div>

        {/* Microphone status */}
        <div className="w-full">
          {micStatus === "checking" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="size-4 animate-spin" />
              <span>Checking microphone...</span>
            </div>
          )}

          {micStatus === "ready" && (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-400 py-3">
              <Mic className="size-4" />
              <span>Microphone ready</span>
            </div>
          )}

          {(micStatus === "denied" || micStatus === "unavailable") && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-destructive-foreground">
                <MicOff className="size-4" />
                <span>
                  {micStatus === "denied" 
                    ? "Microphone access denied" 
                    : "No microphone detected"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {micStatus === "denied"
                  ? "Please allow microphone access in your browser settings to continue."
                  : "Please connect a microphone to continue."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="w-full"
              >
                <RefreshCw className="size-3.5 mr-2" />
                Try again
              </Button>
            </div>
          )}
        </div>

        {/* Start button */}
        <Button
          size="lg"
          onClick={onStart}
          disabled={micStatus !== "ready"}
          className={cn(
            "w-full h-14 text-base font-medium rounded-xl transition-all duration-300",
            micStatus === "ready" && "shadow-lg shadow-primary/20"
          )}
        >
          Start session
        </Button>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground/60">
          Your voice is processed securely and never stored.
        </p>
      </div>
    </main>
  )
}
