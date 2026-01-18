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
  }).index("by_conversation", ["conversationId"]),
});
