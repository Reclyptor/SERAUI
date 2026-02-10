"use client";

import { Sidebar } from "../components/Sidebar";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-[48px]">
        {children}
      </main>
    </div>
  );
}
