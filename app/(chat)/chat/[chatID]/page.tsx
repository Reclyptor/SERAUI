import { redirect } from "next/navigation";
import { getChat, type Chat } from "@/app/actions/chat";
import { ChatContainer } from "../../../components/ChatContainer";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatID: string }>;
}) {
  const { chatID } = await params;
  let chat: Chat;

  try {
    chat = await getChat(chatID);
  } catch {
    redirect("/new");
  }

  return (
    <ChatContainer
      chatID={chat._id}
      initialMessages={chat.messages}
      initialModel={chat.model}
      initialAgentID={chat.agentID}
    />
  );
}
