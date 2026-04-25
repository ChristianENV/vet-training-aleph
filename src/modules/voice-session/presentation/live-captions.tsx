"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VoiceTranscriptTurn } from "@/modules/voice-session/domain/transcript-model";

type Props = {
  text: string;
  turn?: VoiceTranscriptTurn | null;
};

export function LiveCaptions({ text, turn }: Props) {
  return (
    <Card className="border-border/80 bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight">Live captions</CardTitle>
      </CardHeader>
      <CardContent>
        {turn ? (
          <p className="text-muted-foreground mb-1 text-xs">
            {turn.speaker} · {turn.isInterim ? "interim" : "final"}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}

