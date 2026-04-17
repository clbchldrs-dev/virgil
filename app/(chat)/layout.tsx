import { VT323 } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { ChatSurfaceLayer } from "@/components/chat/chat-surface-layer";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ModelMetricsProvider } from "@/components/chat/model-metrics-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { postVirgilDebugIngest } from "@/lib/debug-ingest";
import { auth } from "../(auth)/auth";

const pixelFont = VT323({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-pixel",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <ModelMetricsProvider>
          <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
            <SidebarShell>{children}</SidebarShell>
          </Suspense>
        </ModelMetricsProvider>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";
  // #region agent log
  postVirgilDebugIngest(
    {
      sessionId: "6a8d1d",
      runId: "pre-fix",
      hypothesisId: "H3",
      location: "app/(chat)/layout.tsx:SidebarShell",
      message: "Sidebar shell resolved session and cookie state",
      data: {
        hasSessionUser: Boolean(session?.user),
        isCollapsed,
      },
      timestamp: Date.now(),
    },
    { "X-Debug-Session-Id": "6a8d1d" }
  );
  // #endregion

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session?.user} />
      <SidebarInset className={pixelFont.variable}>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        <ChatSurfaceLayer />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
