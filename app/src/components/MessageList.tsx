import { useEffect, useRef } from "react";
import { Doc } from "../../convex/_generated/dataModel";

type Message = Doc<"messages">;

export function MessageList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>Start a conversation to create workflows</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message._id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          <FormattedContent content={message.content} />
        </div>
        {message.workflowId && (
          <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-600 text-sm">
            <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
              Workflow created: {message.workflowName}
            </span>
            <p className="mt-1 text-xs opacity-75">
              Refresh your n8n dashboard to see it
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  // Remove n8n-workflow code blocks from display (they're shown as badges)
  const cleanedContent = content.replace(/```n8n-workflow[\s\S]*?```/g, "");

  // Simple markdown-like formatting for code blocks
  const parts = cleanedContent.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, "");
          return (
            <pre
              key={i}
              className="mt-2 p-2 bg-slate-800 text-slate-100 rounded text-sm overflow-x-auto"
            >
              {code}
            </pre>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
