"use client"

import { cn } from "@/lib/utils"

export type VoiceState = "idle" | "listening" | "thinking" | "speaking"

interface VoiceOrbProps {
  state: VoiceState
  className?: string
}

export function VoiceOrb({ state, className }: VoiceOrbProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer glow rings */}
      <div
        className={cn(
          "absolute size-64 rounded-full transition-all duration-1000",
          state === "idle" && "bg-white/[0.02]",
          state === "listening" && "bg-cyan-500/10 animate-pulse",
          state === "thinking" && "bg-amber-500/10 animate-pulse",
          state === "speaking" && "bg-emerald-500/10 animate-pulse"
        )}
      />
      <div
        className={cn(
          "absolute size-52 rounded-full transition-all duration-700",
          state === "idle" && "bg-white/[0.03]",
          state === "listening" && "bg-cyan-500/15",
          state === "thinking" && "bg-amber-500/15",
          state === "speaking" && "bg-emerald-500/15"
        )}
        style={{
          animation: state !== "idle" ? "pulse 2s ease-in-out infinite 0.2s" : undefined,
        }}
      />
      <div
        className={cn(
          "absolute size-40 rounded-full transition-all duration-500",
          state === "idle" && "bg-white/[0.04]",
          state === "listening" && "bg-cyan-500/20",
          state === "thinking" && "bg-amber-500/20",
          state === "speaking" && "bg-emerald-500/20"
        )}
        style={{
          animation: state !== "idle" ? "pulse 2s ease-in-out infinite 0.4s" : undefined,
        }}
      />

      {/* Main orb */}
      <div
        className={cn(
          "relative size-32 rounded-full transition-all duration-500",
          "shadow-2xl",
          state === "idle" && "bg-gradient-to-br from-zinc-700 to-zinc-900",
          state === "listening" && "bg-gradient-to-br from-cyan-400 to-cyan-600",
          state === "thinking" && "bg-gradient-to-br from-amber-400 to-amber-600",
          state === "speaking" && "bg-gradient-to-br from-emerald-400 to-emerald-600"
        )}
        style={{
          boxShadow:
            state === "idle"
              ? "0 0 60px rgba(255, 255, 255, 0.05)"
              : state === "listening"
                ? "0 0 80px rgba(34, 211, 238, 0.4)"
                : state === "thinking"
                  ? "0 0 80px rgba(251, 191, 36, 0.4)"
                  : "0 0 80px rgba(52, 211, 153, 0.4)",
        }}
      >
        {/* Inner highlight */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
        
        {/* Center reflection */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 size-4 rounded-full bg-white/40 blur-sm" />

        {/* Animated ring for active states */}
        {state !== "idle" && (
          <div
            className={cn(
              "absolute -inset-1 rounded-full border-2 animate-spin",
              state === "listening" && "border-cyan-400/50 border-t-transparent",
              state === "thinking" && "border-amber-400/50 border-t-transparent border-b-transparent",
              state === "speaking" && "border-emerald-400/50 border-t-transparent"
            )}
            style={{
              animationDuration: state === "thinking" ? "1s" : "3s",
            }}
          />
        )}
      </div>

      {/* Particle effects for speaking */}
      {state === "speaking" && (
        <>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute size-2 rounded-full bg-emerald-400/60"
              style={{
                animation: `float 2s ease-in-out infinite ${i * 0.3}s`,
                top: `${40 + Math.sin(i) * 20}%`,
                left: `${40 + Math.cos(i) * 20}%`,
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
