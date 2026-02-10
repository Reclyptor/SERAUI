"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import {
  PanelLeftClose,
  Plus,
  Search,
  MessageSquare,
  Folder,
  Grid2X2,
  Code,
  ChevronUp,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useUser } from "@/app/hooks/useUser";
import { useSessionTimer } from "@/app/hooks/useSessionTimer";
import { useChat } from "@/app/contexts/ChatContext";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isCollapsed: boolean;
  isActive?: boolean;
}

function NavItem({ icon, label, onClick, isCollapsed, isActive }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 h-8 rounded-lg transition-colors",
        "text-foreground-muted hover:text-foreground hover:bg-background-tertiary",
        isCollapsed ? "w-8 justify-center" : "w-full pl-1.5 pr-3",
        isActive && "bg-background-tertiary text-foreground"
      )}
      title={isCollapsed ? label : undefined}
    >
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      {!isCollapsed && (
        <span className="text-sm truncate">{label}</span>
      )}
    </button>
  );
}

function ChatItem({
  chat,
  onClick,
  isCollapsed,
  isActive,
}: {
  chat: { id: string; title: string };
  onClick: () => void;
  isCollapsed: boolean;
  isActive: boolean;
}) {
  if (isCollapsed) return null;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors",
        "text-foreground-muted hover:text-foreground hover:bg-background-tertiary",
        isActive && "bg-background-tertiary text-foreground"
      )}
    >
      {chat.title}
    </button>
  );
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { recentChats } = useChat();

  // Derive current chat ID from URL
  const currentChatID = pathname.match(/^\/chat\/(.+)/)?.[1] ?? null;

  const sidebarChats = recentChats.map((chat) => ({
    id: chat._id,
    title: chat.title,
  }));

  const handleNewChat = () => router.push("/new");
  const handleSelectChat = (chatID: string) => {
    if (currentChatID === chatID) return;
    router.push(`/chat/${chatID}`);
  };

  return (
    <>
      {/* Desktop sidebar - fixed at lg and above */}
      <aside
        className={clsx(
          "hidden lg:flex flex-col h-screen bg-background-secondary transition-[width] duration-200 ease-in-out",
          isCollapsed ? "w-[48px]" : "w-[287px]"
        )}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          recentChats={sidebarChats}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          currentChatID={currentChatID}
        />
      </aside>

      {/* Mobile sidebar - sticky below lg */}
      <aside
        className={clsx(
          "lg:hidden fixed left-0 top-0 z-40 flex flex-col h-screen bg-background-secondary transition-[width] duration-200 ease-in-out",
          isCollapsed ? "w-[48px]" : "w-[287px]"
        )}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          recentChats={sidebarChats}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          currentChatID={currentChatID}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  isCollapsed,
  setIsCollapsed,
  recentChats,
  onNewChat,
  onSelectChat,
  currentChatID,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  recentChats: { id: string; title: string }[];
  onNewChat: () => void;
  onSelectChat: (chatID: string) => void;
  currentChatID: string | null;
}) {
  const { name: userName, initials: userInitials, expiresAt } = useUser();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { formatted: sessionTimeLeft } = useSessionTimer(expiresAt);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close the menu when the sidebar collapses
  useEffect(() => {
    if (isCollapsed) setIsUserMenuOpen(false);
  }, [isCollapsed]);

  // Close the menu when clicking outside
  useEffect(() => {
    if (!isUserMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  return (
    <>
      {/* Header */}
      <div
        className={clsx(
          "flex items-center h-14 shrink-0 px-2",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        {!isCollapsed ? (
          <div className="flex items-center gap-3 h-8 pl-1.5 pr-3">
            <div className="w-5 h-5 shrink-0">
              <img src="/sera.png" alt="SERA" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-semibold text-foreground">SERA</span>
          </div>
        ) : (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-tertiary transition-colors"
            title="Expand sidebar"
          >
            <div className="w-5 h-5 shrink-0">
              <img src="/sera.png" alt="SERA" className="w-full h-full object-cover" />
            </div>
          </button>
        )}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={clsx("flex flex-col gap-1 px-2", isCollapsed && "items-center")}>
        <NavItem
          icon={<Plus className="w-5 h-5" />}
          label="New chat"
          onClick={onNewChat}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={<Search className="w-5 h-5" />}
          label="Search"
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={<MessageSquare className="w-5 h-5" />}
          label="Chats"
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={<Folder className="w-5 h-5" />}
          label="Projects"
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={<Grid2X2 className="w-5 h-5" />}
          label="Artifacts"
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={<Code className="w-5 h-5" />}
          label="Code"
          isCollapsed={isCollapsed}
        />
      </nav>

      {/* Recents section */}
      {!isCollapsed && recentChats.length > 0 && (
        <div className="flex-1 flex flex-col mt-4 min-h-0">
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Recents
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-2">
            {recentChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                onClick={() => onSelectChat(chat.id)}
                isCollapsed={isCollapsed}
                isActive={currentChatID === chat.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Spacer when collapsed or no chats */}
      {(isCollapsed || recentChats.length === 0) && <div className="flex-1" />}

      {/* User profile with drop-up menu */}
      <div ref={userMenuRef} className="shrink-0 relative">
        {/* Drop-up panel */}
        <div
          className={clsx(
            "overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out",
            "grid",
            isUserMenuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="min-h-0">
            <div
              className={clsx(
                "border-t border-border px-3 py-3 flex flex-col gap-2",
                isCollapsed && "min-w-[200px]"
              )}
            >
              {/* Logout button with session timer */}
              <button
                onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Log out</span>
                </span>
                <span className="text-xs tabular-nums">
                  {sessionTimeLeft ?? "--:--"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* User button */}
        <div
          className={clsx(
            "border-t border-border px-2 py-2",
            isCollapsed && "flex justify-center"
          )}
        >
          <button
            onClick={isCollapsed ? undefined : () => setIsUserMenuOpen((prev) => !prev)}
            className={clsx(
              "flex items-center gap-3 rounded-lg transition-colors",
              isCollapsed
                ? "w-8 h-8 justify-center cursor-default"
                : "w-full h-8 pl-1.5 pr-3 hover:bg-background-tertiary"
            )}
            title={isCollapsed ? userName : undefined}
          >
            <div className="w-5 h-5 rounded-full bg-foreground-muted flex items-center justify-center text-background text-xs font-medium shrink-0">
              {userInitials}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-foreground truncate">
                    {userName}
                  </div>
                </div>
                <ChevronUp
                  className={clsx(
                    "w-4 h-4 text-foreground-muted transition-transform duration-200",
                    isUserMenuOpen ? "rotate-0" : "rotate-180"
                  )}
                />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
