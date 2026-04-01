"use client";

import { useEffect, useRef, useState } from "react";
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

// Win2K Clock component
function Win2KClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      setTime(`${displayHours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}


export function ChatShell() {
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

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, setArtifact]);

  return (
    <>
      <div
        className="pixel-chat-root flex h-dvh w-full flex-col overflow-hidden"
        data-chat-phase={chatPhase}
        style={{ background: "#d4d0c8", fontFamily: '"Tahoma", "MS Sans Serif", Arial, sans-serif' }}
      >
        {/* Win2K Menu Bar at top */}
        <div className="win2k-menubar shrink-0 border-b" style={{ borderColor: "#808080" }}>
          <span className="win2k-menubar-item">File</span>
          <span className="win2k-menubar-item">Edit</span>
          <span className="win2k-menubar-item">View</span>
          <span className="win2k-menubar-item">Tools</span>
          <span className="win2k-menubar-item">Help</span>
        </div>

        {/* Main content row */}
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
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

            <div
              className="pixel-chat-panel relative flex min-h-0 flex-1 flex-row overflow-hidden"
              style={{
                background: "#ece9d8",
                borderTop: "1px solid #808080",
                borderLeft: "1px solid #808080",
              }}
            >
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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

                <div
                  className="pixel-chat-footer sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 px-2 pb-3 md:px-4 md:pb-4"
                  style={{ background: "#ece9d8" }}
                >
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

        {/* Win2K Taskbar at bottom */}
        <div className="win2k-taskbar shrink-0">
          <button
            className="win2k-start-btn"
            type="button"
            style={{ fontSize: "11px", fontWeight: "bold" }}
          >
            <span style={{ fontSize: "14px" }}>⊞</span>
            <span>Start</span>
          </button>

          {/* Separator */}
          <div style={{ width: 2, height: 22, background: "#808080", borderRight: "1px solid #ffffff" }} />

          {/* Active window taskbar button */}
          <button
            className="win2k-raised flex items-center gap-1 px-2 text-[11px]"
            type="button"
            style={{ height: 22, minWidth: 120, background: "#d4d0c8", fontSize: "11px" }}
          >
            <span>💬</span>
            <span className="truncate">Virgil — AI Assistant</span>
          </button>

          <div style={{ flex: 1 }} />

          {/* System tray clock */}
          <div className="win2k-clock text-[11px]">
            <Win2KClock />
          </div>
        </div>
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
