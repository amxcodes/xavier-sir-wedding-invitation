import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function validInviteToken(token: string | null) {
  return Boolean(token && /^[a-zA-Z0-9-]{16,80}$/.test(token));
}

http.route({
  path: "/attendance",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { headers: corsHeaders })),
});

http.route({
  path: "/attendance",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get("token");
    if (!validInviteToken(token)) {
      return Response.json({ error: "Invalid invite." }, { status: 400, headers: corsHeaders });
    }

    const invite = await ctx.runQuery(api.attendance.getInvite, { inviteToken: token });
    return Response.json(invite, { headers: corsHeaders });
  }),
});

http.route({
  path: "/attendance",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();
      const token = typeof payload.inviteToken === "string" ? payload.inviteToken : null;
      const guests = typeof payload.guests === "number" ? payload.guests : NaN;
      if (!validInviteToken(token) || !Number.isFinite(guests)) {
        return Response.json({ error: "Invalid invitation response." }, { status: 400, headers: corsHeaders });
      }

      const invite = await ctx.runMutation(api.attendance.acceptInvite, { inviteToken: token, guests });
      return Response.json(invite, { headers: corsHeaders });
    } catch {
      return Response.json({ error: "Unable to save your response." }, { status: 400, headers: corsHeaders });
    }
  }),
});

export default http;
