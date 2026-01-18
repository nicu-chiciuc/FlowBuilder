# Streaming Chat Responses Specification

## Overview

Implement real-time streaming of AI responses so users see text appear progressively rather than waiting for complete responses. Uses Convex's reactive database subscriptions for a seamless experience.

## User Experience

### Before (Current)
1. User sends message
2. UI shows "Sending..." for 5-30 seconds
3. Complete response appears all at once

### After (Streaming)
1. User sends message
2. User message appears immediately
3. Empty assistant bubble appears with typing indicator
4. Text streams in progressively (character by character feel)
5. When complete, workflow processing indicators appear if applicable
6. User can click "Stop" to cancel generation mid-stream

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React Chat    │◀───▶│  Convex Query   │◀───▶│    Messages     │
│   (subscribes)  │     │  (reactive)     │     │    Table        │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        ▲
                                                        │ updates
                               ┌─────────────────┐      │
                               │                 │──────┘
                               │  Convex Action  │
                               │  (streaming)    │
                               │                 │◀──── Claude API
                               └─────────────────┘      (SSE stream)
```

### Flow

1. **User sends message** → `sendMessage` action starts
2. **Action creates placeholder** → Assistant message with `isStreaming: true`, empty content
3. **Action streams from Claude** → Uses `stream: true` in Claude API
4. **Action batches updates** → Every ~100ms, update message content via mutation
5. **Action completes** → Set `isStreaming: false`, process workflows/actions
6. **Frontend reacts** → `useQuery` subscription shows live updates

## Data Model Changes

### messages table
| Field | Type | Description |
|-------|------|-------------|
| ... | ... | (existing fields) |
| isStreaming | boolean? | True while response is being generated |
| streamingError | string? | Error message if streaming failed |

## Convex Functions

### Modified Functions

#### `sendMessage` (action)
Changes:
1. Create assistant message immediately with `isStreaming: true`
2. Use Claude streaming API (`stream: true`)
3. Batch content updates every ~100ms via `updateStreamingMessage` mutation
4. On completion: set `isStreaming: false`, process workflows
5. On error: set `streamingError`, `isStreaming: false`

#### `saveMessage` (mutation)
Add optional `isStreaming` parameter.

### New Functions

#### `updateStreamingMessage` (mutation)
```typescript
args: {
  messageId: v.id("messages"),
  content: v.string(),
  isStreaming: v.optional(v.boolean()),
  streamingError: v.optional(v.string()),
}
```
Updates message content and streaming status.

#### `stopStreaming` (mutation)
```typescript
args: {
  messageId: v.id("messages"),
}
```
Marks message as `isStreaming: false` (action checks this flag).

### Query Updates

#### `listMessages`
No changes needed - already returns all fields.

## UI Components

### MessageList.tsx Changes

1. **Streaming indicator**: Show animated dots or cursor when `isStreaming: true`
2. **Error state**: Show error message with retry option if `streamingError` exists
3. **Empty streaming message**: Don't show empty bubble, show typing indicator instead

### MessageInput.tsx Changes

1. **Stop button**: Show "Stop" button instead of "Send" when streaming
2. **Disable during streaming**: Input disabled while assistant is responding

### Chat.tsx Changes

1. **Track streaming state**: Monitor if any message has `isStreaming: true`
2. **Handle stop**: Call `stopStreaming` mutation when user clicks Stop
3. **Track message ID**: Store the streaming message ID for stop functionality

## Claude API Changes

### Streaming Request
```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": anthropicApiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    stream: true,  // Enable streaming
    system: systemPrompt,
    messages: claudeMessages,
  }),
});
```

### Processing SSE Stream
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let fullContent = "";
let lastUpdate = Date.now();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  
  // Parse SSE events from buffer
  const events = parseSSEEvents(buffer);
  
  for (const event of events) {
    if (event.type === "content_block_delta") {
      fullContent += event.delta.text;
    }
  }
  
  // Batch updates every 100ms
  if (Date.now() - lastUpdate > 100) {
    await ctx.runMutation(api.chat.updateStreamingMessage, {
      messageId,
      content: fullContent,
    });
    lastUpdate = Date.now();
  }
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Network error mid-stream | Show partial content + error indicator |
| Claude API error | Show error message, allow retry |
| User stops generation | Keep partial content, mark complete |
| Convex mutation fails | Retry up to 3 times, then show error |

## Visual Design

### Typing Indicator
- Three animated dots in assistant bubble color
- Positioned where message text would appear
- Disappears when first content chunk arrives

### Streaming Text
- Text appears with subtle fade-in per character/word
- Cursor blink at end of content (optional)
- Smooth scroll follows new content

### Stop Button
- Red/orange color to indicate action
- Icon: square (stop) instead of send arrow
- Tooltip: "Stop generating"

### Error State
- Red border on message bubble
- Error icon + message text
- "Retry" button below message

## Implementation Order

1. **Schema update**: Add `isStreaming` and `streamingError` fields
2. **New mutation**: `updateStreamingMessage`
3. **Backend streaming**: Modify `sendMessage` action for Claude streaming
4. **Frontend typing indicator**: Show while `isStreaming && !content`
5. **Frontend streaming display**: Show content as it updates
6. **Stop functionality**: Add stop button and `stopStreaming` mutation
7. **Error handling**: Handle and display streaming errors
8. **Polish**: Animations, scroll behavior, edge cases

## Performance Considerations

- **Batch updates**: Update DB every ~100ms, not per token (reduces writes)
- **Content diffing**: Frontend uses React's efficient re-rendering
- **Scroll throttling**: Don't scroll on every character, use RAF

## Future Enhancements

- [ ] Token count display during streaming
- [ ] Estimated time remaining
- [ ] Stream multiple responses (branching)
- [ ] Keyboard shortcut to stop (Escape)

---

*Status: Implemented*
*Created: 2026-01-19*
*Implemented: 2026-01-19*
