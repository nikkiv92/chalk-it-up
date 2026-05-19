// Chalk It Up — Cloudflare Worker proxy
//
// Receives POST requests from the demo page and triggers a repository_dispatch
// event on the chalk-it-up repo, which kicks off the AI Update Docs workflow.
//
// Required secrets (set via `wrangler secret put`):
//   - GITHUB_TOKEN: a fine-grained PAT with `contents: write` and `actions: write`
//                   on the chalk-it-up repo. (No other repos needed.)
//
// Required env vars (set in wrangler.toml [vars]):
//   - REPO_OWNER (e.g., "nikkiv92")
//   - REPO_NAME  (e.g., "chalk-it-up")
//   - ALLOWED_ORIGIN (e.g., "https://nikkiv92.github.io")

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
});

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || "*";
    const reqOrigin = request.headers.get("Origin") || "";
    const origin = (allowed === "*" || reqOrigin === allowed) ? (reqOrigin || allowed) : allowed;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders(origin) });
    }

    const description = (body.description || "").toString().trim();
    if (!description || description.length < 5) {
      return new Response("Description is too short", { status: 400, headers: corsHeaders(origin) });
    }
    if (description.length > 2000) {
      return new Response("Description is too long (max 2000 chars)", { status: 400, headers: corsHeaders(origin) });
    }

    // Basic safety: strip dispatch payload of anything beyond expected fields
    const clientPayload = {
      description,
      type: body.type === "structured" ? "structured" : "natural_language",
      structured: body.structured && typeof body.structured === "object" ? {
        change_type: String(body.structured.change_type || "").slice(0, 50),
        target: String(body.structured.target || "").slice(0, 200),
        details: String(body.structured.details || "").slice(0, 1000)
      } : null,
      requested_at: new Date().toISOString()
    };

    const ghUrl = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/dispatches`;
    const ghResp = await fetch(ghUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "chalk-it-up-worker"
      },
      body: JSON.stringify({
        event_type: "propose-change",
        client_payload: clientPayload
      })
    });

    if (ghResp.status !== 204) {
      const text = await ghResp.text();
      return new Response(`GitHub dispatch failed (${ghResp.status}): ${text}`, {
        status: 502,
        headers: corsHeaders(origin)
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: "Workflow dispatched",
      dispatched_at: clientPayload.requested_at
    }), {
      status: 202,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
    });
  }
};
