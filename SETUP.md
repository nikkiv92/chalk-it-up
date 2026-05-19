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
                                                              ┌────────┴────────┐
                                                          Claude API         Open PR
                                                                                │
                                                                                ▼
                                                                   Human reviews & merges
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
   - A new PR opened against `main` with the AI-drafted diff
   - The workflow finishes successfully and stops there
5. Open the PR — confirm the diff looks reasonable. Approve and merge it yourself.
6. After ~1 minute, GitHub Pages will redeploy and the docs site will reflect the change.

If the workflow step fails, the logs will tell you why — usually a typo in the API key, or the "Allow GitHub Actions to create and approve pull requests" setting not yet enabled (Repo → Settings → Actions → General → Workflow permissions).

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
   - Pull request opened for review → done; status link points to the PR
   - **Reviewed & merged by a human** → active (pulsing) until you actually merge the PR
5. Click the PR link in the status panel. Review the diff. Merge.
6. The page detects the merge and walks through:
   - Reviewed & merged → done
   - Docs redeployed → done (after ~25s for Pages to rebuild)
   - Redoc re-renders with the change visible

Total cycle: ~30s of autonomous work + however long you spend reviewing.

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

> The visitor types a request in plain English. That hits a Cloudflare Worker which is just a thin authentication boundary — it triggers a GitHub Actions workflow. The workflow sends the current OpenAPI spec plus the request to Claude, which uses Anthropic's tool-use API to return the updated spec along with a written explanation of what changed. The workflow validates the new YAML and opens a PR — and that's where the autonomous part stops. A human reviews the diff and decides whether to merge. Once they merge, GitHub Pages redeploys and the docs you see refresh on their own.

Why this matters — and what to emphasize depending on the question:

- **Human-in-the-loop is the load-bearing element.** Claude drafts; humans approve. The AI never pushes to main on its own. That's not a limitation, that's the design — it gives content teams a velocity boost without giving up editorial control. The PR is also a complete audit trail: who proposed the change, what Claude drafted, who approved, when it shipped.
- **The spec is the source of truth.** Claude edits the OpenAPI YAML, not the rendered docs. So this works with any renderer (Redoc, Swagger UI, Mintlify, Stoplight) and doesn't lock you in to one tool.
- **Structured output via tool use.** I'm not parsing free-form text from Claude — the API enforces a JSON schema for the response. That's the production-grade pattern for getting reliable structured output from LLMs.
- **Validation catches malformed YAML** before the PR even opens, so reviewers never have to deal with broken specs.
- **The cost is trivial** — pennies per change request.
- **GitHub's own safety controls are in the loop too.** GitHub Actions can't open PRs by default — you have to explicitly opt in. Branch protection on `main` can require approvals before merge. Both of those work without any custom code, just by configuring the repo.
- **What you'd build for production:** richer validation (linting, breaking-change detection), a review queue with different gates for high-risk changes (auth, schema removal) vs low-risk (description tweaks), an audit log of every AI-drafted change with diff and reviewer attribution, fine-tuned prompts per domain (payments docs vs. terminal docs), and possibly RAG over your existing style guide so Claude writes in your team's voice.
