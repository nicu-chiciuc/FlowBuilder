# Tool-Based Workflow Inspection Specification

## Overview

Replace the current approach of embedding full workflow schemas in the system prompt with on-demand tool calls. This allows Claude to fetch workflow details when needed, reducing token usage and ensuring fresh data after edits.

## Problem Statement

### Current Approach
```
System Prompt contains:
- Full JSON of ALL workflows (can be huge)
- Recent execution summaries
- Credential metadata

Problems:
1. Token bloat: Every message includes all workflow JSON
2. Stale data: After AI edits a workflow, it can't see the update until next turn
3. Unnecessary: AI often doesn't need all workflow details for simple queries
```

### Proposed Approach
```
System Prompt contains:
- Summary list: workflow names, IDs, active status (minimal)
- Tool definitions for on-demand inspection
- Recent execution summaries (kept, as it's useful context)
- Credential metadata (kept, as it's small)

AI can call:
- get_workflow(id) → full workflow JSON
- list_workflows() → refresh the summary list
- think(thought) → reason about complex decisions
```

## Research: Extended Thinking vs. Think Tool

Based on Anthropic's documentation and engineering blog, there are two complementary approaches:

### Extended Thinking
- Happens **before** Claude generates a response
- Deep pre-response planning and reasoning
- Best for complex tasks needing step-by-step reasoning
- Enabled via `thinking: { type: "enabled", budget_tokens: N }`
- Adds latency but improves quality for complex tasks

### The "Think" Tool (Recommended for FlowBuilder)
- Happens **during** response generation
- Claude pauses mid-response to reflect on tool outputs
- **+54% improvement** on complex sequential tool use (τ-Bench airline domain)
- Best for:
  - Analyzing tool outputs before deciding next steps
  - Following complex policies/guidelines
  - Sequential decision-making where mistakes compound

