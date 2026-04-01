"use client";

import {
  MessageSquareIcon,
  MoonIcon,
  PanelLeftIcon,
  PenSquareIcon,
  Settings2Icon,
  TrashIcon,
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

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });

    toast.success("All chats deleted");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-0">
          {/* Win2K Explorer-style panel header */}
          <div className="win2k-titlebar flex items-center gap-1 px-2 py-1" style={{ height: "24px", fontSize: "11px" }}>
            <MessageSquareIcon className="size-3 text-white" />
            <span className="flex-1 text-[11px] font-bold text-white truncate">Navigation</span>
            <div className="group-data-[collapsible=icon]:hidden">
              <SidebarTrigger
                className="size-4 text-white opacity-80 hover:opacity-100"
                style={{ background: "none", border: "none", padding: 0, minWidth: 0 }}
              />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-0">
          {/* Win2K toolbar-style action bar */}
          <SidebarGroup className="p-0 border-b border-sidebar-border">
            <SidebarGroupContent className="p-1">
              <SidebarMenu className="gap-0">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="win2k-nav-item h-7 rounded-none text-[11px] w-full justify-start"
                    onClick={() => {
                      setOpenMobile(false);
                      router.push("/");
                    }}
                    tooltip="New Chat"
                  >
                    <PenSquareIcon className="size-3" />
                    <span>New Chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="win2k-nav-item h-7 rounded-none text-[11px] w-full justify-start"
                      onClick={() => {
                        setOpenMobile(false);
                        router.push("/night-insights");
                      }}
                      tooltip="Night Insights"
                    >
                      <MoonIcon className="size-3" />
                      <span>Night Insights</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="win2k-nav-item h-7 rounded-none text-[11px] w-full justify-start"
                      onClick={() => {
                        setOpenMobile(false);
                        router.push("/preferences");
                      }}
                      tooltip="Preferences"
                    >
                      <Settings2Icon className="size-3" />
                      <span>Preferences</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="win2k-nav-item h-7 rounded-none text-[11px] w-full justify-start text-red-700 hover:!bg-red-600 hover:!text-white"
                      onClick={() => setShowDeleteAllDialog(true)}
                      tooltip="Delete All Chats"
                    >
                      <TrashIcon className="size-3" />
                      <span>Delete All Chats</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter className="p-1 border-t border-sidebar-border">
          {user && <SidebarUserNav user={user} />}
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
