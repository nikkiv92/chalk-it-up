# Chalk It Up Demo — Setup Guide

End-to-end setup for the live AI documentation demo. Allow **30–45 minutes** the first time.

## What you're building

```
  Visitor ──(form)──▶  GitHub Pages site (index.html + Redoc)
                              │
                              │  POST /propose
                              ▼
                       Cloudflare Worker  ──(repository_dispatch)──▶  GitHub
                                                                       │
                                                                       ▼
                                                              GitHub Actions workflow
                                                                       │
                                                            ┌──────────┼──────────┐
                                                       Claude API   Open PR    Auto-merge
                                                                       │
                                                                       ▼
                                                              Pages redeploys, page polls,
                                                              Redoc re-renders. Magic.
```

## Repo layout

```
chalk-it-up/
├── index.html                           ← GitHub Pages homepage (Redoc + propose-change UI)
├── openapi.yaml                         ← The OpenAPI spec (the AI workflow edits this)
├── README.md
├── SETUP.md                             ← This file
├── .github/
│   └── workflows/
│       └── ai-update-docs.yml           ← The AI workflow
└── worker/                              ← Lives in repo for version control,
    ├── worker.js                          but deploys to Cloudflare separately
    └── wrangler.toml
```

---

## Step 1 — Enable GitHub Pages

1. Push everything to `main`.
2. Repo → Settings → Pages.
3. Source: **Deploy from a branch**, Branch: **main**, Folder: **/(root)**.
4. Save. After ~1 minute, the site is live at:
   `https://nikkiv92.github.io/chalk-it-up/`

Open it. Redoc should render your existing spec. Don't worry about the propose-change button yet — it won't work until Steps 3–4.

## Step 2 — Add the Anthropic API key as a repo secret

