"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

interface UseMediaRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  onDataAvailable?: (blob: Blob) => void;
}

interface UseMediaRecorderReturn {
  status: RecorderStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => Blob | null;
  pauseRecording: () => void;
  resumeRecording: () => void;
  duration: number;
  error: string | null;
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const { mimeType = "audio/webm;codecs=opus", audioBitsPerSecond = 128000 } = options;

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : "audio/webm",
        audioBitsPerSecond,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          options.onDataAvailable?.(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Recording error occurred");
        setStatus("stopped");
        stopTimer();
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      setStatus("recording");
      setDuration(0);
      startTimer();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start recording";
      setError(message);
      setStatus("idle");
    }
  }, [mimeType, audioBitsPerSecond, options, startTimer, stopTimer]);

  const stopRecording = useCallback((): Blob | null => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    recorder.stop();
    stopTimer();

    // Stop all tracks
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    setStatus("stopped");

    // Return the combined blob
    if (chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      return blob;
    }
    return null;
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      stopTimer();
      setStatus("paused");
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      startTimer();
      setStatus("recording");
    }
  }, [startTimer]);

  return {
    status,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    duration,
    error,
  };
}
