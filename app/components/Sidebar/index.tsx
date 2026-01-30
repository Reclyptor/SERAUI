"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  Search,
  MessageSquare,
  Folder,
  Grid2X2,
  Code,
  ChevronUp,
} from "lucide-react";
import { useUser } from "@/app/hooks/useUser";

interface Chat {
  id: string;
  title: string;
}

interface SidebarProps {
  recentChats?: Chat[];
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  currentChatId?: string | null;
}

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
  chat: Chat;
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

export function Sidebar({
  recentChats = [],
  onNewChat,
  onSelectChat,
  currentChatId,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          recentChats={recentChats}
          onNewChat={onNewChat}
          onSelectChat={onSelectChat}
          currentChatId={currentChatId}
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
          recentChats={recentChats}
          onNewChat={onNewChat}
          onSelectChat={onSelectChat}
          currentChatId={currentChatId}
        />
      </aside>

      {/* Mobile overlay when sidebar is open */}
      {!isCollapsed && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
}

function SidebarContent({
  isCollapsed,
  setIsCollapsed,
  recentChats,
  onNewChat,
  onSelectChat,
  currentChatId,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  recentChats: Chat[];
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  currentChatId?: string | null;
}) {
  const { name: userName, initials: userInitials } = useUser();

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
                onClick={() => onSelectChat?.(chat.id)}
                isCollapsed={isCollapsed}
                isActive={currentChatId === chat.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Spacer when collapsed or no chats */}
      {(isCollapsed || recentChats.length === 0) && <div className="flex-1" />}

      {/* User profile */}
      <div
        className={clsx(
          "shrink-0 border-t border-border px-2 py-2",
          isCollapsed && "flex justify-center"
        )}
      >
        <button
          className={clsx(
            "flex items-center gap-3 rounded-lg transition-colors hover:bg-background-tertiary",
            isCollapsed ? "w-8 h-8 justify-center" : "w-full h-8 pl-1.5 pr-3"
          )}
          title={ isCollapsed ? userName : undefined }
        >
          <div className="w-5 h-5 rounded-full bg-foreground-muted flex items-center justify-center text-background text-xs font-medium shrink-0">
            { userInitials }
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-foreground truncate">
                  { userName }
                </div>
              </div>
            </>
          )}
        </button>
      </div>
    </>
  );
}
