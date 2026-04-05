"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import { postVirgilDebugIngest } from "@/lib/debug-ingest";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatErrorBanner } from "./chat-error-banner";
import { ChatHeader } from "./chat-header";
import { ChatMetricsSidePanel } from "./chat-metrics-side-panel";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { OpenClawPendingBanner } from "./openclaw-pending-banner";

export function ChatShell() {
  const searchParams = useSearchParams();

  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
    showCreditCardAlert,
    setShowCreditCardAlert,
    showThinking,
    setShowThinking,
    chatError,
    clearChatError,
  } = useActiveChat();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();
  const chatPhase = messages.length > 0 ? "session" : "invitation";

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    if (searchParams.get("virgilToast") !== "share_saved") {
      return;
    }
    toast.success("Saved shared content to memory");
    const next = new URL(window.location.href);
    next.searchParams.delete("virgilToast");
    const qs = next.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      `${next.pathname}${qs ? `?${qs}` : ""}`
    );
  }, [searchParams]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    // #region agent log
    postVirgilDebugIngest(
      {
        sessionId: "6a8d1d",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "components/chat/shell.tsx:chat_id_effect",
        message: "Chat shell mounted or chat id changed",
        data: {
          previousChatId: prevChatIdRef.current,
          nextChatId: chatId,
          messageCount: messages.length,
          isLoading,
        },
        timestamp: Date.now(),
      },
      { "X-Debug-Session-Id": "6a8d1d" }
    );
    // #endregion
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, isLoading, messages.length, setArtifact]);

  return (
    <>
      <div
        className="pixel-chat-root flex h-dvh w-full flex-row overflow-hidden"
        data-chat-phase={chatPhase}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isArtifactVisible ? "w-[40%]" : "w-full"
          )}
        >
          <ChatHeader
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
          />

          <div className="pixel-chat-panel relative flex min-h-0 flex-1 flex-row overflow-hidden bg-background md:rounded-tl-[12px] md:border-t md:border-l md:border-border/40">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div aria-hidden="true" className="chat-candlelight" />
              <div aria-hidden="true" className="chat-grain" />
              <div aria-hidden="true" className="chat-vignette" />
              {chatPhase === "invitation" && (
                <div aria-hidden="true" className="chat-creepy-eyes">
                  <span className="chat-creepy-eye" />
                  <span className="chat-creepy-eye" />
                </div>
              )}
              {chatPhase === "invitation" && (
                <div aria-hidden="true" className="chat-candle-decoration">
                  <div className="chat-candle-stack">
                    <div className="chat-candle-flame-wrap">
                      <div className="chat-candle-flame-glow" />
                      <div className="chat-candle-flame" />
                      <div className="chat-candle-flame-core" />
                    </div>
                    <div className="chat-candle-wick" />
                    <div className="chat-candle-body" />
                  </div>
                </div>
              )}
              <OpenClawPendingBanner />
              <Messages
                addToolApprovalResponse={addToolApprovalResponse}
                chatId={chatId}
                isArtifactVisible={isArtifactVisible}
                isLoading={isLoading}
                isReadonly={isReadonly}
                messages={messages}
                onEditMessage={(msg) => {
                  const text = msg.parts
                    ?.filter((p) => p.type === "text")
                    .map((p) => p.text)
                    .join("");
                  setInput(text ?? "");
                  setEditingMessage(msg);
                }}
                regenerate={regenerate}
                selectedModelId={currentModelId}
                setMessages={setMessages}
                status={status}
                votes={votes}
              />

              <ChatErrorBanner
                error={chatError}
                onDismiss={clearChatError}
                selectedModelId={currentModelId}
              />

              <div className="pixel-chat-footer sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
                {!isReadonly && (
                  <MultimodalInput
                    attachments={attachments}
                    chatId={chatId}
                    editingMessage={editingMessage}
                    input={input}
                    isLoading={isLoading}
                    messages={messages}
                    onCancelEdit={() => {
                      setEditingMessage(null);
                      setInput("");
                    }}
                    onModelChange={setCurrentModelId}
                    selectedModelId={currentModelId}
                    selectedVisibilityType={visibilityType}
                    sendMessage={
                      editingMessage
                        ? async () => {
                            const msg = editingMessage;
                            setEditingMessage(null);
                            await submitEditedMessage({
                              message: msg,
                              text: input,
                              setMessages,
                              regenerate,
                            });
                            setInput("");
                          }
                        : sendMessage
                    }
                    setAttachments={setAttachments}
                    setInput={setInput}
                    setMessages={setMessages}
                    setShowThinking={setShowThinking}
                    showThinking={showThinking}
                    status={status}
                    stop={stop}
                  />
                )}
              </div>
            </div>
            <ChatMetricsSidePanel />
          </div>
        </div>

        <Artifact
          addToolApprovalResponse={addToolApprovalResponse}
          attachments={attachments}
          chatId={chatId}
          input={input}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          selectedVisibilityType={visibilityType}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
          votes={votes}
        />
      </div>

      <DataStreamHandler />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
