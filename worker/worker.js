// Chalk It Up — Cloudflare Worker proxy
//
// Routes:
//   POST /propose          — triggers spec update workflow (propose-change event)
//   POST /propose-tutorial — pre-flight classification, then triggers tutorial update workflow
//
// Required secrets (set via `wrangler secret put`):
//   - GITHUB_TOKEN:    fine-grained PAT with `contents: write` and `actions: write`
//   - ANTHROPIC_API_KEY: for tutorial pre-flight classification
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

const VALID_LOCATIONS = new Set(["massachusetts", "maine"]);

const TUTORIAL_FILES = {
  massachusetts: "create-new-member-ma.md",
  maine:         "create-new-member-me.md"
};

async function fetchTutorialContent(location, env) {
  const filename = TUTORIAL_FILES[location];
  if (!filename) return null;
  const url = `https://raw.githubusercontent.com/${env.REPO_OWNER}/${env.REPO_NAME}/main/${filename}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  return resp.text();
}

async function classifyTutorialRequest(description, tutorialContents, env) {
  const tutorialSummary = Object.entries(tutorialContents)
    .map(([loc, content]) => `=== ${TUTORIAL_FILES[loc]} ===\n${content.slice(0, 2500)}`)
    .join("\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools: [{
        name: "classify_request",
        description: "Classify whether this tutorial change requires an API spec change first.",
        input_schema: {
          type: "object",
          properties: {
            requires_spec_change: {
              type: "boolean",
              description: "True if the change would require modifying the API spec before the tutorial can reflect it."
            },
            reason: {
              type: "string",
              description: "One or two sentence explanation of why a spec change is or is not needed."
            }
          },
          required: ["requires_spec_change", "reason"]
        }
      }],
      tool_choice: { type: "tool", name: "classify_request" },
      messages: [{
        role: "user",
        content: `You are reviewing a request to update API tutorial documentation for a climbing gym membership API.

Current tutorial content (truncated):
${tutorialSummary}

Change request: "${description}"

Determine: does fulfilling this request require first modifying the underlying API spec (e.g. adding, removing, or renaming endpoints, request fields, response fields, or schemas)? Or can it be made purely to the tutorial documentation without touching the API spec?

Examples that do NOT require spec changes: rewording explanations, fixing typos, restructuring sections, adding clarifying notes, updating code examples that are already consistent with the spec.

Examples that DO require spec changes: documenting a new field that doesn't exist in the spec yet, renaming a field that hasn't been renamed in the spec, documenting a new endpoint, changing a response structure.

Call classify_request with your determination.`
      }]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  for (const block of data.content) {
    if (block.type === "tool_use" && block.name === "classify_request") {
      return block.input;
    }
  }
  throw new Error("Claude did not return a classification");
}

async function handleSpecProposal(request, env, origin) {
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

  const versions = Array.isArray(body.versions)
    ? body.versions.map(v => String(v)).filter(v => VALID_LOCATIONS.has(v))
    : [];

  const clientPayload = {
    description,
    type: body.type === "structured" ? "structured" : "natural_language",
    structured: body.structured && typeof body.structured === "object" ? {
      change_type: String(body.structured.change_type || "").slice(0, 50),
      target:      String(body.structured.target || "").slice(0, 200),
      details:     String(body.structured.details || "").slice(0, 1000)
    } : null,
    versions: versions.length > 0 ? versions : ["massachusetts"],
    include_tutorials: body.include_tutorials === true,
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
    body: JSON.stringify({ event_type: "propose-change", client_payload: clientPayload })
  });

  if (ghResp.status !== 204) {
    const text = await ghResp.text();
    return new Response(`GitHub dispatch failed (${ghResp.status}): ${text}`, { status: 502, headers: corsHeaders(origin) });
  }

  return new Response(JSON.stringify({
    ok: true,
    message: "Workflow dispatched",
    dispatched_at: clientPayload.requested_at
  }), { status: 202, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
}

async function handleTutorialProposal(request, env, origin) {
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

  const tutorials = Array.isArray(body.tutorials)
    ? body.tutorials.map(v => String(v)).filter(v => VALID_LOCATIONS.has(v))
    : [];
  if (tutorials.length === 0) {
    return new Response("At least one tutorial location must be selected", { status: 400, headers: corsHeaders(origin) });
  }

  // Fetch tutorial content for pre-flight classification
  const tutorialContents = {};
  for (const loc of tutorials) {
    const content = await fetchTutorialContent(loc, env);
    if (content) tutorialContents[loc] = content;
  }

  // Pre-flight: check if a spec change is required first
  let classification;
  try {
    classification = await classifyTutorialRequest(description, tutorialContents, env);
  } catch (e) {
    // On classification failure, let the request through rather than blocking
    console.error("Classification error:", e.message);
    classification = { requires_spec_change: false, reason: "Classification unavailable" };
  }

  if (classification.requires_spec_change) {
    return new Response(JSON.stringify({
      ok: false,
      requires_spec_change: true,
      reason: classification.reason
    }), { status: 422, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  }

  // Dispatch tutorial update workflow
  const clientPayload = {
    description,
    tutorials,
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
    body: JSON.stringify({ event_type: "propose-tutorial-change", client_payload: clientPayload })
  });

  if (ghResp.status !== 204) {
    const text = await ghResp.text();
    return new Response(`GitHub dispatch failed (${ghResp.status}): ${text}`, { status: 502, headers: corsHeaders(origin) });
  }

  return new Response(JSON.stringify({
    ok: true,
    message: "Tutorial workflow dispatched",
    dispatched_at: clientPayload.requested_at
  }), { status: 202, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || "*";
    const reqOrigin = request.headers.get("Origin") || "";
    const origin = (allowed === "*" || reqOrigin === allowed) ? (reqOrigin || allowed) : allowed;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/propose") return handleSpecProposal(request, env, origin);
    if (url.pathname === "/propose-tutorial") return handleTutorialProposal(request, env, origin);

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  }
};
