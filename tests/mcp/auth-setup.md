# MCP Auth Setup Guide

How to authenticate for MCP testing sessions using the Playwright MCP browser tools.

---

## Option 1: Register + Login (Fresh Session)

Use this for a clean test session with a new user:

```
1. browser_navigate → http://localhost:3000/register
2. browser_fill_form:
     Email:    "mcp-test-{timestamp}@test.defi-tracker.local"
     Password: "McpT3st!Secure#2025"
     Confirm:  "McpT3st!Secure#2025"
3. browser_click → submit button
4. Verify redirect to /wallets (authenticated)
```

The browser session now has auth cookies — all subsequent navigations will be authenticated.

---

## Option 2: Login with Existing Test User

If the test database is seeded (via `global-setup.ts`), use the seeded user:

```
1. browser_navigate → http://localhost:3000/login
2. browser_fill_form:
     Email:    "test@defi-tracker.local"
     Password: "TestPassword!123"
3. browser_click → submit button
4. Verify redirect away from /login
```

> **Note:** Adjust credentials to match your seed data in `packages/db/prisma/seed.ts`.

---

## Option 3: Extract Session Cookies (Advanced)

For debugging or reusing sessions across MCP tool calls:

```
browser_evaluate → document.cookie
```

This returns all cookies including the `next-auth.session-token`. Useful for:
- Verifying auth state
- Debugging session issues
- Confirming JWT token is present

---

## Verifying Auth State

After login, verify authentication is working:

```
browser_navigate → http://localhost:3000/wallets
browser_snapshot → verify:
  - Page shows wallet content (not login form)
  - Sidebar navigation is visible
  - User email appears in header/settings
```

If redirected to `/login`, the session is not active — re-authenticate.

---

## Test Credentials

| Purpose | Email | Password |
|---------|-------|----------|
| Fresh MCP test | `mcp-test-{timestamp}@test.defi-tracker.local` | `McpT3st!Secure#2025` |
| Seeded test user | `test@defi-tracker.local` | `TestPassword!123` |
| Invalid login test | `nobody@invalid.example` | `WrongPassword!99` |

> **Important:** These credentials are for local development only. Never use in production.

---

## Session Timeout

NextAuth is configured with a 15-minute JWT session (`maxAge: 900`). For long MCP test sessions, you may need to re-login if the session expires. Signs of expired session:
- Protected routes redirect to `/login`
- tRPC calls return 401
- `browser_network_requests` shows 401 responses