1. Get an API key at [console.anthropic.com](https://console.anthropic.com). Add ~$5 of credit; that covers many demo runs.
2. Repo → Settings → Secrets and variables → Actions → **New repository secret**.
3. Name: `ANTHROPIC_API_KEY`. Value: your key.

The default `GITHUB_TOKEN` is provided automatically to Actions — no action needed.

## Step 3 — Test the workflow manually (before adding the Worker)

This catches any issues with the AI step before you involve the proxy.

1. Repo → Actions → **AI Update Docs** workflow → **Run workflow** button.
2. Type something like: `Add a deprecated note to the MembershipPlan schema saying it will be removed in v2.`
3. Click **Run workflow**.
4. Watch the run. After ~30 seconds you should see:
   - A new PR opened
   - The PR squash-merges itself
   - `openapi.yaml` updated on `main`

If this works, the AI loop is solid. If it fails, the logs will tell you why — usually a typo in the API key or the spec format.

## Step 4 — Deploy the Cloudflare Worker

This is the proxy that lets the static page trigger the workflow without exposing a GitHub token.

### One-time setup

1. Install Wrangler: `npm install -g wrangler`
2. Log in: `wrangler login` (opens browser, free Cloudflare account).
3. From the `worker/` folder:
   ```bash
   wrangler deploy
   ```
   You'll get a URL like `https://chalk-it-up-proxy.YOUR-SUBDOMAIN.workers.dev`.

### Create a GitHub PAT for the Worker

The Worker needs a fine-grained PAT to trigger the workflow:

1. GitHub → Settings (personal) → Developer settings → Personal access tokens → **Fine-grained tokens** → **Generate new token**.
2. Resource owner: your account. Repository access: select **only** `chalk-it-up`.
3. Permissions:
   - **Contents**: Read and write
   - **Actions**: Read and write
   - **Metadata**: Read-only (auto-selected)
4. Generate, copy the token.

### Add the PAT to the Worker

From the `worker/` folder:
```bash
wrangler secret put GITHUB_TOKEN
```
Paste your PAT when prompted.

### Wire the Worker URL into the page

Open `index.html`, find this line near the top of the `<script>`:
```js
const WORKER_URL = "https://chalk-it-up-proxy.YOUR-SUBDOMAIN.workers.dev/propose";
```
Replace it with your actual Worker URL (keep the `/propose` at the end — it's not actually a route, but it makes the request clearer in browser devtools). Commit and push.

Wait ~1 minute for GitHub Pages to redeploy.

## Step 5 — End-to-end test

1. Open `https://nikkiv92.github.io/chalk-it-up/`.
2. Click **Propose a change with AI**.
3. Try one of the example chips, e.g., "Add an optional `nickname` field to the Member schema".
4. Submit. Watch the status panel bottom-right:
   - Sending request → done
   - Claude is drafting → done (~10s)
   - Pull request opened → status panel links to the PR
   - Merged to main → done
   - Docs redeployed → done, Redoc re-renders

Total cycle: ~45–60 seconds.

---

## Day-of-interview checklist

- [ ] Repo is public (free Actions minutes)
- [ ] `ANTHROPIC_API_KEY` secret is set
- [ ] Anthropic account has at least $3 of credit
- [ ] Worker `GITHUB_TOKEN` secret is set and PAT is not expired
- [ ] `WORKER_URL` in `index.html` is your actual Worker URL
- [ ] You've run a fresh end-to-end test the morning of (catches expired tokens, weird state)
- [ ] You've prepared 2–3 "safe" example prompts that you've tested and know produce clean diffs
- [ ] Have a backup tab open to the Actions page so you can pivot if something stalls
- [ ] Optional: silence GitHub notifications during the demo so PR emails don't pop up

---

## Common issues

**The status says "Pull request opened" but no PR appears.**
Check Actions tab. The workflow either errored or is still running. Most common cause: `ANTHROPIC_API_KEY` typo or no credit.

**The Worker returns a CORS error.**
Make sure `ALLOWED_ORIGIN` in `wrangler.toml` exactly matches `https://nikkiv92.github.io` (no trailing slash). Redeploy with `wrangler deploy`.

**Claude returns invalid YAML occasionally.**
The workflow includes a validator step that warns but doesn't block (set that way intentionally for demo continuity). If you want stricter behavior, change `|| { echo 'Validation failed but continuing (demo).'; true; }` to remove the `|| { ... }`.

**Page doesn't refresh after merge.**
GitHub Pages can take up to 90 seconds for a redeploy. The page polls for new commits and gives Pages 25s before re-rendering Redoc. If you see "Docs redeployed" but the spec looks unchanged, hard-refresh (Cmd-Shift-R).

---

## Talking points for the interview

When the VP asks "how does this work" — here's the elevator version that hits the AI-in-content-workflows beat:

> The visitor types a request in plain English. That hits a Cloudflare Worker which is just a thin authentication boundary — it triggers a GitHub Actions workflow. The workflow sends the current OpenAPI spec plus the request to Claude, which returns the updated spec and a written explanation of what changed. The workflow opens a PR with that diff and explanation as the body — that's the human-in-the-loop checkpoint a real team would gate on review. For this demo I have it auto-merging after a beat. The merge triggers a Pages redeploy and the docs you see refresh on their own.

Key things you can emphasize depending on the question:
- **Human-in-the-loop** is preserved as a PR — Claude doesn't push to main directly. That's the content-governance story.
- **The spec is the source of truth.** Claude edits the OpenAPI YAML, not the rendered docs. So this works with any renderer (Redoc, Swagger UI, Mintlify, Stoplight) and doesn't lock you in.
- **Validation step** catches malformed YAML before the PR even opens.
- **The cost is trivial** — pennies per change request.
- **What you'd build for production:** richer validation (linting, breaking-change detection), a review queue for high-risk changes (auth, schema removal), an audit log of every AI-drafted change, fine-tuned prompts per domain (payments docs vs. terminal docs), and possibly RAG over your existing style guide so Claude writes in your team's voice.
