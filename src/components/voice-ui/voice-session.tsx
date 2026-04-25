"use client"

import { useState, useEffect } from "react"
import { VoiceOrb, type VoiceState } from "@/components/voice-orb"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, PhoneOff, MessageSquare, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceSessionProps {
  onEnd: () => void
}

const mockTranscripts = [
  { role: "assistant" as const, text: "Hello! I'm ready to help you today. What would you like to discuss?" },
  { role: "user" as const, text: "Hi, I'd like to learn more about voice interfaces." },
  { role: "assistant" as const, text: "Voice interfaces are fascinating! They allow natural conversation between humans and AI..." },
]

export function VoiceSession({ onEnd }: VoiceSessionProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const [isConnected, setIsConnected] = useState(true)
  const [currentTranscript, setCurrentTranscript] = useState(mockTranscripts[0])

  // Simulate voice state changes for demo
  useEffect(() => {
    if (!isConnected) return

    const states: VoiceState[] = ["idle", "listening", "thinking", "speaking"]
    let index = 0
    let transcriptIndex = 0

    const interval = setInterval(() => {
      index = (index + 1) % states.length
      setVoiceState(states[index])

      // Update transcript periodically
      if (index === 3) {
        transcriptIndex = (transcriptIndex + 1) % mockTranscripts.length
        setCurrentTranscript(mockTranscripts[transcriptIndex])
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [isConnected])

  const statusConfig = {
    idle: { label: "Ready", color: "bg-zinc-500" },
    listening: { label: "Listening", color: "bg-cyan-500" },
    thinking: { label: "Thinking", color: "bg-amber-500" },
    speaking: { label: "Speaking", color: "bg-emerald-500" },
  }

  const status = statusConfig[voiceState]

  return (
    <main className="min-h-dvh flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-foreground">Voice Session</h1>
        </div>
        
        {/* Status pill */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
            isConnected ? "bg-secondary" : "bg-destructive/20"
          )}
        >
          {isConnected ? (
            <>
              <span
                className={cn(
                  "size-2 rounded-full transition-colors duration-300",
                  status.color
                )}
              />
              <span className="text-secondary-foreground">{status.label}</span>
            </>
          ) : (
            <>
              <AlertCircle className="size-3 text-destructive-foreground" />
              <span className="text-destructive-foreground">Disconnected</span>
            </>
          )}
        </div>
      </header>

      {/* Main content area with orb */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <VoiceOrb state={isConnected ? voiceState : "idle"} className="mb-8" />
      </div>

      {/* Transcript area */}
      {showTranscript && (
        <div className="px-6 pb-4">
          <div className="max-w-md mx-auto bg-secondary/50 rounded-2xl p-4 min-h-[80px] flex items-center justify-center">
            {isConnected ? (
              <p
                className={cn(
                  "text-sm text-center leading-relaxed transition-all duration-300",
                  currentTranscript.role === "assistant"
                    ? "text-foreground"
                    : "text-muted-foreground italic"
                )}
              >
                {currentTranscript.role === "user" && (
                  <span className="text-muted-foreground/60 mr-1">You:</span>
                )}
                {currentTranscript.text}
              </p>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                Connection lost. Please check your internet and try again.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4">
          {/* Transcript toggle */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setShowTranscript(!showTranscript)}
            className={cn(
              "size-12 rounded-full transition-all",
              showTranscript && "bg-accent ring-2 ring-accent-foreground/10"
            )}
          >
            <MessageSquare className="size-5" />
            <span className="sr-only">Toggle transcript</span>
          </Button>

          {/* Mute/unmute */}
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="size-14 rounded-full transition-all"
          >
            {isMuted ? (
              <MicOff className="size-6" />
            ) : (
              <Mic className="size-6" />
            )}
            <span className="sr-only">{isMuted ? "Unmute" : "Mute"}</span>
          </Button>

          {/* End session */}
          <Button
            variant="destructive"
            size="icon"
            onClick={onEnd}
            className="size-12 rounded-full"
          >
            <PhoneOff className="size-5" />
            <span className="sr-only">End session</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
