"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickAudioMimeType } from "@/lib/media/pick-audio-mime-type";

export type OralRecorderPhase = "idle" | "recording" | "stopped";

export type OralRecorderResult = {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  byteLength: number;
};

type UseOralRecorderOptions = {
  /** Called when MediaRecorder stops with a single blob (no pause/resume). */
  onRecordingReady?: (result: OralRecorderResult) => void;
};

/**
 * Single-take browser recording: start → stop → blob. No pause/resume.
 */
export function useOralRecorder(options: UseOralRecorderOptions = {}) {
  const { onRecordingReady } = options;
  const onReadyRef = useRef(onRecordingReady);
  onReadyRef.current = onRecordingReady;
  const [phase, setPhase] = useState<OralRecorderPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStreamTracks = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      for (const t of s.getTracks()) {
        t.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTick();
    setElapsedSec(0);
    setError(null);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    mimeTypeRef.current = "";
    setPhase("idle");
  }, [clearTick]);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") {
      stopStreamTracks();
      clearTick();
      return;
    }
    try {
      mr.stop();
    } catch {
      stopStreamTracks();
      clearTick();
    }
  }, [stopStreamTracks, clearTick]);

  const start = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser.");
      return;
    }
    let mimeType = pickAudioMimeType();
    if (!mimeType) {
      setError("No supported audio recording format was found.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Microphone access was denied.";
      setError(msg);
      return;
    }

    streamRef.current = stream;
    mimeTypeRef.current = mimeType;

    try {
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
    } catch {
      mimeType = "";
      mimeTypeRef.current = "";
      try {
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        mimeType = mr.mimeType || "audio/webm";
        mimeTypeRef.current = mimeType;
      } catch (e2) {
        stopStreamTracks();
        setError(e2 instanceof Error ? e2.message : "Could not start recorder.");
        return;
      }
    }

    const mr = mediaRecorderRef.current!;
    chunksRef.current = [];

    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };

    mr.onerror = () => {
      setError("Recording failed.");
      stopStreamTracks();
      clearTick();
      setPhase("idle");
    };

    mr.onstop = () => {
      clearTick();
      stopStreamTracks();
      const type = mimeTypeRef.current || mr.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const endedAt = performance.now();
      const durationSec = Math.max(0.1, (endedAt - startedAtRef.current) / 1000);
      const result: OralRecorderResult = {
        blob,
        mimeType: type,
        durationSec,
        byteLength: blob.size,
      };
      setPhase("stopped");
      onReadyRef.current?.(result);
    };

    startedAtRef.current = performance.now();
    setElapsedSec(0);
    setPhase("recording");
    try {
      mr.start(200);
    } catch (e) {
      stopStreamTracks();
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Could not start recording.");
      return;
    }

    tickRef.current = setInterval(() => {
      setElapsedSec(Math.floor((performance.now() - startedAtRef.current) / 1000));
    }, 500);
  }, [stopStreamTracks, clearTick]);

  useEffect(() => {
    return () => {
      clearTick();
      stopStreamTracks();
    };
  }, [clearTick, stopStreamTracks]);

  return {
    phase,
    error,
    elapsedSec,
    start,
    stop,
    reset,
  };
}
