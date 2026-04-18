"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { prepareTextForSpeech } from "@/lib/browser-tts";

type VirgilSpeechContextValue = {
  /** `message.id` currently being spoken, or null */
  speakingMessageId: string | null;
  /** Returns false when there is nothing speakable after cleanup or Speech API is missing */
  speak: (messageId: string, rawText: string) => boolean;
  stop: () => void;
};

const VirgilSpeechContext = createContext<VirgilSpeechContextValue | null>(
  null
);

function pickPreferredVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null;
  }
  const enUs = voices.find(
    (v) => v.lang === "en-US" || v.lang.startsWith("en-US")
  );
  if (enUs) {
    return enUs;
  }
  const en = voices.find((v) => v.lang.startsWith("en"));
  return en ?? voices[0] ?? null;
}

export function VirgilSpeechProvider({ children }: { children: ReactNode }) {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const speakingMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    speakingMessageIdRef.current = speakingMessageId;
  }, [speakingMessageId]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    const synth = window.speechSynthesis;
    const warm = () => {
      synth.getVoices();
    };
    warm();
    synth.addEventListener("voiceschanged", warm);
    return () => synth.removeEventListener("voiceschanged", warm);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speakingMessageIdRef.current = null;
    setSpeakingMessageId(null);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const speak = useCallback(
    (messageId: string, rawText: string): boolean => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return false;
      }
      const text = prepareTextForSpeech(rawText);
      if (text.length === 0) {
        return false;
      }

      const synth = window.speechSynthesis;
      if (speakingMessageIdRef.current === messageId && synth.speaking) {
        stop();
        return true;
      }

      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const voice = pickPreferredVoice(voices);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => {
        if (speakingMessageIdRef.current === messageId) {
          speakingMessageIdRef.current = null;
          setSpeakingMessageId(null);
        }
      };
      utterance.onerror = () => {
        if (speakingMessageIdRef.current === messageId) {
          speakingMessageIdRef.current = null;
          setSpeakingMessageId(null);
        }
      };

      speakingMessageIdRef.current = messageId;
      setSpeakingMessageId(messageId);
      synth.speak(utterance);
      return true;
    },
    [stop]
  );

  const value = useMemo(
    () => ({
      speakingMessageId,
      speak,
      stop,
    }),
    [speakingMessageId, speak, stop]
  );

  return (
    <VirgilSpeechContext.Provider value={value}>
      {children}
    </VirgilSpeechContext.Provider>
  );
}

const noopSpeech: VirgilSpeechContextValue = {
  speakingMessageId: null,
  speak: () => false,
  stop: () => {
    /* no provider: intentional no-op */
  },
};

/** Safe without provider (speak no-ops); prefer wrapping chat with VirgilSpeechProvider. */
export function useVirgilSpeech(): VirgilSpeechContextValue {
  const ctx = useContext(VirgilSpeechContext);
  return ctx ?? noopSpeech;
}
