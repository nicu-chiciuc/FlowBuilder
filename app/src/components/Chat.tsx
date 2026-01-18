import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

export function Chat() {
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [isSending, setIsSending] = useState(false);

  const getOrCreateConversation = useMutation(api.chat.getOrCreateConversation);
  const sendMessage = useAction(api.chat.sendMessage);
  const clearConversation = useMutation(api.chat.clearConversation);
  const messages = useQuery(
    api.chat.listMessages,
    conversationId ? { conversationId } : "skip"
  );

  useEffect(() => {
    void getOrCreateConversation().then(setConversationId);
  }, [getOrCreateConversation]);

  const handleSend = (content: string) => {
    if (!conversationId) return;

    setIsSending(true);
    sendMessage({ conversationId, content })
      .catch((error) => {
        console.error("Failed to send message:", error);
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  const handleClearChat = () => {
    if (!conversationId) return;
    if (!confirm("Clear all messages? This cannot be undone.")) return;

    clearConversation({ conversationId })
      .then(() => {
        console.log("Chat cleared");
      })
      .catch((error) => {
        console.error("Failed to clear chat:", error);
      });
  };

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end p-2 border-b border-slate-700">
        <button
          onClick={handleClearChat}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
          title="Clear chat history"
        >
          Clear Chat
        </button>
      </div>
      <MessageList messages={messages ?? []} />
      <MessageInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}
