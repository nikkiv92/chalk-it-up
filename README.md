# Climbing Gym Membership API

OpenAPI 3.1.0 specification for a climbing gym membership platform covering member registration, account management, waivers, passes, check-ins, and billing.

---

## Contents

- [`openapi.yaml`](./openapi.yaml) — The full OpenAPI spec

---

## API Overview

**Base URLs**

| Environment | URL |
|-------------|-----|
| Production  | `https://api.climbinggym.example.com/v1` |
| Staging     | `https://staging-api.climbinggym.example.com/v1` |

**Authentication**

All write operations and member-specific reads require a `Bearer` JWT in the `Authorization` header. Tokens are issued via `/auth/login` or `/auth/register` and can be refreshed at `/auth/refresh`. Public endpoints (plan catalog, pass products) require no authentication.

---

## Tag Groups

| Tag | Description |
|-----|-------------|
| **Auth** | Registration, login, logout, token refresh, email verification, password reset |
| **Members** | Profile management for self (`/members/me`) and staff-facing member admin |
| **Emergency Contacts** | CRUD for a member's emergency contacts |
| **Waivers** | Liability waiver templates and signed waiver records |
| **Memberships** | Plan catalog, subscription lifecycle (subscribe, cancel, freeze, unfreeze) |
| **Passes** | Day pass and punch card products, purchase, and usage tracking |
| **Check-ins** | Facility entry validation and history |
| **Billing** | Payment methods (tokenized) and invoice retrieval |

---

## Key Design Decisions

**PCI compliance** — Raw card data is never accepted by this API. The `POST /members/me/payment-methods` endpoint expects a `provider_token` produced by a PCI-compliant frontend SDK (e.g. Stripe.js). The API stores and communicates only the resulting processor reference.

**Role model** — Two implicit roles are used throughout:
- *Member* — authenticated end-user; can only access their own resources.
- *Staff* — elevated role required for endpoints such as `GET /members`, `PATCH /members/{memberId}`, and `POST /check-ins` with `staff_override`.

Role enforcement is left to the implementing service; the spec documents intent via `description` fields.

**Pagination** — All list endpoints share a consistent `PaginatedResponse` envelope with a `meta` block (`page`, `per_page`, `total`, `total_pages`).

**Soft cancellation** — `DELETE /members/me/membership` cancels at period end by default. Pass `?immediate=true` to cancel immediately.

**Privacy** — `DELETE /members/me` initiates an account deletion request (202 Accepted) suitable for GDPR/CCPA compliance workflows.

---

## Viewing the Spec

**Swagger UI (Docker)**
```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/spec/openapi.yaml \
  -v $(pwd):/spec \
  swaggerapi/swagger-ui
# Open http://localhost:8080
```

**Redoc (npx)**
```bash
npx @redocly/cli preview-docs openapi.yaml
```

**Stoplight Studio** — Open the repo folder directly in [Stoplight Studio](https://stoplight.io/studio) for a graphical editor and live preview.

---

## Validation

Validate the spec with the [Redocly CLI](https://redocly.com/docs/cli/):

```bash
npm install -g @redocly/cli
redocly lint openapi.yaml
```

Or with [Vacuum](https://quobix.com/vacuum/):

```bash
vacuum lint openapi.yaml
```

---

## Generating Client SDKs

Use [OpenAPI Generator](https://openapi-generator.tech/) to scaffold a client from the spec:

```bash
# TypeScript (fetch)
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ./clients/typescript

# Python
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./clients/python
```

---

## Contributing

1. Edit `openapi.yaml`.
2. Run `redocly lint openapi.yaml` and fix any errors before committing.
3. Open a pull request with a description of what changed and why.

For breaking changes (removed fields, changed types, renamed operationIds), bump the `info.version` and note the change in your PR description.

---

## License

MIT
