import TelegramBot from 'node-telegram-bot-api';
import type { PaymentRequest, NotificationChannel } from '@bot-pay/core';

export interface TelegramNotificationConfig {
  botToken: string;
  ownerChatId: string;
  botPayApiUrl: string;
  botPayAdminToken: string;
}

/**
 * Telegram notification adapter for bot-pay.
 * Sends payment approval requests as Telegram messages with inline buttons.
 */
export class TelegramNotificationChannel implements NotificationChannel {
  private bot: TelegramBot;
  private config: TelegramNotificationConfig;

  constructor(config: TelegramNotificationConfig) {
    this.config = config;
    this.bot = new TelegramBot(config.botToken, { polling: false });
  }

  /**
   * Send a payment approval request to the owner via Telegram.
   */
  async send(_ownerId: string, request: PaymentRequest): Promise<void> {
    const expiresInMs = request.expiresAt.getTime() - Date.now();
    const expiresInMin = Math.max(0, Math.floor(expiresInMs / 60000));

    const text = [
      `🤖 *Payment Request*`,
      ``,
      `💰 *Amount:* ${request.amount} ${request.currency}`,
      `📝 *Description:* ${request.description}`,
      request.recipient ? `🏦 *Recipient:* ${request.recipient}` : null,
      `⏰ *Expires:* in ${expiresInMin} minute${expiresInMin !== 1 ? 's' : ''}`,
      `🆔 *Request ID:* \`${request.id}\``,
      ``,
      `Please approve or deny this payment request.`,
    ].filter(Boolean).join('\n');

    const token = request.approvalToken ?? '';

    await this.bot.sendMessage(this.config.ownerChatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '✅ Approve',
            callback_data: `approve:${request.id}:${token}`,
          },
          {
            text: '❌ Deny',
            callback_data: `deny:${request.id}`,
          },
        ]],
      },
    });
  }

  /**
   * Start polling for callback queries (approve/deny button taps).
   * Call this once when setting up the server.
   */
  startPolling(): void {
    this.bot.stopPolling();
    this.bot = new TelegramBot(this.config.botToken, { polling: true });

    this.bot.on('callback_query', async (query) => {
      if (!query.data || !query.message) return;

      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;
      const data = query.data;

      try {
        if (data.startsWith('approve:')) {
          const [, requestId, token] = data.split(':');
          await this.handleApprove(requestId, token, chatId, messageId);
        } else if (data.startsWith('deny:')) {
          const [, requestId] = data.split(':');
          await this.handleDeny(requestId, chatId, messageId);
        }

        await this.bot.answerCallbackQuery(query.id);
      } catch (err) {
        console.error('Error handling callback query:', err);
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Error processing request. Please try again.',
          show_alert: true,
        });
      }
    });
  }

  private async handleApprove(
    requestId: string,
    token: string,
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const response = await fetch(
      `${this.config.botPayApiUrl}/api/payment-requests/${requestId}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.botPayAdminToken}`,
        },
        body: JSON.stringify({ token }),
      },
    );

    if (!response.ok) {
      const err = await response.json() as { message?: string };
      throw new Error(err.message || 'Failed to approve payment');
    }

    await this.bot.editMessageText(
      `✅ *Payment Approved*\n\nRequest ID: \`${requestId}\`\nYou approved this payment. It will be executed shortly.`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
      },
    );
  }

  private async handleDeny(
    requestId: string,
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const response = await fetch(
      `${this.config.botPayApiUrl}/api/payment-requests/${requestId}/deny`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.botPayAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Denied by owner via Telegram' }),
      },
    );

    if (!response.ok) {
      const err = await response.json() as { message?: string };
      throw new Error(err.message || 'Failed to deny payment');
    }

    await this.bot.editMessageText(
      `❌ *Payment Denied*\n\nRequest ID: \`${requestId}\`\nYou denied this payment request.`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
      },
    );
  }
}
