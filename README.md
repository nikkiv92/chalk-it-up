# Chalk It Up Membership API

OpenAPI 3.1.0 specifications for the Chalk It Up climbing gym membership platform, covering member registration, account management, waivers, passes, check-ins, and billing. Separate specs are maintained per state location.

---

## Contents

```
chalk-it-up/
├── openapi.yaml                  ← Base spec (mirrors Massachusetts)
├── specs/
│   ├── massachusetts.yaml        ← Massachusetts locations (v1, stable)
│   └── maine.yaml                ← Maine locations (v1)
├── create-new-member-ma.md       ← Tutorial: register a member (MA)
├── create-new-member-me.md       ← Tutorial: register a member (ME)
├── index.html                    ← Live docs site (Redoc + AI propose-a-change UI)
├── tutorials.html                ← Tutorials landing page
├── tutorial.html                 ← Tutorial renderer
└── worker/                       ← Cloudflare Worker proxy for the AI workflow
```

---

## API Overview

**Base URLs**

| State | Environment | URL |
|-------|-------------|-----|
| Massachusetts | Production | `https://ma.api.chalkitupgym.example.com` |
| Massachusetts | Staging | `https://staging.ma.api.chalkitupgym.example.com` |
| Maine | Production | `https://me.api.chalkitupgym.example.com` |
| Maine | Staging | `https://staging.me.api.chalkitupgym.example.com` |

The API version is included in each path (e.g. `/v1/members/register`), so clients can migrate individual endpoints independently rather than requiring a full version cutover.

**Authentication**

All write operations and member-specific reads require a `Bearer` JWT in the `Authorization` header. Tokens are issued via `/v1/auth/login` or `/v1/members/register` and can be refreshed at `/v1/auth/refresh`. Public endpoints (plan catalog, pass products) require no authentication.

---

## Tag Groups

| Tag | Description |
|-----|-------------|
| **Members** | Member registration, profile management (`/members/me`), and staff-facing member admin |
| **Auth** | Login, logout, token refresh, email verification, password reset |
| **Emergency Contacts** | CRUD for a member's emergency contacts |
| **Waivers** | Liability waiver templates and signed waiver records |
| **Memberships** | Plan catalog, subscription lifecycle (subscribe, cancel, freeze, unfreeze) |
| **Passes** | Day pass and punch card products, purchase, and usage tracking |
| **Check-ins** | Facility entry validation and history |
| **Billing** | Payment methods (tokenized) and invoice retrieval |
| **Preferences** | Member notification and display preferences (Maine only) |

---

## Key Design Decisions

**Path-based versioning** — The API version is embedded in each path (`/v1/...`) rather than the server base URL. This allows individual endpoints to be versioned independently as the API evolves.

**State-split specs** — Massachusetts and Maine run separate spec files. They share the same base schema but can diverge for location-specific features (e.g. the Preferences endpoints available in Maine).

**PCI compliance** — Raw card data is never accepted by this API. The `POST /v1/members/me/payment-methods` endpoint expects a `provider_token` produced by a PCI-compliant frontend SDK (e.g. Stripe.js). The API stores and communicates only the resulting processor reference.

**Role model** — Two implicit roles are used throughout:
- *Member* — authenticated end-user; can only access their own resources.
- *Staff* — elevated role required for endpoints such as `GET /v1/members`, `PATCH /v1/members/{memberId}`, and `POST /v1/check-ins` with `staff_override`.

Role enforcement is left to the implementing service; the spec documents intent via `description` fields.

**Pagination** — All list endpoints share a consistent `PaginatedResponse` envelope with a `meta` block (`page`, `per_page`, `total`, `total_pages`).

**Soft cancellation** — `DELETE /v1/members/me/membership` cancels at period end by default. Pass `?immediate=true` to cancel immediately.

**Privacy** — `DELETE /v1/members/me` initiates an account deletion request (202 Accepted) suitable for GDPR/CCPA compliance workflows.

---

## Viewing the Spec Locally

**Local dev server**
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

**Redoc (npx)**
```bash
npx @redocly/cli preview-docs specs/massachusetts.yaml
# or
npx @redocly/cli preview-docs specs/maine.yaml
```

**Swagger UI (Docker)**
```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/spec/specs/massachusetts.yaml \
  -v $(pwd):/spec \
  swaggerapi/swagger-ui
# Open http://localhost:8080
```

**Stoplight Studio** — Open the repo folder directly in [Stoplight Studio](https://stoplight.io/studio) for a graphical editor and live preview.

---

## Validation

Validate the specs with the [Redocly CLI](https://redocly.com/docs/cli/):

```bash
npm install -g @redocly/cli
redocly lint specs/massachusetts.yaml
redocly lint specs/maine.yaml
```

Or with [Vacuum](https://quobix.com/vacuum/):

```bash
vacuum lint specs/massachusetts.yaml
vacuum lint specs/maine.yaml
```

---

## Generating Client SDKs

Use [OpenAPI Generator](https://openapi-generator.tech/) to scaffold a client from the spec:

```bash
# TypeScript (fetch) — Massachusetts
openapi-generator-cli generate \
  -i specs/massachusetts.yaml \
  -g typescript-fetch \
  -o ./clients/typescript-ma

# Python — Maine
openapi-generator-cli generate \
  -i specs/maine.yaml \
  -g python \
  -o ./clients/python-me
```

---

## Contributing

The specs can be updated manually or via the AI workflow:

**Manual edits**
1. Edit the relevant file(s) in `specs/` (and `openapi.yaml` if it's a base change).
2. Run `redocly lint specs/<state>.yaml` and fix any errors before committing.
3. Open a pull request with a description of what changed and why.

**AI workflow**
Use the "Propose a change" button on the [live docs site](https://nikkiv92.github.io/chalk-it-up/) to submit a plain-English change request. Claude will draft the spec update, open a PR, and optionally update the relevant tutorial files. A human reviews and merges.

For breaking changes (removed fields, changed types, renamed operationIds), bump `info.version` in the affected spec(s) and note the change in your PR description.

---

## License

MIT
