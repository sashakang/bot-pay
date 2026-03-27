# bot-pay 🤖💳

**Open-source framework for AI agents to request and execute payments with human approval.**

Give your AI agents the ability to spend money responsibly. An agent requests payment → you get a notification → you approve/deny → payment executes. Zero pre-authorization limits. Real-time control.

## The Problem

You've trained an AI agent to do useful work: book flights, order supplies, pay invoices, trade crypto. But it can't actually *spend money* without you. And the existing solutions trap you:

- **Pre-auth models** (like AgentCard) force you to guess spending limits upfront
- **Closed platforms** lock you into their payment system
- **Manual workflows** require you to be online to approve everything

**bot-pay** solves this: agent requests payment → you approve in real-time in your bank app like you usually do → bot's card got topped up by the exact paymen amount → payment executes. Works with any payment system. Open source.

## How It Works (60 seconds)

```
Agent (Claude, etc.)
  ↓
  "I need to spend $49.99 on AWS credits"
  ↓
Your phone buzzes with bank app notification
  ↓
  [✅ Approve]  [❌ Deny]
  ↓
Payment executes if you approve
```

That's it. No pre-auth limits. No locked-in payments system. Just approval in real-time.

## Who Should Use This?

### For Developers
You're building agents that need to interact with real services (APIs, subscriptions, purchases). Instead of hardcoding credentials or pre-funding accounts, use bot-pay to let agents request payments with human oversight.

**Example:**
```typescript
const agent = Claude(...);

// Agent needs to buy something
const payment = await agent.tools.request_payment({
  amount: 49.99,
  description: "AWS credits for deployment",
  recipient: "aws.amazon.com"
});

// You get notified
// You approve in your Telegram
// Agent continues with payment confirmation
```

### For Finance Teams
You manage AI automation across your organization. Instead of pre-loading budgets or issuing company cards to bots, use bot-pay to:
- See every payment request in real-time
- Approve/deny instantly from your phone
- Audit trail of all decisions
- Set spending policies per agent

### For Solo Builders
You have a personal agent that books flights, orders supplies, manages your calendar. Instead of giving it unlimited access to your credit card, use bot-pay to control each transaction.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for local dev)
- A Telegram bot (5 minutes to create)

### 1. Clone & Install

```bash
git clone https://github.com/sashakang/bot-pay.git
cd bot-pay
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/bot_pay

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
NODE_ENV=development

# JWT secret (generate: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here

# HMAC secret for approval tokens
APPROVAL_TOKEN_SECRET=your_approval_secret_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook
```

### 3. Start Local Stack

```bash
npm run docker:up
npm run db:migrate
npm run dev
```

Server runs on `http://localhost:3000`

### 4. Create Your First Agent

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin_token" \
  -d '{
    "name": "My Automation Bot",
    "ownerId": "user-123"
  }'
```

Response:
```json
{
  "id": "agent-456",
  "apiKey": "sk_test_xyz123...",
  "name": "My Automation Bot"
}
```

### 5. Integrate with Claude (or any MCP client)

Add to your Claude Desktop config (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "bot-pay": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/bot-pay/packages/mcp/dist/index.js"],
      "env": {
        "BOT_PAY_API_URL": "http://localhost:3000",
        "BOT_PAY_API_KEY": "sk_test_xyz123..."
      }
    }
  }
}
```

Now Claude has access to:
- `request_payment(amount, currency, description)` - Request a payment
- `check_payment_status(requestId)` - Check if approved/denied
- `list_payments(limit?, status?)` - See payment history

## Use Cases

### SaaS Automation Platform
You built a tool that autonomously optimizes cloud infrastructure. It finds cost-saving opportunities and needs to execute them (switch instances, scale down, buy reserved capacity). Use bot-pay so you approve each action before it costs real money.

### Personal AI Assistant
Your agent manages your calendar, books flights, orders supplies. Give it real purchasing power, but require approval for anything over $50. Approve from your phone in 2 seconds.

### Enterprise Finance Automation
Your AP team automated invoice processing. Invoices under $1000 auto-approve, anything larger waits for human review. bot-pay handles the approval workflow with full audit trail.

### Crypto Trading Bot
Your agent trades with real funds. Instead of pre-funding an account, each trade request goes to you for approval. See what it's about to buy before it buys.

### AI-Powered Recruitment
Your hiring bot posts job ads, buys credentials, pays for background checks. Each expense requires approval from the hiring manager.

## Architecture

### Three Layers

```
┌──────────────────────────────────────────┐
│   Agent Layer (Claude, GPT, etc)         │
│   Talks via MCP protocol                 │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│   Orchestration Layer                    │
│   PaymentRequest state machine           │
│   Approval workflow engine               │
│   Notification system                    │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│   Payment Rails (pluggable)              │
│   Stripe | Plaid | ACH | Stablecoins     │
│   Banks | Payment processors             │
└──────────────────────────────────────────┘
```

### Key Design Decisions

**Real-Time Approval, Not Pre-Auth**
- Agent requests $X
- You get notified immediately
- You approve/deny in real-time
- Payment only executes if approved
- No guessing spending limits upfront

