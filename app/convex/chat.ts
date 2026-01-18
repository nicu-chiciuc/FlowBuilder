import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

function buildSystemPrompt(workflows: N8nWorkflow[]) {
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

  return `You are FlowBuilder, an AI assistant that helps users create and manage n8n workflows through natural language.

## Current Workflows
${workflowSection}

## Capabilities
1. **List workflows**: When the user asks about their workflows, describe what exists based on the list above.
2. **Create workflows**: Generate valid n8n workflow JSON when the user describes what they want.
3. **Modify workflows**: Update existing workflows when the user asks for changes.
4. **Answer questions**: Help users understand workflows and automation concepts.

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

// Helper to update a workflow in n8n
async function updateWorkflow(
  workflowId: string,
  workflowJson: Record<string, unknown>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const n8nApiUrl = process.env.N8N_API_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  if (!n8nApiUrl || !n8nApiKey) {
    return { success: false, error: "n8n API not configured" };
  }

  try {
    const response = await fetch(`${n8nApiUrl}/api/v1/workflows/${workflowId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": n8nApiKey,
      },
      body: JSON.stringify(workflowJson),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, id: data.id };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }
  } catch (e) {
    return { success: false, error: String(e) };
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

    // 4. Fetch current workflows for context
    const workflows = await fetchN8nWorkflows();
    const systemPrompt = buildSystemPrompt(workflows);

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
