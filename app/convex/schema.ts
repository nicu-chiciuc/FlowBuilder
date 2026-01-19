import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),

  conversations: defineTable({
    title: v.optional(v.string()),
  }),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    workflowId: v.optional(v.string()),
    workflowName: v.optional(v.string()),
    isStreaming: v.optional(v.boolean()),
    streamingError: v.optional(v.string()),
    // Tool calls made by Claude during this response
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          input: v.optional(v.string()), // JSON string of input
          output: v.optional(v.string()), // JSON string of output
          status: v.union(v.literal("pending"), v.literal("success"), v.literal("error")),
        })
      )
    ),
  }).index("by_conversation", ["conversationId"]),
});
