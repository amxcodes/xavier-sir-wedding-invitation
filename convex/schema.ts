import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  attendance: defineTable({
    inviteToken: v.string(),
    guests: v.number(),
    acceptedAt: v.number(),
  }).index("by_inviteToken", ["inviteToken"]),
  attendanceSummary: defineTable({
    key: v.string(),
    totalGuests: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
