"use client";

import { CopilotChat } from "@copilotkit/react-ui";

export default function Home() {
  return (
    <div className="flex h-screen w-full bg-[#1e1e1e]">
      <CopilotChat
        className="h-full w-full"
        instructions="You are Sera, a helpful AI assistant. Be friendly, concise, and helpful in your responses."
        labels={{
          title: "Sera",
          initial: "Hi! I'm Sera. How can I help you today?",
          placeholder: "Ask Sera anything...",
        }}
      />
    </div>
  );
}
