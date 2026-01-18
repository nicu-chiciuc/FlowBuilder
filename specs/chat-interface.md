# Chat Interface Specification

## Overview

A simple conversational interface for creating and managing n8n workflows through natural language. Users describe what they want, Claude interprets it and generates workflows, which are pushed to n8n via API.

## User Experience

1. User opens FlowBuilder → sees chat interface
2. User types: "Create a workflow that sends an HTTP request to httpbin.org every hour"
3. System processes request → creates workflow in n8n
4. System responds: "Created workflow 'Hourly HTTP Request'. Refresh your n8n dashboard to see it."
5. User switches to n8n tab, refreshes, sees new workflow

**Note:** n8n UI is not reactive to external API changes. Users must manually refresh to see updates.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React Chat    │────▶│  Convex Action  │────▶│   Claude API    │
│   Component     │     │  (sendMessage)  │     │                 │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │   n8n API       │
                        │                 │
                        └─────────────────┘
```

## Data Model

### conversations
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Auto-generated |
| _creationTime | number | Auto-generated |
| title | string? | Optional conversation title |

### messages
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Auto-generated |
| _creationTime | number | Auto-generated |
| conversationId | Id | Reference to conversation |
| role | "user" \| "assistant" | Message sender |
| content | string | Message text |
| workflowId | string? | n8n workflow ID if created |
| workflowName | string? | n8n workflow name if created |

## Convex Functions

### Queries
- `getOrCreateConversation()` - Returns existing conversation or creates new one
- `listMessages(conversationId)` - Returns all messages for a conversation (reactive)

### Actions
- `sendMessage(conversationId, content)` - Main orchestration:
  1. Save user message to DB
  2. Fetch conversation history for context
  3. Fetch current workflows, executions, and credentials from n8n API
  4. Build dynamic system prompt with complete workflow JSON + credentials
  5. Call Claude API with system prompt + history
  6. Parse response for workflow JSON:
     - `n8n-workflow-update` blocks → update existing workflow (PUT)
     - `n8n-workflow` blocks → create new workflow (POST)
  7. Parse response for action commands:
     - `n8n-action` blocks → execute action (activate/deactivate/delete)
  8. If workflow or action found, call appropriate n8n API endpoint
  9. Save assistant response (with workflowId if applicable)
  10. Return result

## Claude System Prompt

The system prompt is built dynamically and includes:
1. **Full workflow definitions** (fetched from n8n on each request) - Claude sees complete JSON for all workflows
2. **Recent executions** - for debugging context
3. **Available credentials** - so Claude knows what integrations are configured
4. Capabilities: list workflows, create workflows, modify workflows, activate/deactivate, delete, debug, answer questions
5. Instructions for generating n8n workflow JSON
6. Code block conventions:
   - `n8n-workflow` - for creating new workflows
   - `n8n-workflow-update` - for modifying existing workflows (requires `_updateId` field)
   - `n8n-action` - for workflow actions (activate/deactivate/delete)

## UI Components

### Chat.tsx
Main container component that:
- Fetches/creates conversation on mount
- Subscribes to messages via Convex query
- Renders MessageList and MessageInput

### MessageList.tsx
- Displays messages in chronological order
- Auto-scrolls to bottom on new messages
- Shows workflow creation badges when applicable

### MessageInput.tsx
- Text input with send button
- Disabled while processing
- Submits on Enter key

## Environment Variables (Convex)

```
N8N_API_URL=https://instance.app.n8n.cloud/api/v1
N8N_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

## Future Enhancements

- [ ] Embed n8n iframe for reactive updates
- [ ] Multiple conversations with sidebar
- [x] List existing workflows
- [x] Workflow modification (create and update)
- [x] Workflow deletion
- [x] Workflow activate/deactivate
- [x] Credentials context (Claude knows available integrations)
- [ ] Execution monitoring UI
- [ ] User authentication

---

*Status: In Progress*
*Last updated: 2026-01-19*
