# Playwright MCP Test Playbook

Interactive test scenarios for Claude Code to execute via the `@playwright/mcp` server.
Run these by asking Claude Code: **"Run MCP tests"** or **"Run MCP smoke tests"**.

> **Pre-requisite:** Dev server must be running — `pnpm --filter @defi-tracker/web dev`

---

## Phase 1: Smoke & Health (Public Routes)

### 1.1 Health Endpoint
```
browser_navigate → http://localhost:3000/api/health
browser_get_visible_text → assert contains "ok"
```

### 1.2 Root Redirect
```
browser_navigate → http://localhost:3000/
Verify URL redirected to /login
```

### 1.3 Login Page Loads
```
browser_navigate → http://localhost:3000/login
browser_snapshot → verify:
  - Email input field (label: "Email")
  - Password input field (label: "Password")
  - Submit button ("Log in" or "Sign in")
  - Link to register page
```

### 1.4 Register Page Loads
```
browser_navigate → http://localhost:3000/register
browser_snapshot → verify:
  - Email input field
  - Password input field
  - Confirm password input field
  - Submit button ("Register" / "Sign up" / "Create account")
```

---

## Phase 2: Auth Flows

### 2.1 Register New User
```
browser_navigate → http://localhost:3000/register
browser_fill_form:
  - Email: "mcp-test-{timestamp}@test.defi-tracker.local"
  - Password: "McpT3st!Secure#2025"
  - Confirm Password: "McpT3st!Secure#2025"
browser_click → submit button
Verify: URL redirected to /wallets
```

### 2.2 Login with Credentials
```
browser_navigate → http://localhost:3000/login
browser_fill_form:
  - Email: (use email from 2.1)
  - Password: "McpT3st!Secure#2025"
browser_click → submit button
Verify: URL is NOT /login (redirected to dashboard)
```

### 2.3 Login Validation Errors
```
browser_navigate → http://localhost:3000/login
browser_click → submit button (empty form)
browser_snapshot → verify error messages visible
```

### 2.4 Register Validation — Mismatched Passwords
```
browser_navigate → http://localhost:3000/register
browser_fill_form:
  - Email: "mcp-mismatch@test.local"
  - Password: "McpT3st!Secure#2025"
  - Confirm Password: "DifferentPassword!99"
browser_click → submit button
browser_snapshot → verify error about password mismatch
```

### 2.5 Invalid Login Credentials
```
browser_navigate → http://localhost:3000/login
browser_fill_form:
  - Email: "nobody@invalid.example"
  - Password: "WrongPassword!99"
browser_click → submit button
Verify: URL still /login
browser_snapshot → verify error message (invalid/incorrect/failed)
```

### 2.6 Protected Route Redirect
```
(Clear cookies / new context first)
browser_navigate → http://localhost:3000/wallets
Verify: URL redirected to /login
```

---

## Phase 3: Dashboard (Authenticated)

> **Pre-condition:** Complete Phase 2.2 (login) first.

### 3.1 Overview Dashboard
```
browser_navigate → http://localhost:3000/overview
browser_snapshot → verify:
  - KPI cards: Total Transactions, Classified %, Tax thresholds
  - Portfolio section: Net P&L, Taxable Gains, Tax-Free Gains, Open Positions
  - Values formatted in EUR (German locale)
```

### 3.2 Sidebar Navigation
```
browser_snapshot → verify nav items:
  - Dashboard (/overview)
  - Transactions (/transactions)
  - Wallets (/wallets)
  - Exports (/exports)
  - Settings (/settings)
Click each nav item → verify URL changes accordingly
```

### 3.3 Responsive Layout
```
browser_resize → width: 375, height: 667 (mobile)
browser_snapshot → verify sidebar collapses or becomes a hamburger menu
browser_resize → width: 1280, height: 720 (desktop)
browser_snapshot → verify sidebar is expanded
```

---

## Phase 4: Wallet Management

### 4.1 Wallets Page
```
browser_navigate → http://localhost:3000/wallets
browser_snapshot → verify:
  - Add wallet form (address field, chain dropdown, label field)
  - MetaMask connect button
  - Existing wallet cards (if any)
```

### 4.2 Add Wallet Manually
```
browser_fill_form:
  - Address: "0x1234567890abcdef1234567890abcdef12345678"
  - Chain: select "Flare" (chain ID 14)
  - Label: "MCP Test Wallet"
browser_click → add/submit button
browser_snapshot → verify new wallet card appears with:
  - Label "MCP Test Wallet"
  - Address (truncated)
  - Flare chain badge
```

