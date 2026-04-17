"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ChatShell } from "@/components/chat/shell";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import {
  isChatSurfacePath,
  pathnameWithoutBasePath,
} from "@/lib/path-without-base";

function ChatSurfaceInner() {
  const pathname = usePathname() ?? "/";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const logicalPath = pathnameWithoutBasePath(pathname, basePath);
  if (!isChatSurfacePath(logicalPath)) {
    return null;
  }
  return (
    <ActiveChatProvider>
      <ChatShell />
    </ActiveChatProvider>
  );
}

export function ChatSurfaceLayer() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <ChatSurfaceInner />
    </Suspense>
  );
}
