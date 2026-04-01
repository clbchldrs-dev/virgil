"use client";

import { PanelLeftIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return null;
  }

  return (
    <header className="win2k-titlebar sticky top-0 z-10 flex h-8 shrink-0 items-center gap-1">
      {/* Win2K window icon */}
      <span className="mr-1 text-[10px]">💬</span>

      <Button
        className="mr-1 md:hidden"
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
        style={{ background: "none", border: "none", color: "white", padding: 0, width: 16, height: 14, minWidth: 0 }}
      >
        <PanelLeftIcon className="size-3" />
      </Button>

      <span className="flex-1 text-[11px] font-bold text-white" style={{ textShadow: "1px 1px 1px rgba(0,0,0,0.5)" }}>
        Virgil — AI Assistant
      </span>

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
        />
      )}

      {/* Win2K titlebar buttons */}
      <div className="ml-1 flex items-center gap-0.5">
        <button className="win2k-titlebar-btn" type="button" aria-label="Minimize" title="Minimize">
          _
        </button>
        <button className="win2k-titlebar-btn" type="button" aria-label="Maximize" title="Maximize">
          □
        </button>
        <button className="win2k-titlebar-btn" type="button" aria-label="Close" title="Close" style={{ fontWeight: "bold", fontSize: "10px" }}>
          ✕
        </button>
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
