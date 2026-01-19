import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Tool definitions for Claude to inspect workflows on-demand
// Based on Anthropic's "think" tool research for improved sequential decision-making
const FLOWBUILDER_TOOLS = [
  {
    name: "think",
    description:
      "Use this tool to think through complex decisions. Use it to analyze workflow structure after fetching it, plan modifications, or reason about execution logs. This helps you make better decisions before taking action. The thought will not be shown to the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        thought: {
          type: "string",
          description: "Your reasoning or analysis",
        },
      },
      required: ["thought"],
    },
  },
  {
    name: "get_workflow",
    description:
      "Get the full JSON definition of a workflow by its ID. Use this when you need to inspect, modify, or understand the details of a specific workflow. Returns the complete workflow including all nodes, connections, and settings. Always call this before modifying a workflow.",
    input_schema: {
      type: "object" as const,
      properties: {
        workflow_id: {
          type: "string",
          description: "The ID of the workflow to fetch",
        },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "list_workflows",
    description:
      "Get an updated list of all workflows with their current status. Use this to refresh your knowledge of what workflows exist, especially after creating or deleting workflows.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_execution_details",
    description:
      "Get detailed information about a specific workflow execution, including the data that flowed through each node. Use this for debugging failed executions or understanding what happened during a run.",
    input_schema: {
      type: "object" as const,
      properties: {
        execution_id: {
          type: "string",
          description: "The ID of the execution to inspect",
        },
      },
      required: ["execution_id"],
    },
  },
];

// Build system prompt with workflow SUMMARIES only (not full JSON)
// Claude uses tools to fetch full details on-demand
function buildSystemPrompt(
  workflowSummaries: Array<{ id: string; name: string; active: boolean }>,
  executions: N8nExecution[],
  credentials: N8nCredential[]
) {
  let workflowSection: string;

  if (workflowSummaries.length === 0) {
    workflowSection = "No workflows exist yet.";
  } else {
    workflowSection = workflowSummaries
      .map((w) => `- **${w.name}** (ID: ${w.id}) - ${w.active ? "active" : "inactive"}`)
      .join("\n");
  }

  let executionSection: string;

  if (executions.length === 0) {
    executionSection = "No recent executions.";
  } else {
    executionSection = executions
      .slice(0, 10) // Limit to 10 most recent
      .map((e) => {
        const workflowName =
          workflowSummaries.find((w) => w.id === e.workflowId)?.name || "Unknown";
        let summary = `- **${workflowName}** (exec ID: ${e.id}): ${e.status.toUpperCase()} at ${e.startedAt}`;

        if (e.status === "error" && e.data?.resultData?.error) {
          summary += `\n  Error: ${e.data.resultData.error.message}`;
        }

        return summary;
      })
      .join("\n");
  }

  let credentialSection: string;

  if (credentials.length === 0) {
    credentialSection =
      "No credentials configured. The user will need to set up credentials in n8n before using integrations that require authentication.";
  } else {
    credentialSection = credentials.map((c) => `- **${c.name}** (type: ${c.type})`).join("\n");
  }

  return `You are FlowBuilder, an AI assistant that helps users create and manage n8n workflows through natural language.

## Available Workflows
${workflowSection}

## Tools Available
You have tools to inspect workflows and executions on-demand:
- \`get_workflow(workflow_id)\` - Fetch full workflow JSON before inspecting or modifying
- \`list_workflows()\` - Refresh the workflow list after creating or deleting
- \`get_execution_details(execution_id)\` - Get detailed execution info for debugging
- \`think(thought)\` - Reason about complex decisions (use after fetching data)

**Best Practice**: Always call \`get_workflow\` before modifying a workflow, then use \`think\` to reason about the structure before generating updates.

## Recent Executions (Logs)
${executionSection}

Use \`get_execution_details\` with the exec ID to get detailed node-by-node results for debugging.

## Available Credentials
${credentialSection}

## Capabilities
1. **List workflows**: Describe what exists based on the workflow list above.
2. **Create workflows**: Generate valid n8n workflow JSON when the user describes what they want.
3. **Modify workflows**: Use \`get_workflow\` first to see current state, then generate updates.
4. **Activate/Deactivate workflows**: Turn workflows on or off.
5. **Delete workflows**: Remove workflows when requested.
6. **Debug workflows**: Use \`get_execution_details\` to analyze failures.
7. **Answer questions**: Help users understand workflows and automation concepts.

## Creating Workflows
When creating a NEW workflow:
1. Generate valid n8n workflow JSON
2. Wrap the JSON in a code block with language "n8n-workflow"
3. Explain what the workflow does

Example:
"I'll create a workflow that does X.

\`\`\`n8n-workflow
{
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {...}
}
\`\`\`

This workflow will [explanation]."

## Modifying Workflows
When MODIFYING an existing workflow:
1. FIRST call \`get_workflow\` to fetch the current workflow definition
2. Use \`think\` to analyze the structure and plan your changes
3. Generate the COMPLETE updated workflow JSON (not just the changes)
4. Wrap the JSON in a code block with language "n8n-workflow-update"
5. Include the workflow ID in the JSON as "_updateId" field
6. Explain what was changed

Example flow:
1. Call get_workflow("abc123")
2. Call think("The workflow has nodes X, Y, Z connected like this... I need to add node W after Y...")
3. Generate the update:

\`\`\`n8n-workflow-update
{
  "_updateId": "abc123",
  "name": "Daily Report",
  "nodes": [...],
  "connections": {...}
}
\`\`\`

IMPORTANT: When modifying, you must provide the COMPLETE workflow definition, not just the parts that changed. The entire workflow will be replaced with what you provide.

## Workflow Actions (Activate/Deactivate/Delete)
When performing actions on workflows, use the "n8n-action" code block:

\`\`\`n8n-action
{"action": "activate", "workflowId": "workflow-id-here"}
\`\`\`

Available actions:
- **activate**: Turn on a workflow so it runs on its trigger schedule
- **deactivate**: Turn off a workflow to stop it from running
- **delete**: Permanently remove a workflow (ask for confirmation first!)

Always explain what you're doing and confirm with the user before deleting workflows.

## n8n Workflow Structure
- Every workflow needs at least one trigger node (e.g., manualTrigger, scheduleTrigger, webhook)
- Nodes have: name, type, position (array of [x, y]), parameters
- Connections define data flow between nodes
- Common node types: n8n-nodes-base.manualTrigger, n8n-nodes-base.httpRequest, n8n-nodes-base.set, n8n-nodes-base.if

If the user asks questions, wants clarification, or is just chatting, respond conversationally without generating a workflow.`;
}

// Type for n8n workflow data
interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: Array<{
    name: string;
    type: string;
    position: [number, number];
    parameters: Record<string, unknown>;
  }>;
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

// Type for n8n execution data
interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  status: "success" | "error" | "waiting" | "running";
  startedAt: string;
  stoppedAt?: string;
  data?: {
    resultData?: {
      error?: {
        message: string;
        stack?: string;
      };
      runData?: Record<string, Array<{
        data: { main: Array<Array<{ json: Record<string, unknown> }>> };
        error?: { message: string };
      }>>;
    };
  };
}