### 4.3 Wallet Card Actions
```
browser_snapshot → verify wallet card has:
  - Sync button (RefreshCw icon)
  - Delete button (Trash2 icon)
  - Chain badge
  - TX count
```

### 4.4 Trigger Wallet Sync
```
browser_click → sync button on wallet card
browser_snapshot → verify loading/syncing state
(Wait a few seconds)
browser_snapshot → verify sync completed
```

### 4.5 Delete Wallet
```
browser_click → delete button on wallet card
browser_handle_dialog → accept confirmation
browser_snapshot → verify wallet card removed
```

---

## Phase 5: Transactions

### 5.1 Transactions Page
```
browser_navigate → http://localhost:3000/transactions
browser_snapshot → verify:
  - Transaction table with columns (Status, TX Hash, Protocol, Type, Buy, Sell, EUR, Date)
  - Ampel filter chips (All, GREEN, YELLOW, RED, GRAY) with counts
  - Protocol filter dropdown
  - Search bar
```

### 5.2 Ampel Status Filters
```
For each filter chip (GREEN, YELLOW, RED, GRAY):
  browser_click → filter chip
  browser_snapshot → verify table shows only matching transactions
browser_click → "All" chip to reset
```

### 5.3 Protocol Filter
```
browser_select_option → protocol dropdown → "SparkDEX"
browser_snapshot → verify filtered results
browser_select_option → "All Protocols" to reset
```

### 5.4 Search by TX Hash
```
browser_type → search field → "0x" (partial hash)
browser_snapshot → verify filtered results
Clear search field
```

### 5.5 Pagination
```
browser_snapshot → count visible rows
browser_click → "Load More" button (if visible)
browser_snapshot → verify more rows loaded
```

---

## Phase 6: Exports

### 6.1 Exports Page
```
browser_navigate → http://localhost:3000/exports
browser_snapshot → verify:
  - Format dropdown (CSV, XLSX, PDF)
  - "Generate Export" button
  - Export history table (if any previous exports)
```

### 6.2 Generate CSV Export
```
browser_select_option → format dropdown → "CSV"
browser_click → "Generate Export" button
browser_snapshot → verify new row in export history with status PENDING or GENERATING
```

### 6.3 Export Status Tracking
```
(Wait 3-5 seconds)
browser_snapshot → verify export status progressed to COMPLETED
Verify download link appears for completed export
```

---

## Phase 7: Settings

### 7.1 Settings Page
```
browser_navigate → http://localhost:3000/settings
browser_snapshot → verify sections:
  - Plan Management (STARTER/PRO/BUSINESS)
  - Tax Method (FIFO/LIFO)
  - Two-Factor Authentication
  - Account (email, sign out)
```

### 7.2 Tax Method Selection
```
browser_click → LIFO radio button
browser_snapshot → verify LIFO is selected
browser_click → FIFO radio button (reset)
```

### 7.3 Plan Display
```
browser_snapshot → verify:
  - Current plan badge
  - Plan details (wallet limit, pricing)
  - Upgrade/downgrade options
```

### 7.4 Sign Out
```
browser_click → "Sign out" button
Verify: URL redirected to /login
```

---

## Phase 8: Cross-Cutting Concerns

Run these checks on **every page** visited during the test session.

### 8.1 Console Errors
```
browser_console_messages → flag any "error" level messages
Acceptable: React hydration warnings in dev mode
Not acceptable: Unhandled promise rejections, TypeError, ReferenceError
```

### 8.2 Network Failures
```
browser_network_requests → check for any 4xx/5xx responses
Acceptable: 401 on unauthenticated requests to protected endpoints
Not acceptable: 500 errors, failed fetch calls
```

### 8.3 Mobile Viewport
```
browser_resize → width: 375, height: 667
Navigate to each page → browser_snapshot → verify:
  - No horizontal scrollbar
  - Content is readable
  - Forms are usable
  - Navigation is accessible
```

### 8.4 Accessibility Snapshot
```
For each page, browser_snapshot → verify:
  - Proper heading hierarchy (h1 → h2 → h3)
  - Form inputs have associated labels
  - Buttons have accessible names
  - Links have descriptive text
  - ARIA landmarks present (main, nav, banner)
```

---

## Quick Smoke Test (5-minute subset)

For a fast smoke test, run only these scenarios:
1. **1.1** — Health endpoint
2. **1.3** — Login page loads
3. **2.2** — Login with credentials (use pre-existing test user)
4. **3.1** — Overview dashboard
5. **4.1** — Wallets page
6. **5.1** — Transactions page
7. **8.1** — Console errors check
