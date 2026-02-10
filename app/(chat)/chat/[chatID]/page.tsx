import { redirect } from "next/navigation";
import { getChat } from "@/app/actions/chat";
import { ChatContainer } from "../../../components/ChatContainer";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatID: string }>;
}) {
  const { chatID } = await params;

  try {
    const chat = await getChat(chatID);
    return <ChatContainer chatID={chat._id} initialMessages={chat.messages} />;
  } catch {
    redirect("/new");
  }
}
