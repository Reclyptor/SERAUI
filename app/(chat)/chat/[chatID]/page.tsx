import { redirect } from "next/navigation";
import { getChat } from "@/app/actions/chat";
import { getThreadWorkflowState } from "@/app/actions/media";
import { ChatContainer } from "../../../components/ChatContainer";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatID: string }>;
}) {
  const { chatID } = await params;

  try {
    const [chat, workflowState] = await Promise.all([
      getChat(chatID),
      getThreadWorkflowState(chatID),
    ]);
    return (
      <ChatContainer
        chatID={chat._id}
        initialMessages={chat.messages}
        initialWorkflowState={workflowState}
      />
    );
  } catch {
    redirect("/new");
  }
}
