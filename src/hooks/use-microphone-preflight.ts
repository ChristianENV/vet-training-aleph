"use client";

import { useCallback, useState } from "react";

export type MicrophonePreflightStatus =
  | "idle"
  | "checking"
  | "ready"
  | "permission_denied"
  | "no_microphone"
  | "failed";

/**
 * Browser gate before starting an oral session: permission, input device, and a live audio track.
 * Stops the test stream when done so the wizard can request the mic again when recording.
 */
export function useMicrophonePreflight() {
  const [status, setStatus] = useState<MicrophonePreflightStatus>("idle");
  const [detailMessage, setDetailMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setDetailMessage(null);
  }, []);

  const checkMicrophone = useCallback(async () => {
    setStatus("checking");
    setDetailMessage(null);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("failed");
      setDetailMessage("This browser does not support microphone access on this page.");
      return;
    }

    let audioInputCount = 0;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      audioInputCount = devices.filter((d) => d.kind === "audioinput").length;
    } catch {
      // Enumeration can fail before permission; still try getUserMedia.
    }

    if (audioInputCount === 0) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (perm.state === "denied") {
          setStatus("permission_denied");
          return;
        }
      } catch {
        // Permissions API not supported — continue to getUserMedia.
      }
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
      const err = e as DOMException;
      const name = err.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("permission_denied");
        return;
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setStatus("no_microphone");
        return;
      }
      if (name === "NotReadableError" || name === "TrackStartError") {
        setStatus("failed");
        setDetailMessage("Your microphone may be in use by another app. Close other tabs or apps using it, then try again.");
        return;
      }
      setStatus("failed");
      setDetailMessage(err.message?.trim() || "We could not open the microphone.");
      return;
    }

    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("no_microphone");
      return;
    }

    const track = tracks[0];
    if (track.readyState !== "live") {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("failed");
      setDetailMessage("The microphone did not start correctly. Try again.");
      return;
    }

    stream.getTracks().forEach((t) => t.stop());
    setStatus("ready");
  }, []);

  return { status, detailMessage, checkMicrophone, reset };
}
