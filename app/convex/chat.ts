import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

function buildSystemPrompt(
  workflows: N8nWorkflow[],
  executions: N8nExecution[],
  credentials: N8nCredential[]
) {
  let workflowSection: string;

  if (workflows.length === 0) {
    workflowSection = "No workflows exist yet.";
  } else {
    workflowSection = workflows.map(w => {
      const workflowJson = {
        name: w.name,
        nodes: w.nodes,
        connections: w.connections,
        settings: w.settings,
      };
      return `### "${w.name}" (ID: ${w.id}, ${w.active ? "active" : "inactive"})
\`\`\`json
${JSON.stringify(workflowJson, null, 2)}
\`\`\``;
    }).join("\n\n");
  }

  let executionSection: string;

  if (executions.length === 0) {
    executionSection = "No recent executions.";
  } else {
    executionSection = executions.map(e => {
      const workflowName = workflows.find(w => w.id === e.workflowId)?.name || "Unknown";
      let summary = `- **${workflowName}** (ID: ${e.id}): ${e.status.toUpperCase()} at ${e.startedAt}`;

      if (e.status === "error" && e.data?.resultData?.error) {
        summary += `\n  Error: ${e.data.resultData.error.message}`;
      }

      return summary;
    }).join("\n");
  }

  let credentialSection: string;

  if (credentials.length === 0) {
    credentialSection = "No credentials configured. The user will need to set up credentials in n8n before using integrations that require authentication.";
  } else {
    credentialSection = credentials.map(c => `- **${c.name}** (type: ${c.type})`).join("\n");
  }

  return `You are FlowBuilder, an AI assistant that helps users create and manage n8n workflows through natural language.

## Current Workflows
${workflowSection}

## Recent Executions (Logs)
${executionSection}

## Available Credentials
${credentialSection}

## Capabilities
1. **List workflows**: When the user asks about their workflows, describe what exists based on the list above.
2. **Create workflows**: Generate valid n8n workflow JSON when the user describes what they want.
3. **Modify workflows**: Update existing workflows when the user asks for changes.
4. **Activate/Deactivate workflows**: Turn workflows on or off.
5. **Delete workflows**: Remove workflows when requested.
6. **Debug workflows**: Analyze recent execution logs to help users understand failures and fix issues.
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
1. The user must reference an existing workflow (by name or ID from the list above)
2. Generate the COMPLETE updated workflow JSON (not just the changes)
3. Wrap the JSON in a code block with language "n8n-workflow-update"
4. Include the workflow ID in the JSON as "_updateId" field
5. Explain what was changed

Example:
"I'll update the 'Daily Report' workflow to add email notification.

\`\`\`n8n-workflow-update
{
  "_updateId": "abc123",
  "name": "Daily Report",
  "nodes": [...],
  "connections": {...}
}
\`\`\`

I've added an email node that will [explanation of changes]."

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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

// Main action: send a message and get AI response
export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Save user message
    await ctx.runMutation(api.chat.saveMessage, {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
    });

    // 2. Get conversation history for context
    const messages = await ctx.runQuery(api.chat.listMessages, {
      conversationId: args.conversationId,
    });

    // 3. Build Claude messages array
    const claudeMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 4. Fetch current workflows, executions, and credentials for context
    const [workflows, executions, credentials] = await Promise.all([
      fetchN8nWorkflows(),
      fetchN8nExecutions(),
      fetchN8nCredentials(),
    ]);
    const systemPrompt = buildSystemPrompt(workflows, executions, credentials);

    // 5. Call Claude API
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

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
          system: systemPrompt,
          messages: claudeMessages,
        }),
      }
    );

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const claudeData = await claudeResponse.json();
    const assistantContent =
      claudeData.content[0]?.text || "Sorry, I could not generate a response.";

    // 6. Check for workflow JSON in response (create or update)
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
      // Handle workflow update
      try {
        const workflowJson = JSON.parse(updateMatch[1].trim());
        const updateId = workflowJson._updateId;
        workflowName = workflowJson.name || "Untitled Workflow";

        if (!updateId) {
          console.error("Workflow update missing _updateId field");
        } else {
          // Remove the _updateId field before sending to n8n
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
      // Handle new workflow creation
      try {
        const workflowJson = JSON.parse(createMatch[1].trim());
        workflowName = workflowJson.name || "Untitled Workflow";

        // 7. Create workflow in n8n
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

    // 7. Check for action commands (activate/deactivate/delete)
    const actionMatch = assistantContent.match(
      /```n8n-action\s*([\s\S]*?)```/
    );

    if (actionMatch) {
      try {
        const actionJson = JSON.parse(actionMatch[1].trim()) as {
          action?: string;
          workflowId?: string;
        };
        const { action, workflowId } = actionJson;

        if (
          action &&
          workflowId &&
          (action === "activate" || action === "deactivate" || action === "delete")
        ) {
          const actionResult = await executeN8nAction({ action, workflowId });

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

    // 8. Save assistant response
    await ctx.runMutation(api.chat.saveMessage, {
      conversationId: args.conversationId,
      role: "assistant",
      content: assistantContent,
      workflowId,
      workflowName,
    });

    return { workflowId, workflowName };
  },
});
