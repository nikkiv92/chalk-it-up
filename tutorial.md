# Tutorial: Fetch Your Member Profile

This tutorial walks through calling the `GET /members/me` endpoint to retrieve the authenticated member's profile.

## Prerequisites

- A registered Chalk It Up account
- An access token from a successful `POST /auth/login` call

## Step 1: Log in and get your token

Call the login endpoint to obtain an access token:

```http
POST https://api.climbinggym.example.com/v1/auth/login
Content-Type: application/json

{
  "email": "johnny@example.com",
  "password": "yourpassword"
}
```

The response includes an `access_token`:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "expires_in": 3600,
  "member": { ... }
}
```

Copy the `access_token` — you'll use it in the next step.

## Step 2: Call GET /members/me

Pass the token in the `Authorization` header:

```http
GET https://api.climbinggym.example.com/v1/members/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Example with curl

```bash
curl https://api.climbinggym.example.com/v1/members/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Example with fetch (JavaScript)

```js
const response = await fetch("https://api.climbinggym.example.com/v1/members/me", {
  headers: {
    "Authorization": `Bearer ${accessToken}`
  }
});

const member = await response.json();
console.log(member.first_name, member.last_name);
```

## Step 3: Handle the response

A successful call returns `200 OK` with a `Member` object:

```json
{
  "id": "a1b2c3d4-...",
  "first_name": "Johnny",
  "last_name": "Rose",
  "email": "johnny@example.com",
  "phone": "+16175550123",
  "status": "active",
  "barcode": "CIU-000123",
  "email_verified_at": "2025-01-15T10:00:00Z",
  "photo_url": null,
  "created_at": "2025-01-15T09:55:00Z",
  "updated_at": "2025-03-01T14:22:00Z"
}
```

### Common error responses

| Status | Meaning |
|--------|---------|
| `401 Unauthorized` | Token is missing, expired, or invalid — log in again to get a fresh token. |
| `403 Forbidden` | Token is valid but the account doesn't have access. |

## Next steps

- Update profile fields with `PATCH /members/me`
- Add emergency contacts via `POST /members/me/emergency-contacts`
- View the full [API reference](./index.html) for all available operations
