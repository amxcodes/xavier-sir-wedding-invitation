import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const summaryKey = "wedding";

function normaliseGuestCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(8, Math.max(1, Math.round(value)));
}

function normaliseName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function normaliseEvents(events: string[]) {
  const allowed = new Set(["betrothal", "wedding", "reception"]);
  return [...new Set(events.filter((event) => allowed.has(event)))];
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
      attending: response?.attending ?? true,
      name: response?.name ?? "",
      guests: response?.guests ?? 1,
      events: response?.events ?? ["betrothal", "wedding", "reception"],
      totalGuests: summary?.totalGuests ?? 0,
    };
  },
});

export const acceptInvite = mutation({
  args: {
    inviteToken: v.string(),
    name: v.string(),
    attending: v.boolean(),
    guests: v.number(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const name = normaliseName(args.name);
    if (!name) throw new Error("Please enter your name.");
    const attending = args.attending;
    const guests = attending ? normaliseGuestCount(args.guests) : 0;
    const events = attending ? normaliseEvents(args.events) : [];
    const now = Date.now();
    const response = await ctx.db
      .query("attendance")
      .withIndex("by_inviteToken", (query) => query.eq("inviteToken", args.inviteToken))
      .unique();
    const summary = await ctx.db
      .query("attendanceSummary")
      .withIndex("by_key", (query) => query.eq("key", summaryKey))
      .unique();
    const previousGuests = response?.attending ? response.guests : 0;
    const totalGuests = Math.max(0, (summary?.totalGuests ?? 0) + guests - previousGuests);

    if (response) {
      await ctx.db.patch(response._id, { name, attending, guests, events, acceptedAt: now });
    } else {
      await ctx.db.insert("attendance", { inviteToken: args.inviteToken, name, attending, guests, events, acceptedAt: now });
    }

    if (summary) {
      await ctx.db.patch(summary._id, { totalGuests, updatedAt: now });
    } else {
      await ctx.db.insert("attendanceSummary", { key: summaryKey, totalGuests, updatedAt: now });
    }

    return { accepted: true, name, attending, guests, events, totalGuests };
  },
});
