"use client";

type RealtimeBootstrap = {
  ephemeralKey: string;
  model: string;
};

type RealtimeCallbacks = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (message: string) => void;
  onUserTranscriptInterim?: (text: string) => void;
  onUserTranscriptFinal?: (text: string) => void;
  onAssistantTranscriptInterim?: (text: string) => void;
  onAssistantTranscriptFinal?: (text: string) => void;
  onAssistantSpeakingState?: (speaking: boolean) => void;
  onTransportInterrupted?: () => void;
};

export class OpenAiRealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private callbacks: RealtimeCallbacks = {};
  private disconnectedNotified = false;

  async connect(input: {
    bootstrap: RealtimeBootstrap;
    micStream: MediaStream;
    callbacks: RealtimeCallbacks;
  }) {
    this.callbacks = input.callbacks;
    this.disconnectedNotified = false;

    const pc = new RTCPeerConnection();
    this.pc = pc;

    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;
    this.remoteAudio.playsInline = true;

    pc.ontrack = (ev) => {
      if (!this.remoteAudio) return;
      this.remoteAudio.srcObject = ev.streams[0];
      void this.remoteAudio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") this.callbacks.onConnected?.();
      if (state === "failed" || state === "disconnected") this.callbacks.onTransportInterrupted?.();
      if (state === "closed") this.notifyDisconnected();
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "failed" || state === "disconnected") {
        this.callbacks.onTransportInterrupted?.();
      }
    };

    for (const track of input.micStream.getAudioTracks()) {
      pc.addTrack(track, input.micStream);
    }

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (ev) => this.handleServerEvent(ev.data);
    dc.onerror = () => this.callbacks.onError?.("Realtime data channel error.");
    dc.onclose = () => this.notifyDisconnected();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(input.bootstrap.model)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.bootstrap.ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!sdpRes.ok) {
      const text = await sdpRes.text();
      throw new Error(`Realtime SDP exchange failed: ${sdpRes.status} ${text.slice(0, 400)}`);
    }

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });
  }

  sendClientEvent(event: unknown) {
    if (!this.dc || this.dc.readyState !== "open") return;
    this.dc.send(JSON.stringify(event));
  }

  interruptAssistant() {
    this.sendClientEvent({ type: "response.cancel" });
  }

  pauseAssistantAudio() {
    this.remoteAudio?.pause();
    this.callbacks.onAssistantSpeakingState?.(false);
  }

  resumeAssistantAudio() {
    void this.remoteAudio?.play().catch(() => {});
    this.callbacks.onAssistantSpeakingState?.(true);
  }

  disconnect() {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }
    this.notifyDisconnected();
  }

  private notifyDisconnected() {
    if (this.disconnectedNotified) return;
    this.disconnectedNotified = true;
    this.callbacks.onDisconnected?.();
  }

  private handleServerEvent(raw: string) {
    let event: { type?: string; [k: string]: unknown };
    try {
      event = JSON.parse(raw) as { type?: string; [k: string]: unknown };
    } catch {
      return;
    }
    const type = event.type ?? "";

    if (type === "response.audio_transcript.delta") {
      const delta = typeof event.delta === "string" ? event.delta : "";
      if (delta) this.callbacks.onAssistantTranscriptInterim?.(delta);
      this.callbacks.onAssistantSpeakingState?.(true);
      return;
    }
    if (type === "response.audio_transcript.done" || type === "response.output_text.done") {
      const text =
        typeof event.transcript === "string"
          ? event.transcript
          : typeof event.text === "string"
            ? event.text
            : "";
      if (text.trim()) this.callbacks.onAssistantTranscriptFinal?.(text.trim());
      this.callbacks.onAssistantSpeakingState?.(false);
      return;
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = typeof event.transcript === "string" ? event.transcript : "";
      if (text.trim()) this.callbacks.onUserTranscriptFinal?.(text.trim());
      return;
    }
    if (type === "conversation.item.input_audio_transcription.delta") {
      const delta = typeof event.delta === "string" ? event.delta : "";
      if (delta) this.callbacks.onUserTranscriptInterim?.(delta);
      return;
    }
    if (type === "error") {
      const message = typeof event.message === "string" ? event.message : "Realtime server error";
      this.callbacks.onError?.(message);
    }
  }
}