// Helper to fetch workflows from n8n (full details)
async function fetchN8nWorkflows(): Promise<N8nWorkflow[]> {
  const n8nApiUrl = process.env.N8N_API_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  if (!n8nApiUrl || !n8nApiKey) {
    return [];
  }

  try {
    const response = await fetch(`${n8nApiUrl}/api/v1/workflows`, {
      headers: { "X-N8N-API-KEY": n8nApiKey },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.data || []).map((w: N8nWorkflow) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      nodes: w.nodes || [],
      connections: w.connections || {},
      settings: w.settings,
    }));
  } catch {
    return [];
  }
}

// Helper to fetch recent executions from n8n
async function fetchN8nExecutions(limit = 20): Promise<N8nExecution[]> {
  const n8nApiUrl = process.env.N8N_API_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  if (!n8nApiUrl || !n8nApiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `${n8nApiUrl}/api/v1/executions?limit=${limit}&includeData=true`,
      {
        headers: { "X-N8N-API-KEY": n8nApiKey },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return (data.data || []).map((e: N8nExecution) => ({
      id: e.id,
      workflowId: e.workflowId,
      finished: e.finished,
      mode: e.mode,
      status: e.status,
      startedAt: e.startedAt,
      stoppedAt: e.stoppedAt,
      data: e.data,
    }));
  } catch {
    return [];
  }
}

// Generic n8n API call helper
async function n8nApiCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const n8nApiUrl = process.env.N8N_API_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  if (!n8nApiUrl || !n8nApiKey) {
    return { success: false, error: "n8n API not configured" };
  }

  try {
    const response = await fetch(`${n8nApiUrl}/api/v1${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": n8nApiKey,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (response.ok) {
      // DELETE returns 204 with no body
      if (response.status === 204) {
        return { success: true };
      }
      const data = await response.json();
      return { success: true, data };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// Type for n8n credential metadata
interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

// Helper to fetch credentials from n8n
async function fetchN8nCredentials(): Promise<N8nCredential[]> {
  const result = await n8nApiCall("GET", "/credentials");
  if (!result.success || !result.data) return [];

  const data = result.data as { data?: N8nCredential[] };
  return (data.data || []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

// Helper to update a workflow in n8n
async function updateWorkflow(
  workflowId: string,
  workflowJson: Record<string, unknown>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const result = await n8nApiCall("PUT", `/workflows/${workflowId}`, workflowJson);
  if (result.success && result.data) {
    const data = result.data as { id: string };
    return { success: true, id: data.id };
  }
  return { success: false, error: result.error };
}

// Type for n8n action parameters
type N8nAction =
  | { action: "activate"; workflowId: string }
  | { action: "deactivate"; workflowId: string }
  | { action: "delete"; workflowId: string };

// Execute an n8n action from AI response
async function executeN8nAction(
  actionParams: N8nAction
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const { action, workflowId } = actionParams;

  switch (action) {
    case "activate": {
      const result = await n8nApiCall("POST", `/workflows/${workflowId}/activate`);
      return {
        success: result.success,
        message: result.success
          ? `Workflow ${workflowId} activated`
          : `Failed to activate: ${result.error}`,
        data: result.data,
      };
    }
    case "deactivate": {
      const result = await n8nApiCall("POST", `/workflows/${workflowId}/deactivate`);
      return {
        success: result.success,
        message: result.success
          ? `Workflow ${workflowId} deactivated`
          : `Failed to deactivate: ${result.error}`,
        data: result.data,
      };
    }
    case "delete": {
      const result = await n8nApiCall("DELETE", `/workflows/${workflowId}`);
      return {
        success: result.success,
        message: result.success
          ? `Workflow ${workflowId} deleted`
          : `Failed to delete: ${result.error}`,
      };
    }
  }
}

// Tool execution functions for Claude tool use
// These are called when Claude requests to use a tool during conversation

type ToolResult = { content: string; isError?: boolean };

async function executeThink(thought: string): Promise<ToolResult> {
  // The think tool just logs the thought - no side effects
  // This gives Claude a "scratchpad" to reason through complex decisions
  console.log("[Think tool]:", thought.substring(0, 100) + (thought.length > 100 ? "..." : ""));
  return { content: JSON.stringify({ status: "ok" }) };
}

async function executeGetWorkflow(workflowId: string): Promise<ToolResult> {
  const result = await n8nApiCall("GET", `/workflows/${workflowId}`);
  if (!result.success) {
    return {
      content: JSON.stringify({ error: result.error || "Failed to fetch workflow" }),
      isError: true,
    };
  }
  // Return full workflow JSON
  return { content: JSON.stringify(result.data) };
}

async function executeListWorkflows(): Promise<ToolResult> {
  const workflows = await fetchN8nWorkflows();
  const summaries = workflows.map((w) => ({
    id: w.id,
    name: w.name,
    active: w.active,
  }));
  return {
    content: JSON.stringify({ workflows: summaries, count: summaries.length }),
  };
}

async function executeGetExecutionDetails(executionId: string): Promise<ToolResult> {
  const result = await n8nApiCall("GET", `/executions/${executionId}`);
  if (!result.success) {
    return {
      content: JSON.stringify({ error: result.error || "Failed to fetch execution" }),
      isError: true,
    };
  }

  const exec = result.data as N8nExecution;

  // Build a summary of node results
  const nodeResults: Record<string, { status: string; error?: string; outputItems?: number }> = {};
  if (exec.data?.resultData?.runData) {
    for (const [nodeName, runs] of Object.entries(exec.data.resultData.runData)) {
      const lastRun = runs[runs.length - 1];
      if (lastRun?.error) {
        nodeResults[nodeName] = { status: "error", error: lastRun.error.message };
      } else if (lastRun?.data?.main) {
        const itemCount = lastRun.data.main.reduce((sum, arr) => sum + (arr?.length || 0), 0);
        nodeResults[nodeName] = { status: "success", outputItems: itemCount };
      }
    }
  }

  const summary = {
    id: exec.id,
    workflowId: exec.workflowId,
    status: exec.status,
    startedAt: exec.startedAt,
    stoppedAt: exec.stoppedAt,
    error: exec.data?.resultData?.error,
    nodeResults,
  };

  return { content: JSON.stringify(summary) };
}

// Main tool executor - routes to appropriate function
async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "think":
      return executeThink(input.thought as string);
    case "get_workflow":
      return executeGetWorkflow(input.workflow_id as string);
    case "list_workflows":
      return executeListWorkflows();
    case "get_execution_details":
      return executeGetExecutionDetails(input.execution_id as string);
    default:
      return {
        content: JSON.stringify({ error: `Unknown tool: ${name}` }),
        isError: true,
      };
  }
}

// Get or create the default conversation
export const getOrCreateConversation = mutation({
  args: {},
  handler: async (ctx) => {
    // For MVP, just get the most recent conversation or create one
    const existing = await ctx.db.query("conversations").order("desc").first();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("conversations", { title: "New Chat" });
  },
});

// List messages for a conversation
export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
  },
});

// Clear all messages in a conversation
export const clearConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete("messages", message._id);
    }

    return { deletedCount: messages.length };
  },
});

// Internal mutation to save a message
export const saveMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    workflowId: v.optional(v.string()),
    workflowName: v.optional(v.string()),
    isStreaming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

// Update a streaming message with new content
export const updateStreamingMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
    streamingError: v.optional(v.string()),
    workflowId: v.optional(v.string()),
    workflowName: v.optional(v.string()),
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          input: v.optional(v.string()),
          output: v.optional(v.string()),
          status: v.union(v.literal("pending"), v.literal("success"), v.literal("error")),
        })
      )
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { messageId, content, isStreaming, streamingError, workflowId, workflowName, toolCalls } = args;
    const updates: {
      content: string;
      isStreaming?: boolean;
      streamingError?: string;
      workflowId?: string;
      workflowName?: string;
      toolCalls?: Array<{ name: string; input?: string; output?: string; status: "pending" | "success" | "error" }>;
    } = { content };
    if (isStreaming !== undefined) updates.isStreaming = isStreaming;
    if (streamingError !== undefined) updates.streamingError = streamingError;
    if (workflowId !== undefined) updates.workflowId = workflowId;
    if (workflowName !== undefined) updates.workflowName = workflowName;
    if (toolCalls !== undefined) updates.toolCalls = toolCalls;
    await ctx.db.patch("messages", messageId, updates);
    return null;
  },
});

// Stop a streaming message
export const stopStreaming = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("messages", args.messageId, { isStreaming: false });
    return null;
  },
});

// Helper to parse SSE events from Claude streaming response
function parseSSEEvents(buffer: string): { events: Array<{ type: string; data: unknown }>; remaining: string } {
  const events: Array<{ type: string; data: unknown }> = [];
  const lines = buffer.split("\n");
  let remaining = "";
  let currentEvent: { type?: string; data?: string } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If this is the last line and doesn't end with newline, it's incomplete
    if (i === lines.length - 1 && !buffer.endsWith("\n")) {
      remaining = line;
      break;
    }

    if (line.startsWith("event: ")) {
      currentEvent.type = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      currentEvent.data = line.slice(6);
    } else if (line === "" && currentEvent.type && currentEvent.data) {
      try {
        events.push({
          type: currentEvent.type,
          data: JSON.parse(currentEvent.data),
        });
      } catch {
        // Ignore parse errors
      }
      currentEvent = {};
    }
  }

  return { events, remaining };
}

// Process workflow operations from assistant content
async function processWorkflowOperations(
  assistantContent: string
): Promise<{ workflowId?: string; workflowName?: string }> {
  let workflowId: string | undefined;
  let workflowName: string | undefined;

  // Check for workflow update first (more specific pattern)
  const updateMatch = assistantContent.match(
    /```n8n-workflow-update\s*([\s\S]*?)```/
  );

  // Check for new workflow creation
  const createMatch = assistantContent.match(
    /```n8n-workflow\s*([\s\S]*?)```/
  );

  if (updateMatch) {
    try {
      const workflowJson = JSON.parse(updateMatch[1].trim());
      const updateId = workflowJson._updateId;
      workflowName = workflowJson.name || "Untitled Workflow";

      if (!updateId) {
        console.error("Workflow update missing _updateId field");
      } else {
        delete workflowJson._updateId;
        const result = await updateWorkflow(updateId, workflowJson);
        if (result.success) {
          workflowId = result.id;
        } else {
          console.error("n8n API error:", result.error);
        }
      }
    } catch (e) {
      console.error("Failed to parse or update workflow:", e);
    }
  } else if (createMatch) {
    try {
      const workflowJson = JSON.parse(createMatch[1].trim());
      workflowName = workflowJson.name || "Untitled Workflow";

      const n8nApiUrl = process.env.N8N_API_URL;
      const n8nApiKey = process.env.N8N_API_KEY;

      if (!n8nApiUrl || !n8nApiKey) {
        throw new Error("n8n API not configured");
      }

      const n8nResponse = await fetch(`${n8nApiUrl}/api/v1/workflows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": n8nApiKey,
        },
        body: JSON.stringify(workflowJson),
      });

      if (n8nResponse.ok) {
        const n8nData = await n8nResponse.json();
        workflowId = n8nData.id;
      } else {
        const n8nError = await n8nResponse.text();
        console.error("n8n API error:", n8nError);
      }
    } catch (e) {
      console.error("Failed to parse or create workflow:", e);
    }
  }

  // Check for action commands
  const actionMatch = assistantContent.match(
    /```n8n-action\s*([\s\S]*?)```/
  );

  if (actionMatch) {
    try {
      const actionJson = JSON.parse(actionMatch[1].trim()) as {
        action?: string;
        workflowId?: string;
      };
      const { action, workflowId: actionWorkflowId } = actionJson;

      if (
        action &&
        actionWorkflowId &&
        (action === "activate" || action === "deactivate" || action === "delete")
      ) {
        const actionResult = await executeN8nAction({ action, workflowId: actionWorkflowId });
        if (actionResult.success) {
          console.log(`Action ${action} succeeded:`, actionResult.message);
        } else {
          console.error(`Action ${action} failed:`, actionResult.message);
        }
      }
    } catch (e) {
      console.error("Failed to parse or execute action:", e);
    }
  }

  return { workflowId, workflowName };
}

