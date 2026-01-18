import { useState, FormEvent, KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  isStreaming?: boolean;
}

export function MessageInput({ onSend, onStop, disabled, isStreaming }: MessageInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Allow Escape to stop streaming
    if (e.key === "Escape" && isStreaming && onStop) {
      onStop();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 dark:border-slate-700 p-4">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the workflow you want to create..."
          disabled={disabled}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            title="Stop generating (Escape)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {isStreaming 
          ? "Press Escape or click Stop to cancel generation"
          : "Press Enter to send, Shift+Enter for new line"
        }
      </p>
    </form>
  );
}
