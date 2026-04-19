"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechRecognitionConstructor } from "@/lib/browser-stt-input";

type UseSpeechDictationOptions = {
  /** Snapshot for prefix when dictation starts */
  getText: () => string;
  /** Apply full composer value (updates controlled input + slash UI in parent) */
  setText: (next: string) => void;
  /** Called for recognition failures (not aborted / no-speech) */
  onError?: (code: SpeechRecognitionErrorEvent["error"]) => void;
};

export type SpeechDictationControls = {
  listening: boolean;
  supported: boolean;
  toggle: () => void;
  stop: () => void;
};

export function useSpeechDictation({
  getText,
  setText,
  onError,
}: UseSpeechDictationOptions): SpeechDictationControls {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseRef = useRef("");
  const aggregatedFinalRef = useRef("");
  const getTextRef = useRef(getText);
  const setTextRef = useRef(setText);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    getTextRef.current = getText;
    setTextRef.current = setText;
    onErrorRef.current = onError;
  }, [getText, setText, onError]);

  const supported =
    typeof window !== "undefined" && getSpeechRecognitionConstructor() !== null;

  const teardown = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    if (r) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      try {
        r.abort();
      } catch {
        /* noop */
      }
    }
    setListening(false);
  }, []);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        teardown();
      }
    } else {
      teardown();
    }
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      return;
    }

    teardown();

    baseRef.current = getTextRef.current();
    aggregatedFinalRef.current = "";

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          aggregatedFinalRef.current += piece;
        } else {
          interim += piece;
        }
      }
      const next = baseRef.current + aggregatedFinalRef.current + interim;
      setTextRef.current(next);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      onErrorRef.current?.(event.error);
      teardown();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);

    try {
      recognition.start();
    } catch {
      teardown();
    }
  }, [teardown]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    start();
  }, [listening, start, stop]);

  return {
    listening,
    supported,
    toggle,
    stop,
  };
}
