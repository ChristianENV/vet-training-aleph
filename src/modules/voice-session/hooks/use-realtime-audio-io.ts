"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicPermissionState =
  | "unknown"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

type UseRealtimeAudioIoOptions = {
  onMicActivityChange?: (level: number) => void;
};

export function useRealtimeAudioIo(options: UseRealtimeAudioIoOptions = {}) {
  const { onMicActivityChange } = options;
  const [micPermission, setMicPermission] = useState<MicPermissionState>("unknown");
  const [isListening, setIsListening] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micActivityLevel, setMicActivityLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopMeter = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMicActivityLevel(0);
    onMicActivityChange?.(0);
  }, [onMicActivityChange]);

  const stopListening = useCallback(() => {
    stopMeter();
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
  }, [stopMeter]);

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const level = Math.min(1, rms * 4);
      setMicActivityLevel(level);
      onMicActivityChange?.(level);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onMicActivityChange]);

  const startListening = useCallback(async () => {
    if (isListening) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicPermission("unsupported");
      return;
    }
    setMicPermission("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setMicPermission("granted");

      const audioCtx = new window.AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);
      setIsListening(true);
      startMeter();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicPermission("denied");
      } else {
        setMicPermission("error");
      }
    }
  }, [isListening, startMeter]);

  const toggleMicMuted = useCallback(() => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getAudioTracks()) {
        track.enabled = !next;
      }
    }
  }, [isMicMuted]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    micPermission,
    isListening,
    isMicMuted,
    micActivityLevel,
    getMicStream: () => streamRef.current,
    startListening,
    stopListening,
    toggleMicMuted,
  };
}

