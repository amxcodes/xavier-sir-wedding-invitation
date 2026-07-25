import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const summaryKey = "wedding";

function normaliseGuestCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(8, Math.max(1, Math.round(value)));
}

export const getInvite = query({
  args: { inviteToken: v.string() },
  handler: async (ctx, args) => {
    const [response, summary] = await Promise.all([
      ctx.db
        .query("attendance")
        .withIndex("by_inviteToken", (query) => query.eq("inviteToken", args.inviteToken))
        .unique(),
      ctx.db
        .query("attendanceSummary")
        .withIndex("by_key", (query) => query.eq("key", summaryKey))
        .unique(),
    ]);

    return {
      accepted: Boolean(response),
      guests: response?.guests ?? 1,
      totalGuests: summary?.totalGuests ?? 0,
    };
  },
});

export const acceptInvite = mutation({
  args: {
    inviteToken: v.string(),
    guests: v.number(),
  },
  handler: async (ctx, args) => {
    const guests = normaliseGuestCount(args.guests);
    const now = Date.now();
    const response = await ctx.db
      .query("attendance")
      .withIndex("by_inviteToken", (query) => query.eq("inviteToken", args.inviteToken))
      .unique();
    const summary = await ctx.db
      .query("attendanceSummary")
      .withIndex("by_key", (query) => query.eq("key", summaryKey))
      .unique();
    const previousGuests = response?.guests ?? 0;
    const totalGuests = Math.max(0, (summary?.totalGuests ?? 0) + guests - previousGuests);

    if (response) {
      await ctx.db.patch(response._id, { guests, acceptedAt: now });
    } else {
      await ctx.db.insert("attendance", { inviteToken: args.inviteToken, guests, acceptedAt: now });
    }

    if (summary) {
      await ctx.db.patch(summary._id, { totalGuests, updatedAt: now });
    } else {
      await ctx.db.insert("attendanceSummary", { key: summaryKey, totalGuests, updatedAt: now });
    }

    return { accepted: true, guests, totalGuests };
  },
});
