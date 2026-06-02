# Tutorial: Register a New Member

This tutorial walks through calling the `POST /auth/register` endpoint (`registerMember` operation) to create a new member account. You'll see a basic registration, then a referral scenario where the new member was brought in by an existing one.

## Prerequisites

- A valid API key or staff access token for your integration
- The base URL for your environment:
  - Production: `https://api.chalkitupgym.example.com/v1`
  - Staging: `https://staging-api.chalkitupgym.example.com/v1`

---

## Step 1: Register a new member

Send a `POST` request to `/auth/register` with the new member's details. All fields in the example below are required unless marked optional.

```json
POST /auth/register
Content-Type: application/json

{
  "first_name": "Alexis",
  "last_name": "Kim",
  "email": "alexis.kim@example.com",
  "password": "climbingismypassion9",
  "date_of_birth": "1995-06-14",
  "phone": "+16175550198"
}
```

### Successful response — `201 Created`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "expires_in": 3600,
  "member": {
    "id": "e7f3a021-4b2c-41de-9c3a-d5f123456789",
    "first_name": "Alexis",
    "last_name": "Kim",
    "email": "alexis.kim@example.com",
    "phone": "+16175550198",
    "date_of_birth": "1995-06-14",
    "status": "pending_verification",
    "barcode": "CIU-000456",
    "email_verified_at": null,
    "photo_url": null,
    "created_at": "2026-06-02T10:30:00Z",
    "updated_at": "2026-06-02T10:30:00Z"
  }
}
```

The new member's status starts as `pending_verification`. A verification email is sent automatically to the address provided — the member must click the link before their status moves to `active`.

The response also includes an `access_token` and `refresh_token` so the member can be logged in immediately without a separate call to `POST /auth/login`.

---

## Step 2: Register a member with a referral

If the new member was referred by an existing member, you can pass `referred_by_member_id` to credit the referral. This field takes the referring member's `id` (a UUID).

### Look up the referring member's ID

If you don't already have the referring member's `id`, use `GET /members` with the `search` parameter to look them up by name or email. This endpoint requires a staff token.

```json
GET /members?search=Patrick+Rose
Authorization: Bearer <staff_access_token>
```

#### Response — `200 OK`

```json
{
  "data": [
    {
      "id": "a1b2c3d4-9e8f-47ab-bc12-d3e456789012",
      "first_name": "Patrick",
      "last_name": "Rose",
      "email": "patrick.rose@example.com",
      "status": "active",
      "barcode": "CIU-000123",
      "created_at": "2024-03-10T08:00:00Z",
      "updated_at": "2025-11-22T14:10:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

Copy the `id` from the matching result — `"a1b2c3d4-9e8f-47ab-bc12-d3e456789012"` in this case — and pass it as `referred_by_member_id` in the registration request.

### Registration request with referral

```json
POST /auth/register
Content-Type: application/json

{
  "first_name": "Alexis",
  "last_name": "Kim",
  "email": "alexis.kim@example.com",
  "password": "climbingismypassion9",
  "date_of_birth": "1995-06-14",
  "phone": "+16175550198",
  "referred_by_member_id": "a1b2c3d4-9e8f-47ab-bc12-d3e456789012"
}
```

The response shape is identical to Step 1. The referral is recorded on the account and can be used downstream to apply any referral rewards your implementation supports.

---

## Common error responses

| Status | Meaning |
|--------|---------|
| `409 Conflict` | An account with that email address already exists. |
| `422 Unprocessable Entity` | One or more fields failed validation — check the `errors` array in the response body for field-level detail. |

### Example `422` response

```json
{
  "code": "validation_failed",
  "message": "One or more fields are invalid.",
  "errors": [
    {
      "field": "date_of_birth",
      "message": "Must be 18+ or accompanied by a guardian waiver."
    },
    {
      "field": "password",
      "message": "Must be at least 8 characters."
    }
  ]
}
```

---

## Next steps

- Prompt the new member to verify their email before attempting any authenticated actions
- Subscribe them to a membership plan via `POST /members/me/membership`
- Have them sign the liability waiver via `POST /members/me/waivers`
- View the full [API reference](./index.html) for all available operations
