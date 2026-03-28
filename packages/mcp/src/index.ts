import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BOT_PAY_API_URL = process.env.BOT_PAY_API_URL || 'http://localhost:3000';
const BOT_PAY_API_KEY = process.env.BOT_PAY_API_KEY || '';

if (!BOT_PAY_API_KEY) {
  console.error('BOT_PAY_API_KEY environment variable is required');
  process.exit(1);
}

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${BOT_PAY_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BOT_PAY_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Unknown error';
    throw new Error(`bot-pay API error ${response.status}: ${message}`);
  }

  return data;
}

function formatStatus(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    approved: '✅',
    denied: '❌',
    expired: '⌛',
    executed: '💸',
    failed: '🚨',
  };
  return `${icons[status] || '❓'} ${status.toUpperCase()}`;
}

const server = new Server(
  { name: 'bot-pay', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'request_payment',
      description: 'Request a payment that requires owner approval. The owner will be notified and must approve before payment executes.',
      inputSchema: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Payment amount (e.g. 49.99)' },
          currency: { type: 'string', description: 'Currency code (e.g. USD, EUR)', default: 'USD' },
          description: { type: 'string', description: 'What this payment is for' },
          recipient: { type: 'string', description: 'Who/where the money goes (optional)' },
        },
        required: ['amount', 'currency', 'description'],
      },
    },
    {
      name: 'check_payment_status',
      description: 'Check the current status of a payment request.',
      inputSchema: {
        type: 'object',
        properties: {
          request_id: { type: 'string', description: 'Payment request ID returned by request_payment' },
        },
        required: ['request_id'],
      },
    },
    {
      name: 'cancel_payment_request',
      description: 'Cancel a pending payment request.',
      inputSchema: {
        type: 'object',
        properties: {
          request_id: { type: 'string', description: 'Payment request ID to cancel' },
        },
        required: ['request_id'],
      },
    },
    {
      name: 'list_payments',
      description: 'List recent payment requests.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of results (default 10)', default: 10 },
          status: { type: 'string', description: 'Filter by status: pending, approved, denied, executed, failed' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === 'request_payment') {
      const { amount, currency = 'USD', description, recipient } = args as {
        amount: number; currency?: string; description: string; recipient?: string;
      };

      const data = await apiCall('POST', '/api/payment-requests', {
        amount, currency, description, recipient,
      }) as Record<string, unknown>;

      return {
        content: [{
          type: 'text',
          text: [
            `✅ Payment request created successfully.`,
            ``,
            `📋 Request ID: ${data.id}`,
            `💰 Amount: ${amount} ${currency}`,
            `📝 Description: ${description}`,
            recipient ? `🏦 Recipient: ${recipient}` : null,
            `⏰ Expires in: 15 minutes`,
            ``,
            `The owner has been notified and must approve this payment. Use check_payment_status("${data.id}") to poll for the result.`,
          ].filter(Boolean).join('\n'),
        }],
      };
    }

    if (name === 'check_payment_status') {
      const { request_id } = args as { request_id: string };
      const data = await apiCall('GET', `/api/payment-requests/${request_id}`) as Record<string, unknown>;

      const status = data.status as string;
      let message = '';

      if (status === 'pending') {
        message = `Payment request is waiting for owner approval. Check again in a moment.`;
      } else if (status === 'approved') {
        message = `Payment was approved by the owner. Executing...`;
      } else if (status === 'executed') {
        message = `Payment was approved and executed successfully.`;
      } else if (status === 'denied') {
        const reason = data.denialReason ? ` Reason: ${data.denialReason}` : '';
        message = `Payment request was denied by the owner.${reason}`;
      } else if (status === 'expired') {
        message = `Payment request expired before the owner responded.`;
      } else if (status === 'failed') {
        message = `Payment execution failed. Reason: ${data.failureReason || 'Unknown'}`;
      }

      return {
        content: [{
          type: 'text',
          text: [
            `${formatStatus(status)}`,
            ``,
            `📋 Request ID: ${request_id}`,
            `💰 Amount: ${data.amount} ${data.currency}`,
            `📝 Description: ${data.description}`,
            ``,
            message,
          ].join('\n'),
        }],
      };
    }

    if (name === 'cancel_payment_request') {
      const { request_id } = args as { request_id: string };
      await apiCall('POST', `/api/payment-requests/${request_id}/deny`, {
        reason: 'Cancelled by agent',
      });

      return {
        content: [{
          type: 'text',
          text: `✅ Payment request ${request_id} has been cancelled.`,
        }],
      };
    }

    if (name === 'list_payments') {
      const { limit = 10, status } = args as { limit?: number; status?: string };
      const query = new URLSearchParams();
      query.set('limit', String(limit));
      if (status) query.set('status', status);

      const data = await apiCall('GET', `/api/payment-requests?${query}`) as { items: Record<string, unknown>[] };
      const items = data.items || [];

      if (items.length === 0) {
        return {
          content: [{ type: 'text', text: 'No payment requests found.' }],
        };
      }

      const lines = items.map((item) =>
        `• ${formatStatus(item.status as string)} ${item.amount} ${item.currency} — ${item.description} (ID: ${item.id})`,
      );

      return {
        content: [{
          type: 'text',
          text: `Recent payment requests:\n\n${lines.join('\n')}`,
        }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('bot-pay MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
