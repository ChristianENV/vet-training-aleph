"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { VoiceTranscriptTurn } from "@/modules/voice-session/domain/transcript-model";

type Props = {
  open: boolean;
  turns: VoiceTranscriptTurn[];
  onClose: () => void;
};

export function TranscriptDrawer({ open, turns, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" className="w-full max-w-xl">
        <SheetHeader>
          <SheetTitle>Session transcript</SheetTitle>
          <SheetDescription>
            Live transcript plumbing for voice session turns (interim and final).
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-4">
          {turns.map((turn) => (
            <article key={turn.id} className="border-border/70 rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant={turn.speaker === "assistant" ? "secondary" : "outline"}>
                  {turn.speaker === "assistant"
                    ? "Assistant"
                    : turn.speaker === "user"
                      ? "User"
                      : "System"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {new Date(turn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{turn.text}</p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {turn.isInterim ? "interim" : "final"}
              </p>
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

