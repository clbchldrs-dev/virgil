"use client";

import { MicIcon } from "lucide-react";
import { forwardRef, useCallback, useImperativeHandle, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSpeechDictation } from "@/hooks/use-speech-dictation";
import { cn } from "@/lib/utils";

export type VoiceDictationHandle = {
  stop: () => void;
};

type VoiceDictationButtonProps = {
  getText: () => string;
  setText: (next: string) => void;
  disabled: boolean;
};

export const VoiceDictationButton = forwardRef<
  VoiceDictationHandle,
  VoiceDictationButtonProps
>(function VoiceDictationButton(
  { getText, setText, disabled }: VoiceDictationButtonProps,
  ref
) {
  const onError = useCallback((code: SpeechRecognitionErrorEvent["error"]) => {
    if (code === "not-allowed") {
      toast.error("Microphone permission denied.");
      return;
    }
    if (code === "network") {
      toast.error("Speech recognition failed (network).");
      return;
    }
    if (code === "service-not-allowed") {
      toast.error("Speech recognition is not allowed in this context.");
      return;
    }
    toast.error("Voice input stopped unexpectedly.");
  }, []);

  const dictation = useSpeechDictation({
    getText,
    setText,
    onError,
  });

  const { supported } = dictation;

  useImperativeHandle(
    ref,
    () => ({
      stop: dictation.stop,
    }),
    [dictation.stop]
  );

  const title = useMemo(() => {
    if (!supported) {
      return "Voice input is not supported in this browser.";
    }
    return dictation.listening
      ? "Stop dictation"
      : "Voice input — speak to fill the composer";
  }, [dictation.listening, supported]);

  return (
    <Button
      aria-label={
        dictation.listening ? "Stop voice input" : "Start voice input"
      }
      aria-pressed={dictation.listening}
      className={cn(
        "h-7 w-7 rounded-lg border border-border/40 p-1 transition-colors",
        supported && !disabled
          ? dictation.listening
            ? "border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700"
            : "text-foreground hover:border-border hover:text-foreground"
          : "text-muted-foreground/30 cursor-not-allowed"
      )}
      data-testid="voice-dictation-button"
      disabled={disabled || !supported}
      onClick={(event) => {
        event.preventDefault();
        dictation.toggle();
      }}
      title={title}
      type="button"
      variant="ghost"
    >
      <MicIcon
        className={cn("size-4", dictation.listening && "animate-pulse")}
      />
    </Button>
  );
});
