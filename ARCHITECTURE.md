# bot-pay: Architecture & Implementation Reference

**Created:** 2026-03-27  
**Project:** https://github.com/sashakang/bot-pay  
**Status:** Phase 1 complete (~85%)

---

## Core Concept

Agent requests payment → push notification to owner → owner approves in real-time → payment executes.

**Key insight:** Zero pre-authorization. Owner approves each transaction at the moment it happens. The approval workflow is completely independent of the payment rail (Stripe, ACH, stablecoins, bank transfer - doesn't matter).

**Differentiator vs AgentCard/CardForAgent:** Those use pre-auth (guess the limit upfront). bot-pay uses real-time push approval, which is strictly better: no over-allocation risk, owner sees exactly what agent wants, scales to any expense size.

---

## Monorepo Structure

```
bot-pay/
├── packages/
│   ├── core/                    # Domain logic (no framework deps)
│   │   └── src/
│   │       ├── types.ts         # All TypeScript types
│   │       ├── errors.ts        # Custom error classes
│   │       ├── payment-request.ts  # State machine + entity
│   │       ├── approval-workflow.ts # Orchestrator
│   │       ├── adapters.ts      # Interfaces + mock impls
│   │       ├── crypto.ts        # HMAC approval tokens
│   │       └── index.ts         # Public exports
│   ├── server/                  # Fastify REST API
│   │   ├── src/
│   │   │   ├── app.ts           # Fastify setup, plugins, auth decorator
│   │   │   ├── routes.ts        # All API endpoints
│   │   │   ├── repositories.ts  # DB queries (raw SQL)
│   │   │   ├── database.ts      # Postgres connection
│   │   │   ├── index.ts         # Entry point
│   │   │   └── migrate.ts       # Migration runner
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql
│   │   └── Dockerfile
│   ├── mcp/                     # MCP server for agent integration
│   │   └── src/index.ts         # 4 MCP tools
│   └── notification-telegram/   # Telegram approval adapter
│       └── src/index.ts         # TelegramNotificationChannel
├── docker-compose.yml
├── package.json                 # npm workspaces
└── tsconfig.json
```

---

## Architecture Layers

```
┌─────────────────────────────────────────┐
│  Agent (Claude, GPT, etc)               │
│  Connects via MCP protocol              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  packages/mcp - MCP Server              │
│  Tools: request_payment,                │
│  check_payment_status,                  │
│  cancel_payment_request, list_payments  │
└──────────────┬──────────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────────┐
│  packages/server - REST API             │
│  Fastify + PostgreSQL + Redis           │
│  POST /api/payment-requests             │
│  GET  /api/payment-requests/:id         │
│  POST /api/payment-requests/:id/approve │
│  POST /api/payment-requests/:id/deny    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  packages/core - Domain Logic           │
│  PaymentRequest state machine           │
│  ApprovalWorkflow orchestrator          │
│  Pluggable: PaymentRailAdapter          │
│  Pluggable: NotificationChannel         │
└────────────┬────────────────────────────┘
             │                │
┌────────────▼──────┐  ┌──────▼─────────────────┐
│  Payment Rails    │  │  Notification Channels  │
│  MockPaymentRail  │  │  TelegramNotification   │
│  (Stripe adapter) │  │  (Slack adapter)        │
│  (Plaid adapter)  │  │  (Email adapter)        │
└───────────────────┘  └────────────────────────┘
```

---

## State Machine

```
pending
  ├── approved  →  executed
  │              └  failed
  ├── denied    (terminal)
  └── expired   (terminal)
```

- All transitions are enforced by `PaymentStateMachine`
- Approval token: HMAC-SHA256 signed, one-time use, 15-min expiry
- Idempotency keys prevent duplicate requests from agents

---

## Database Schema (PostgreSQL)

4 tables:
- `owners` - humans who approve payments
- `agents` - AI agents with API keys, linked to owners
- `payment_requests` - core table with all state transitions
- `audit_logs` - immutable log of every action (JSONB metadata)

Key columns on `payment_requests`:
- `state` - current state (enum)
- `approval_token` + `approval_token_expires_at` - one-time token
- `approved_by/denied_by` - who acted
- `expires_at` - when request auto-expires
- `idempotency_key` - prevents duplicate agent requests

---

## MCP Tools (packages/mcp)

Stdio transport, works with Claude Desktop, Cursor, any MCP client.

| Tool | What it does |
|------|-------------|
| `request_payment(amount, currency, description, recipient?)` | Creates request, notifies owner, returns request_id |
| `check_payment_status(request_id)` | Returns current state with human-readable message |
| `cancel_payment_request(request_id)` | Cancels pending request |
| `list_payments(limit?, status?)` | Lists recent requests with status icons |

Config via env: `BOT_PAY_API_URL`, `BOT_PAY_API_KEY`

---

## Telegram Adapter (packages/notification-telegram)

`TelegramNotificationChannel` implements `NotificationChannel`.

Flow:
1. `send()` posts message with inline keyboard to owner's chat
2. Owner taps ✅ or ❌
3. `handleCallbackQuery()` calls server approve/deny endpoint
4. Original message is edited to show result (no new messages)

Callback data format: `approve:REQUEST_ID:APPROVAL_TOKEN` / `deny:REQUEST_ID`

Config: `botToken`, `ownerChatId`, `botPayApiUrl`, `botPayAdminToken`

---

## Known Gaps (as of Phase 1 completion)

1. `fastify.authenticate` decorator referenced but not wired up in `app.ts` - JWT auth middleware needs connecting
2. `docker-compose up` not end-to-end tested yet
3. MCP package needs `npm install` to pull `@modelcontextprotocol/sdk`
4. No integration tests (only unit tests for core)
5. `notification-telegram` package not exported from monorepo root scripts

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript strict | Strong types for payment domain |
| Server | Fastify | Smaller surface area vs Express |
| DB | PostgreSQL (raw SQL) | ACID, no ORM overhead |
| Queue | Redis/ioredis | Async notifications, retries |
| Testing | Vitest | Fast, ESM-native |
| MCP | @modelcontextprotocol/sdk | Official Anthropic SDK |
| Telegram | node-telegram-bot-api | Mature, typed |
| Container | Docker + docker-compose | One-command local dev |

---

## Decision Memo

Full Go/No-Go analysis saved at:
`/Users/athanasios/.openclaw/workspace/agent-payment-framework-decision-memo.md`

Key decision: BUILD as open-source library, not closed product. Gap exists in market (AgentCard/CardForAgent are closed + pre-auth model is inferior). MIT license. OSS-to-SaaS playbook.

Timeline: Phase 1 done March 27-28, 2026.