// Type for message from listMessages query
interface MessageDoc {
  _id: Id<"messages">;
  _creationTime: number;
  conversationId: Id<"conversations">;
  role: "user" | "assistant";
  content: string;
  workflowId?: string;
  workflowName?: string;
  isStreaming?: boolean;
  streamingError?: string;
  toolCalls?: Array<{
    name: string;
    input?: string;
    output?: string;
    status: "pending" | "success" | "error";
  }>;
}

// Type for tracking tool calls during streaming
type TrackedToolCall = {
  name: string;
  input: string;
  output?: string;
  status: "pending" | "success" | "error";
};

// Main action: send a message and get AI response with streaming
export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.object({
    workflowId: v.optional(v.string()),
    workflowName: v.optional(v.string()),
    messageId: v.id("messages"),
  }),
  handler: async (ctx, args): Promise<{ workflowId?: string; workflowName?: string; messageId: Id<"messages"> }> => {
    // 1. Save user message
    await ctx.runMutation(api.chat.saveMessage, {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
    });

    // 2. Get conversation history for context
    const messages: MessageDoc[] = await ctx.runQuery(api.chat.listMessages, {
      conversationId: args.conversationId,
    });

    // 3. Build Claude messages array (exclude messages still streaming)
    const claudeMessages = messages
      .filter((msg: MessageDoc) => !msg.isStreaming)
      .map((msg: MessageDoc) => ({
        role: msg.role,
        content: msg.content,
      }));

    // 4. Fetch current workflows (summaries only), executions, and credentials for context
    const [workflows, executions, credentials] = await Promise.all([
      fetchN8nWorkflows(),
      fetchN8nExecutions(),
      fetchN8nCredentials(),
    ]);
    // Convert to summaries for the system prompt (full details fetched via tools)
    const workflowSummaries = workflows.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
    }));
    const systemPrompt = buildSystemPrompt(workflowSummaries, executions, credentials);

    // 5. Create placeholder assistant message for streaming
    const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.chat.saveMessage, {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    // 6. Call Claude API with streaming
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      await ctx.runMutation(api.chat.updateStreamingMessage, {
        messageId: assistantMessageId,
        content: "",
        isStreaming: false,
        streamingError: "ANTHROPIC_API_KEY not configured",
      });
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    let fullTextContent = "";
    let workflowId: string | undefined;
    let workflowName: string | undefined;

    // Track all tool calls across iterations for UI display
    const allToolCalls: TrackedToolCall[] = [];

    // Messages for the tool use loop - starts with conversation history
    type ClaudeMessage = {
      role: "user" | "assistant";
      content: string | Array<{
        type: "text" | "tool_use" | "tool_result";
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
        tool_use_id?: string;
        content?: string;
        is_error?: boolean;
      }>;
    };
    const currentMessages: ClaudeMessage[] = [...claudeMessages];

    try {
      const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops
      let iteration = 0;

      // Tool use loop - continue until Claude stops calling tools
      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;

        // Make streaming request to Claude
        const claudeResponse = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
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
              messages: currentMessages,
              tools: FLOWBUILDER_TOOLS,
            }),
          }
        );

        if (!claudeResponse.ok) {
          const error = await claudeResponse.text();
          await ctx.runMutation(api.chat.updateStreamingMessage, {
            messageId: assistantMessageId,
            content: "",
            isStreaming: false,
            streamingError: `Claude API error: ${error}`,
          });
          throw new Error(`Claude API error: ${error}`);
        }

        // Process streaming response
        const reader = claudeResponse.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let lastUpdate = Date.now();
        const UPDATE_INTERVAL = 100;

        // Track content blocks in this response
        let currentTextContent = "";
        const toolCalls: Array<{ id: string; name: string; input: string }> = [];
        let stopReason = "";

        while (true) {
          // Check if streaming was stopped by user
          const dbMessages: MessageDoc[] = await ctx.runQuery(api.chat.listMessages, {
            conversationId: args.conversationId,
          });
          const assistantMessage = dbMessages.find(
            (m: MessageDoc) => m._id === assistantMessageId
          );
          if (assistantMessage && !assistantMessage.isStreaming) {
            await reader.cancel();
            return { workflowId, workflowName, messageId: assistantMessageId };
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const { events, remaining } = parseSSEEvents(buffer);
          buffer = remaining;

          for (const event of events) {
            if (event.type === "content_block_start") {
              const data = event.data as {
                index: number;
                content_block: { type: string; id?: string; name?: string };
              };
              if (data.content_block.type === "tool_use") {
                toolCalls.push({
                  id: data.content_block.id || "",
                  name: data.content_block.name || "",
                  input: "",
                });
              }
            } else if (event.type === "content_block_delta") {
              const data = event.data as {
                index: number;
                delta: { type: string; text?: string; partial_json?: string };
              };
              if (data.delta.type === "text_delta" && data.delta.text) {
                currentTextContent += data.delta.text;
                fullTextContent += data.delta.text;
              } else if (data.delta.type === "input_json_delta" && data.delta.partial_json) {
                // Accumulate tool input JSON
                const toolIndex = toolCalls.length - 1;
                if (toolIndex >= 0) {
                  toolCalls[toolIndex].input += data.delta.partial_json;
                }
              }
            } else if (event.type === "message_delta") {
              const data = event.data as { delta?: { stop_reason?: string } };
              if (data.delta?.stop_reason) {
                stopReason = data.delta.stop_reason;
              }
            }
          }

          // Update UI with streamed text
          if (Date.now() - lastUpdate > UPDATE_INTERVAL && fullTextContent) {
            await ctx.runMutation(api.chat.updateStreamingMessage, {
              messageId: assistantMessageId,
              content: fullTextContent,
            });
            lastUpdate = Date.now();
          }
        }

        // Stream finished - check if we need to execute tools
        if (stopReason === "tool_use" && toolCalls.length > 0) {
          // Build assistant message with tool calls
          const assistantContent: Array<{
            type: "text" | "tool_use";
            text?: string;
            id?: string;
            name?: string;
            input?: Record<string, unknown>;
          }> = [];

          if (currentTextContent) {
            assistantContent.push({ type: "text", text: currentTextContent });
          }

          // Add pending tool calls to tracking and update UI
          for (const tool of toolCalls) {
            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(tool.input || "{}");
            } catch {
              parsedInput = {};
            }
            assistantContent.push({
              type: "tool_use",
              id: tool.id,
              name: tool.name,
              input: parsedInput,
            });

            // Track this tool call as pending
            allToolCalls.push({
              name: tool.name,
              input: tool.input,
              status: "pending",
            });
          }

          // Update UI with pending tool calls
          await ctx.runMutation(api.chat.updateStreamingMessage, {
            messageId: assistantMessageId,
            content: fullTextContent,
            toolCalls: allToolCalls,
          });

          // Execute all tools and collect results
          const toolResults: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
            is_error?: boolean;
          }> = [];

          for (let i = 0; i < toolCalls.length; i++) {
            const tool = toolCalls[i];
            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(tool.input || "{}");
            } catch {
              parsedInput = {};
            }

            const result = await executeTool(tool.name, parsedInput);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: result.content,
              is_error: result.isError,
            });

            // Update the status and output of this tool call in allToolCalls
            // Find the corresponding pending tool (it's at the end of allToolCalls)
            const trackingIndex = allToolCalls.length - toolCalls.length + i;
            if (trackingIndex >= 0 && trackingIndex < allToolCalls.length) {
              allToolCalls[trackingIndex].status = result.isError ? "error" : "success";
              allToolCalls[trackingIndex].output = result.content;
            }

            // Update UI with tool call status
            await ctx.runMutation(api.chat.updateStreamingMessage, {
              messageId: assistantMessageId,
              content: fullTextContent,
              toolCalls: allToolCalls,
            });
          }

          // Add assistant message and tool results to conversation
          currentMessages.push({
            role: "assistant",
            content: assistantContent,
          });
          currentMessages.push({
            role: "user",
            content: toolResults,
          });

          // Continue the loop to get Claude's next response
          continue;
        }

        // No more tool calls - we're done
        break;
      }

      // 8. Process workflow operations after all tool calls complete
      const workflowResult = await processWorkflowOperations(fullTextContent);
      workflowId = workflowResult.workflowId;
      workflowName = workflowResult.workflowName;

      // 9. Final update - mark streaming complete
      await ctx.runMutation(api.chat.updateStreamingMessage, {
        messageId: assistantMessageId,
        content: fullTextContent || "Sorry, I could not generate a response.",
        isStreaming: false,
        workflowId,
        workflowName,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      });
    } catch (e) {
      // Handle errors during streaming
      const errorMessage = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(api.chat.updateStreamingMessage, {
        messageId: assistantMessageId,
        content: fullTextContent || "",
        isStreaming: false,
        streamingError: errorMessage,
      });
      throw e;
    }

    return { workflowId, workflowName, messageId: assistantMessageId };
  },
});
