"use client";

import {
  ActivityIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquareIcon,
  MoonIcon,
  PanelLeftIcon,
  PenSquareIcon,
  TrashIcon,
  WrenchIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn, generateUUID } from "@/lib/utils";

/** Matches `next.config.ts` / `NEXT_PUBLIC_BASE_PATH` (e.g. `/demo` when `IS_DEMO=1`). */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type SidebarPrimaryNavProps = {
  user: User | undefined;
  onRequestDeleteAll: () => void;
};

function SidebarPrimaryNav({
  user,
  onRequestDeleteAll,
}: SidebarPrimaryNavProps) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup className="pt-1 pb-0 max-md:pt-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 rounded-lg border border-sidebar-border text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              onClick={() => {
                setOpenMobile(false);
                router.push(`${BASE_PATH}/chat/${generateUUID()}`);
              }}
              tooltip="New Chat"
            >
              <PenSquareIcon className="size-4" />
              <span className="font-medium">New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(`${BASE_PATH}/background`);
                  }}
                  tooltip="Background activity"
                >
                  <ActivityIcon className="size-4" />
                  <span>Background</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(`${BASE_PATH}/sophon`);
                  }}
                  tooltip="Daily command center"
                >
                  <LayoutDashboardIcon className="size-4" />
                  <span>Command center</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(`${BASE_PATH}/proposals`);
                  }}
                  tooltip="Proposals"
                >
                  <ListChecksIcon className="size-4" />
                  <span>Proposals</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(`${BASE_PATH}/night-insights`);
                  }}
                  tooltip="Night insights"
                >
                  <MoonIcon className="size-4" />
                  <span>Night insights</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(`${BASE_PATH}/agent-tasks`);
                  }}
                  tooltip="Agent approvals"
                >
                  <WrenchIcon className="size-4" />
                  <span>Agent approvals</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
                  onClick={onRequestDeleteAll}
                  tooltip="Delete All Chats"
                >
                  <TrashIcon className="size-4" />
                  <span className="text-[13px]">Delete all</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace(`${BASE_PATH}/`);
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });

    fetch(`${BASE_PATH}/api/history`, {
      method: "DELETE",
    });

    toast.success("All chats deleted");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader
          className={cn(
            "relative z-30 shrink-0 pb-0 pt-3",
            "max-md:sticky max-md:top-0 max-md:border-b max-md:border-sidebar-border/70 max-md:bg-sidebar"
          )}
        >
          <SidebarMenu>
            <SidebarMenuItem className="flex flex-row items-center justify-between">
              <div className="group/logo relative flex items-center justify-center">
                <SidebarMenuButton
                  asChild
                  className="size-8 !px-0 items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
                  tooltip="Virgil"
                >
                  <Link
                    href={`${BASE_PATH}/`}
                    onClick={() => setOpenMobile(false)}
                  >
                    <MessageSquareIcon className="size-4 text-sidebar-foreground/50" />
                  </Link>
                </SidebarMenuButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                      onClick={() => toggleSidebar()}
                    >
                      <PanelLeftIcon className="size-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block" side="right">
                    Open sidebar
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <SidebarTrigger className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        {isMobile ? (
          <div className="shrink-0 border-b border-sidebar-border/70 bg-sidebar px-1.5 pb-2 pt-1">
            <SidebarPrimaryNav
              onRequestDeleteAll={() => setShowDeleteAllDialog(true)}
              user={user}
            />
          </div>
        ) : null}
        <SidebarContent
          className={cn(
            "relative z-30",
            isMobile
              ? "flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overscroll-y-contain px-0 pt-1"
              : "max-md:flex-none max-md:min-h-0 max-md:overflow-visible"
          )}
        >
          {isMobile ? null : (
            <div className="shrink-0">
              <SidebarPrimaryNav
                onRequestDeleteAll={() => setShowDeleteAllDialog(true)}
                user={user}
              />
            </div>
          )}
          <div
            className={cn(
              isMobile
                ? "min-h-0"
                : "flex min-h-0 flex-col max-md:flex-none max-md:overflow-visible md:flex-1 md:overflow-y-auto"
            )}
          >
            <SidebarHistory user={user} />
          </div>
        </SidebarContent>
        <SidebarFooter className="relative z-30 shrink-0 border-t border-sidebar-border pt-2 pb-3 max-md:bg-sidebar">
          {user ? <SidebarUserNav user={user} /> : null}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