**Source**: [The "think" tool: Enabling Claude to stop and think](https://www.anthropic.com/engineering/claude-think-tool)

### Recommendation for FlowBuilder

Use the **"think" tool** approach because:
1. Workflow modification is sequential: inspect → reason → modify → verify
2. Claude needs to analyze workflow JSON before deciding how to modify
3. Minimal implementation overhead (just define the tool)
4. No additional API complexity (unlike extended thinking)

Extended thinking can be added later for complex workflow generation tasks.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Conversation Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "Add an email step to the Daily Report workflow"         │
│                                                                  │
│  Claude: → calls tool: get_workflow("workflow-123")              │
│                                                                  │
│  System: Returns full workflow JSON                              │
│                                                                  │
│  Claude: → calls tool: think("The workflow has 3 nodes...")      │
│          (reasons about structure and where to add email)        │
│                                                                  │
│  Claude: → generates n8n-workflow-update block                   │
│                                                                  │
│  System: Updates workflow, returns success                       │
│                                                                  │
│  Claude: → calls tool: get_workflow("workflow-123")              │
│          (verifies the changes)                                  │
│                                                                  │
│  Claude: "Done! I've added the email step. Here's what changed:" │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tool Definitions

### `think`

A "scratchpad" for Claude to reason about workflow structure and decisions.

```json
{
  "name": "think",
  "description": "Use this tool to think through complex decisions. Use it to analyze workflow structure after fetching it, plan modifications, or reason about execution logs. This helps you make better decisions before taking action. The thought will not be shown to the user.",
  "input_schema": {
    "type": "object",
    "properties": {
      "thought": {
        "type": "string",
        "description": "Your reasoning or analysis"
      }
    },
    "required": ["thought"]
  }
}
```

**When to use:**
- After fetching a workflow, before modifying it
- When analyzing execution logs to diagnose issues
- When deciding between multiple approaches
- Before generating complex workflow JSON

**Returns:** `{ "status": "ok" }` (the tool just logs the thought, no side effects)

### `get_workflow`

Fetch the full JSON definition of a specific workflow.

```json
{
  "name": "get_workflow",
  "description": "Get the full JSON definition of a workflow by its ID. Use this when you need to inspect, modify, or understand the details of a specific workflow. Returns the complete workflow including all nodes, connections, and settings.",
  "input_schema": {
    "type": "object",
    "properties": {
      "workflow_id": {
        "type": "string",
        "description": "The ID of the workflow to fetch"
      }
    },
    "required": ["workflow_id"]
  }
}
```

**Returns:**
```json
{
  "id": "abc123",
  "name": "Daily Report",
  "active": true,
  "nodes": [...],
  "connections": {...},
  "settings": {...}
}
```

### `list_workflows`

Refresh the list of all workflows with current status.

```json
{
  "name": "list_workflows",
  "description": "Get an updated list of all workflows with their current status. Use this to refresh your knowledge of what workflows exist, especially after creating or deleting workflows.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**Returns:**
```json
{
  "workflows": [
    { "id": "abc123", "name": "Daily Report", "active": true },
    { "id": "def456", "name": "Slack Notifications", "active": false }
  ],
  "count": 2
}
```

### `get_execution_details`

Get detailed information about a specific workflow execution.

```json
{
  "name": "get_execution_details",
  "description": "Get detailed information about a specific workflow execution, including the data that flowed through each node. Use this for debugging failed executions or understanding what happened during a run.",
  "input_schema": {
    "type": "object",
    "properties": {
      "execution_id": {
        "type": "string",
        "description": "The ID of the execution to inspect"
      }
    },
    "required": ["execution_id"]
  }
}
```

**Returns:**
```json
{
  "id": "exec-789",
  "workflowId": "abc123",
  "workflowName": "Daily Report",
  "status": "error",
  "startedAt": "2026-01-19T10:30:00Z",
  "stoppedAt": "2026-01-19T10:30:05Z",
  "error": {
    "message": "HTTP request failed: 404 Not Found",
    "node": "HTTP Request"
  },
  "nodeResults": {
    "Start": { "status": "success", "outputItems": 1 },
    "HTTP Request": { "status": "error", "error": "404 Not Found" }
  }
}
```

## System Prompt Changes

### Before (Current)
```
## Current Workflows
### "Daily Report" (ID: abc123, active)
```json
{
  "name": "Daily Report",
  "nodes": [... full JSON ...],
  "connections": {...}
}
```
### "Slack Notifications" (ID: def456, inactive)
```json
{... full JSON ...}
```
```

### After (Proposed)
```
## Available Workflows
You have 2 workflows:
- **Daily Report** (ID: abc123) - active
- **Slack Notifications** (ID: def456) - inactive

## Tools Available
- `get_workflow(workflow_id)` - Fetch full workflow JSON before inspecting or modifying
- `list_workflows()` - Refresh the workflow list after creating or deleting
- `get_execution_details(execution_id)` - Get detailed execution info for debugging
- `think(thought)` - Reason about complex decisions (use after fetching data)

**Best Practice**: Always call `get_workflow` before modifying a workflow, then use `think` to reason about the structure before generating updates.

## Recent Executions (Logs)
- **Daily Report** (exec-001): SUCCESS at 2026-01-19T08:00:00Z
- **Daily Report** (exec-002): ERROR at 2026-01-19T09:00:00Z
  Error: HTTP request failed
```

## Claude API Integration

### Request Format

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
    stream: true,
    system: systemPrompt,
    messages: claudeMessages,
    tools: [
      {
        name: "think",
        description: "Use this tool to think through complex decisions...",
        input_schema: {
          type: "object",
          properties: {
            thought: { type: "string", description: "Your reasoning or analysis" }
          },
          required: ["thought"]
        }
      },
      {
        name: "get_workflow",
        description: "Get the full JSON definition of a workflow...",
        input_schema: { ... }
      },
      {
        name: "list_workflows",
        description: "Get an updated list of all workflows...",
        input_schema: { ... }
      },
      {
        name: "get_execution_details",
        description: "Get detailed information about an execution...",
        input_schema: { ... }
      }
    ]
  }),
});
```

### SSE Events for Tool Use

When streaming, Claude may emit tool use blocks:

```
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_123","name":"get_workflow","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"workflow_id\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\"abc123\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}

event: message_stop
data: {"type":"message_stop"}
```

### Tool Execution Loop

When Claude calls a tool:

1. **Detect tool_use stop_reason**: Message ends with `stop_reason: "tool_use"`
2. **Execute the tool(s)**: Call the appropriate function(s)
3. **Continue conversation**: Send a new request with the tool result:

```typescript
messages: [
  ...previousMessages,
  {
    role: "assistant",
    content: [
      { type: "tool_use", id: "toolu_123", name: "get_workflow", input: { workflow_id: "abc123" } }
    ]
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_123", content: JSON.stringify(workflowData) }
    ]
  }
]
```

4. **Repeat**: Claude may call more tools or generate final response (`stop_reason: "end_turn"`)

### Multiple Tool Calls

Claude can request multiple tools in one response. Execute all tools and return all results:

```typescript
// Assistant message with multiple tool calls
{
  role: "assistant",
  content: [
    { type: "tool_use", id: "toolu_1", name: "get_workflow", input: { workflow_id: "abc" } },
    { type: "tool_use", id: "toolu_2", name: "get_execution_details", input: { execution_id: "exec-1" } }
  ]
}

// User message with multiple tool results
{
  role: "user",
  content: [
    { type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify(workflow) },
    { type: "tool_result", tool_use_id: "toolu_2", content: JSON.stringify(execution) }
  ]
}
```

## Implementation Plan

### Phase 1: Backend Changes

1. **Add tool definitions constant**
   ```typescript
   const FLOWBUILDER_TOOLS = [
     { name: "think", ... },
     { name: "get_workflow", ... },
     { name: "list_workflows", ... },
     { name: "get_execution_details", ... }
   ];
   ```

2. **Create tool execution functions**
   - `executeThink(thought)`: Log thought, return `{ status: "ok" }`
   - `executeGetWorkflow(workflowId)`: Fetch single workflow from n8n
   - `executeListWorkflows()`: Fetch all workflows, return summaries
   - `executeGetExecutionDetails(executionId)`: Fetch execution details

3. **Simplify `buildSystemPrompt`**
   - Remove full workflow JSON embedding
   - Keep only summary: name, ID, active status
   - Keep execution summaries and credentials as-is (small)
   - Add tool usage guidance

### Phase 2: Streaming Handler Changes

1. **Track content blocks during streaming**
   - Accumulate both text and tool_use blocks
   - Parse `input_json_delta` events to build tool input JSON

2. **Handle tool_use stop reason**
   - When stream ends with `stop_reason: "tool_use"`:
     1. Execute all requested tools
     2. Build continuation messages
     3. Make another streaming request
   - Loop until `stop_reason: "end_turn"`

3. **Streaming UI during tool calls**
   - Stream partial text to user as it arrives
   - When tool is called, optionally show indicator (e.g., "Inspecting workflow...")
   - Continue streaming after tool result

4. **Persist tool interactions in conversation**
   - Tool calls and results should be part of conversation history
   - Enables Claude to reference previous tool outputs

### Phase 3: Testing

1. **Basic tool usage**
   - "What's in the Daily Report workflow?" → should call get_workflow

2. **Think tool usage**
   - "Add an email node to Daily Report" → should:
     1. Call get_workflow to see current state
     2. Call think to reason about structure
     3. Generate n8n-workflow-update

3. **Post-edit verification**
   - After updating a workflow, Claude should optionally call get_workflow to verify

4. **Debugging**
   - "Why did my last execution fail?" → should call get_execution_details, then think

## Token Usage Comparison

### Before: 3 workflows, ~500 nodes total
- System prompt: ~15,000 tokens (all workflow JSON)
- Per message: 15,000 + conversation tokens

### After: 3 workflows, using tools
- System prompt: ~500 tokens (summaries + tool definitions)
- Tool definitions: ~400 tokens
- Per tool call: ~200-2000 tokens (depending on workflow size)
- Think tool: ~100-500 tokens per use
- Only fetch what's needed!

**Estimated savings**: 70-90% reduction in average token usage

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Tool fetch fails (network error) | Return error message to Claude, it can retry or inform user |
| Workflow not found | Return `{ "error": "Workflow not found" }` to Claude |
| Execution not found | Return `{ "error": "Execution not found" }` to Claude |
| Invalid tool input | Return `{ "error": "Invalid input: ..." }` to Claude |
| Think tool | Always succeeds, returns `{ "status": "ok" }` |

## Future Enhancements

- [ ] **Extended thinking** - For complex workflow generation (add `thinking` parameter)
- [ ] **Interleaved thinking** - Use `interleaved-thinking-2025-05-14` beta header for reasoning between tool calls
- [ ] `search_workflows(query)` - Find workflows by name/content
- [ ] `get_workflow_diff(id, version1, version2)` - Compare workflow versions
- [ ] Caching: Cache workflow data during a conversation to reduce API calls
- [ ] `run_workflow(id, input?)` - Manually trigger a workflow execution

---

*Status: Implemented*
*Created: 2026-01-19*
*Updated: 2026-01-19 - Added think tool based on Anthropic research*
*Implemented: 2026-01-19 - Tool-based inspection with streaming tool use loop*
