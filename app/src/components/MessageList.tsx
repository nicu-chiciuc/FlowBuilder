import { useEffect, useRef } from "react";
import { Doc } from "../../convex/_generated/dataModel";

type Message = Doc<"messages">;

export function MessageList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    // Use requestAnimationFrame to ensure smooth scrolling
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>Start a conversation to create workflows</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message._id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 bg-slate-400 dark:bg-slate-300 animate-pulse ml-0.5 align-middle" />
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;
  const hasError = message.streamingError;
  const hasContent = message.content.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : hasError
              ? "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-slate-900 dark:text-slate-100"
              : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
        }`}
      >
        {/* Show typing indicator when streaming starts but no content yet */}
        {isStreaming && !hasContent && !hasError && (
          <TypingIndicator />
        )}

        {/* Show content with streaming cursor */}
        {hasContent && (
          <div className="whitespace-pre-wrap break-words">
            <FormattedContent content={message.content} />
            {isStreaming && <StreamingCursor />}
          </div>
        )}

        {/* Show error message if streaming failed */}
        {hasError && (
          <div className="text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm">{message.streamingError}</p>
            {hasContent && (
              <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-700">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Partial response:</p>
                <div className="text-slate-900 dark:text-slate-100">
                  <FormattedContent content={message.content} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show workflow badge */}
        {message.workflowId && !hasError && (
          <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-600 text-sm">
            <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
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