**Payment Rail Agnostic**
- Use Stripe virtual cards? Great.
- Use ACH transfers? Great.
- Use bank push notifications? Great.
- Use stablecoins? Great.
- Swap payment systems without rewriting approval logic

**Immutable Audit Trail**
- Every request, approval, denial is logged
- Can't be modified or deleted
- Full compliance with financial regulations

**Notification Flexibility**
- Get approvals via Telegram, Slack, SMS, email
- Different channels for different roles
- Or write your own channel adapter

## API Reference

### Create Payment Request
```bash
POST /api/payment-requests
Authorization: Bearer sk_test_xyz...
Content-Type: application/json

{
  "amount": 49.99,
  "currency": "USD",
  "description": "AWS credits",
  "recipient": "aws.amazon.com",
  "idempotencyKey": "unique-key-123" // optional, prevents duplicate requests
}
```

Response:
```json
{
  "id": "req-789",
  "status": "pending",
  "amount": 49.99,
  "currency": "USD",
  "description": "AWS credits",
  "approvalUrl": "https://your-domain.com/approve/req-789",
  "expiresIn": 900
}
```

### Check Payment Status
```bash
GET /api/payment-requests/req-789
Authorization: Bearer sk_test_xyz...
```

Response:
```json
{
  "id": "req-789",
  "status": "approved",
  "amount": 49.99,
  "currency": "USD",
  "approvedAt": "2026-03-27T13:30:00Z",
  "approvedBy": "sasha@example.com",
  "executedAt": "2026-03-27T13:30:05Z"
}
```

### Approve Payment (via Telegram)
Owner taps `[✅ Approve]` button in Telegram notification.

Or programmatically:
```bash
POST /api/payment-requests/req-789/approve
Authorization: Bearer owner_token
Content-Type: application/json

{
  "token": "approval_token_from_notification"
}
```

### Deny Payment
```bash
POST /api/payment-requests/req-789/deny
Authorization: Bearer owner_token
Content-Type: application/json

{
  "reason": "Not approved for this vendor"
}
```

## Security

### Approval Tokens
- HMAC-SHA256 signed
- One-time use (single approval invalidates it)
- 15-minute expiry by default
- Cryptographically random

### Agent Authentication
- JWT Bearer tokens
- Rate limiting per agent (100 req/min default)
- Can be revoked instantly
- Agent identity is always logged

### Database Security
- All SQL is parameterized (no injection)
- Sensitive data encrypted at rest (optional)
- Audit log is immutable
- Access control at API level

### Secrets Management
- No secrets hardcoded
- All config via environment variables
- API keys never logged
- Approval tokens are one-time only

## Customization

### Add a New Payment Rail

Implement `PaymentRailAdapter`:

```typescript
import { PaymentRailAdapter } from '@bot-pay/core';

export class MyPaymentRail implements PaymentRailAdapter {
  async fundAccount(requestId: string, amount: number): Promise<string> {
    // Call your payment processor
    const txn = await myPaymentService.transfer(amount);
    return txn.id;
  }

  async getStatus(txnId: string): Promise<'pending' | 'succeeded' | 'failed'> {
    const status = await myPaymentService.getStatus(txnId);
    return status;
  }

  async refund(txnId: string): Promise<void> {
    await myPaymentService.refund(txnId);
  }
}
```

Register it in your server config:

```typescript
const paymentRail = new MyPaymentRail();
const workflow = new ApprovalWorkflow(paymentRail, notificationChannel);
```

### Add a New Notification Channel

Implement `NotificationChannel`:

```typescript
import { NotificationChannel, PaymentRequest } from '@bot-pay/core';

export class SlackNotification implements NotificationChannel {
  async send(ownerId: string, request: PaymentRequest): Promise<void> {
    await slack.postMessage({
      channel: `@owner-${ownerId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Payment Request*\nAmount: $${request.amount}\nDescription: ${request.description}`
          }
        },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: 'Approve', action_id: `approve_${request.id}` },
            { type: 'button', text: 'Deny', action_id: `deny_${request.id}` }
          ]
        }
      ]
    });
  }
}
```

## Roadmap

- [ ] Mobile app for approvals (iOS/Android)
- [ ] Spending limits per agent
- [ ] Recurring payment support
- [ ] Multi-signature approvals
- [ ] Advanced analytics & reporting
- [ ] WebAuthn for security
- [ ] Kubernetes deployment guide
- [ ] More payment rail adapters (PayPal, Wise, Square, etc)

## Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT - Use freely in commercial and personal projects.

## Support

- **Issues**: [GitHub Issues](https://github.com/sashakang/bot-pay/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sashakang/bot-pay/discussions)
- **Email**: support@bot-pay.dev (if you set this up)

## Acknowledgments

Built to address a real gap in agent infrastructure. Inspired by:
- AgentCard (closed-source competitor)
- Model Context Protocol (Anthropic)
- Modern Treasury (payment orchestration)
- Plaid (open banking)

---

**Made with ❤️ for developers building autonomous systems that need real money control.**

*Start with the Quick Start → Run locally → Try it with Claude → Deploy to production → Profit.*
