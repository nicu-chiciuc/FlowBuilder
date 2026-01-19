import { useEffect, useRef, useState } from "react";
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
        <MessageWithToolCalls key={message._id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// Renders tool call bubbles followed by the message bubble
function MessageWithToolCalls({ message }: { message: Message }) {
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

  return (
    <>
      {/* Render each tool call as a separate bubble */}
      {hasToolCalls &&
        message.toolCalls!.map((tool, index) => (
          <ToolCallBubble key={`${message._id}-tool-${index}`} tool={tool} />
        ))}
      {/* Render the main message bubble */}
      <MessageBubble message={message} />
    </>
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

// Human-readable tool names and icons
const TOOL_CONFIG: Record<string, { label: string; icon: string; description: string }> = {
  think: {
    label: "Thinking",
    icon: "💭",
    description: "Reasoning about the task",
  },
  get_workflow: {
    label: "Inspecting workflow",
    icon: "🔍",
    description: "Fetching workflow details from n8n",
  },
  list_workflows: {
    label: "Listing workflows",
    icon: "📋",
    description: "Getting list of all workflows",
  },
  get_execution_details: {
    label: "Fetching execution details",
    icon: "📊",
    description: "Getting execution logs for debugging",
  },
};

// Format tool input for display (shown in collapsed preview)
function formatToolInputPreview(name: string, input: string | undefined): string | null {
  if (!input) return null;

  try {
    const parsed = JSON.parse(input);

    switch (name) {
      case "think":
        return null; // Don't show preview for think
      case "get_workflow":
        return parsed.workflow_id || null;
      case "get_execution_details":
        return parsed.execution_id || null;
      case "list_workflows":
        return null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Format tool output for display
function formatToolOutput(name: string, output: string | undefined): { label: string; value: string; isJson: boolean } | null {
  if (!output) return null;

  try {
    const parsed = JSON.parse(output);

    switch (name) {
      case "think":
        return null; // Think tool output is just { status: "ok" }
      case "get_workflow":
        return { label: "Workflow", value: JSON.stringify(parsed, null, 2), isJson: true };
      case "list_workflows":
        return { label: "Workflows", value: JSON.stringify(parsed, null, 2), isJson: true };
      case "get_execution_details":
        return { label: "Execution Details", value: JSON.stringify(parsed, null, 2), isJson: true };
      default:
        return { label: "Output", value: JSON.stringify(parsed, null, 2), isJson: true };
    }
  } catch {
    return { label: "Output", value: output, isJson: false };
  }
}

// Get the thought content from think tool input
function getThinkContent(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    return parsed.thought || null;
  } catch {
    return null;
  }
}

// Individual tool call bubble - displayed as a separate message, collapsible
function ToolCallBubble({ tool }: { tool: NonNullable<Message["toolCalls"]>[number] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = TOOL_CONFIG[tool.name] || { label: tool.name, icon: "🔧", description: "Tool call" };
  const isPending = tool.status === "pending";
  const isError = tool.status === "error";

  // Get preview text for collapsed state
  const inputPreview = formatToolInputPreview(tool.name, tool.input);

  // Get content for expanded state
  const thinkContent = getThinkContent(tool.input);
  const outputInfo = formatToolOutput(tool.name, tool.output);

  // Determine if this tool has expandable content
  const hasDetails = thinkContent !== null || outputInfo !== null;

  const statusIcon = isPending ? (
    <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ) : isError ? (
    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ) : (
    <span className="flex-shrink-0">{config.icon}</span>
  );

  const statusBadge = !isPending && (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${
        isError
          ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
          : "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
      }`}
    >
      {isError ? "Failed" : "Done"}
    </span>
  );

  const containerClasses = `rounded-lg text-sm overflow-hidden ${
    isPending
      ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
      : isError
        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
  }`;

  const textClasses = isPending
    ? "text-blue-700 dark:text-blue-300"
    : isError
      ? "text-red-700 dark:text-red-300"
      : "text-slate-700 dark:text-slate-300";

  // Non-expandable version (no details to show)
  if (!hasDetails) {
    return (
      <div className="flex justify-start">
        <div className={containerClasses}>
          <div className={`flex items-center gap-2 px-3 py-2 ${textClasses}`}>
            {statusIcon}
            <span className="font-medium">{config.label}</span>
            {inputPreview && (
              <span className="opacity-60 text-xs">
                ({inputPreview.length > 20 ? inputPreview.slice(0, 20) + "..." : inputPreview})
              </span>
            )}
            {statusBadge}
          </div>
        </div>
      </div>
    );
  }

  // Expandable version (has details)
  return (
    <div className="flex justify-start">
      <div className={containerClasses}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${textClasses}`}
        >
          {statusIcon}

          <div className="flex-1 text-left">
            <span className="font-medium">{config.label}</span>
            {!isExpanded && inputPreview && (
              <span className="ml-2 opacity-60 text-xs">
                ({inputPreview.length > 20 ? inputPreview.slice(0, 20) + "..." : inputPreview})
              </span>
            )}
          </div>

          {statusBadge}

          <svg
            className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700 space-y-2">
            {/* Show thought content for think tool */}
            {thinkContent && (
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Thought</div>
                <div className="text-sm bg-white dark:bg-slate-900 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {thinkContent}
                </div>
              </div>
            )}

            {/* Show output for other tools */}
            {outputInfo && (
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{outputInfo.label}</div>
                <div
                  className={`text-sm bg-white dark:bg-slate-900 rounded p-2 max-h-60 overflow-y-auto ${
                    outputInfo.isJson ? "font-mono text-xs" : ""
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-words">{outputInfo.value}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;
  const hasError = message.streamingError;
  const hasContent = message.content.length > 0;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

  // Don't render empty assistant message while only tool calls are happening
  if (!isUser && !hasContent && !hasError && isStreaming && hasToolCalls) {
    return null;
  }

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
