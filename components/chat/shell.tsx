"use client";

import { usePathname, useSearchParams } from "next/navigation";
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
import { pathnameWithoutBasePath } from "@/lib/path-without-base";
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

/** Row index of the toothy grin (Papyrus-style); teeth get a slightly brighter fill in CSS. */
const CREEPY_SKULL_GRIN_ROW = 9;

/**
 * 20×15 pixel skull — Papyrus-style cheekbones + alternating “teeth” row under cheeks.
 * Mockup:
 *
 *   .....XXXXXXXXXX.....
 *   ..XXXXXXXXXXXXXXXX..
 *   .XXXXXXXXXXXXXXXXXX.
 *   .XXXXXXXXXXXXXXXXXX.
 *   .XX..XXXX..XXXX..XX.   ← sockets + eyes
 *   .XX..XXXX..XXXX..XX.
 *   .XX..XXXX..XXXX..XX.
 *   XX..XX..XXXX..XX..XX   ← cheek flare
 *   XX..XX..XXXX..XX..XX
 *   X.X.X.X.X.X.X.X.X.X.   ← grin (gaps = dark mouth)
 *   ..XXXXXXXXXXXXXXXX..
 *   ...XXXXXXXXXXXXXX...
 *   ....XXXXXXXXXXXX....
 *   ......XXXXXXXX......
 *   ........XXXX........
 *
 * Bowtie SVG sits below this block (neck).
 */
const CREEPY_SKULL_ROWS: readonly string[] = [
  ".....XXXXXXXXXX.....",
  "..XXXXXXXXXXXXXXXX..",
  ".XXXXXXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXXXXXX.",
  ".XX..XXXX..XXXX..XX.",
  ".XX..XXXX..XXXX..XX.",
  ".XX..XXXX..XXXX..XX.",
  "XX..XX..XXXX..XX..XX",
  "XX..XX..XXXX..XX..XX",
  "X.X.X.X.X.X.X.X.X.X.",
  "..XXXXXXXXXXXXXXXX..",
  "...XXXXXXXXXXXXXX...",
  "....XXXXXXXXXXXX....",
  "......XXXXXXXX......",
  "........XXXX........",
];

const CREEPY_SKULL_PIXELS: readonly [number, number][] = (() => {
  const pixels: [number, number][] = [];
  for (let y = 0; y < CREEPY_SKULL_ROWS.length; y++) {
    const row = CREEPY_SKULL_ROWS[y] ?? "";
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "X") {
        pixels.push([x, y]);
      }
    }
  }
  return pixels;
})();

/** Pixel unit squares for invitation bowtie SVG (viewBox 0 0 15 5) — wings + center knot so the gap does not read as lips. */
const CREEPY_BOWTIE_PIXELS: readonly [number, number][] = [
  [2, 0],
  [3, 0],
  [4, 0],
  [10, 0],
  [11, 0],
  [12, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [7, 1],
  [9, 1],
  [10, 1],
  [11, 1],
  [12, 1],
  [13, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [6, 2],
  [7, 2],
  [8, 2],
  [11, 2],
  [12, 2],
  [13, 2],
  [14, 2],
  [1, 3],
  [2, 3],
  [3, 3],
  [4, 3],
  [5, 3],
  [7, 3],
  [9, 3],
  [10, 3],
  [11, 3],
  [12, 3],
  [13, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [10, 4],
  [11, 4],
  [12, 4],
];

export function ChatShell() {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const logicalPath = pathnameWithoutBasePath(pathname, basePath);
  const isConcreteChatRoute = /^\/chat\/[^/]+/.test(logicalPath);

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
  /** Empty `/chat/:id` uses invitation (orange, eyes) like `/`; stay on session while history is loading so existing threads do not flash orange. */
  const chatPhase =
    messages.length > 0 || (isConcreteChatRoute && isLoading)
      ? "session"
      : "invitation";

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
                <div aria-hidden="true" className="chat-space-atmosphere">
                  <div className="chat-space-nebula" />
                  <div className="chat-space-stars" />
                </div>
              )}
              {chatPhase === "invitation" && (
                <div aria-hidden="true" className="chat-creepy-face">
                  <div className="chat-creepy-skull-wrap">
                    <svg
                      aria-hidden="true"
                      className="chat-creepy-skull__svg"
                      height="15"
                      preserveAspectRatio="xMidYMid meet"
                      shapeRendering="crispEdges"
                      viewBox="0 0 20 15"
                      width="20"
                    >
                      {CREEPY_SKULL_PIXELS.map(([x, y]) => (
                        <rect
                          className={cn(
                            "chat-creepy-skull__pixel",
                            y === CREEPY_SKULL_GRIN_ROW &&
                              "chat-creepy-skull__pixel--tooth"
                          )}
                          height="1"
                          key={`sk-${x}-${y}`}
                          width="1"
                          x={x}
                          y={y}
                        />
                      ))}
                    </svg>
                    <div className="chat-creepy-eyes">
                      <span className="chat-creepy-eye" />
                      <span className="chat-creepy-eye" />
                    </div>
                  </div>
                  <div className="chat-creepy-bowtie">
                    <svg
                      aria-hidden="true"
                      className="chat-creepy-bowtie__svg"
                      height="5"
                      preserveAspectRatio="xMidYMid meet"
                      shapeRendering="crispEdges"
                      viewBox="0 0 15 5"
                      width="15"
                    >
                      {CREEPY_BOWTIE_PIXELS.map(([x, y]) => (
                        <rect
                          className="chat-creepy-bowtie__pixel"
                          height="1"
                          key={`${x}-${y}`}
                          width="1"
                          x={x}
                          y={y}
                        />
                      ))}
                    </svg>
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
