import {
  PaymentRail,
  NotificationChannel,
  PaymentRequest,
} from './types.js';

/**
 * Mock payment rail adapter for testing and development
 * Logs payment execution to console
 */
export class MockPaymentRail implements PaymentRail {
  async execute(
    paymentRequest: PaymentRequest,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Simulate payment processing with optional failures
    const shouldFail = false; // Set to true to simulate failures

    if (shouldFail) {
      console.log(
        `[MockPaymentRail] ✗ Failed to execute payment ${paymentRequest.id}`,
      );
      return {
        success: false,
        error: 'Simulated payment failure',
      };
    }

    const transactionId = `mock-txn-${Date.now()}`;
    console.log(
      `[MockPaymentRail] ✓ Executed payment ${paymentRequest.id} -> ${transactionId}`,
    );
    console.log(
      `  Amount: ${paymentRequest.amount} ${paymentRequest.currency}`,
    );
    console.log(`  Recipient: ${paymentRequest.recipient || 'N/A'}`);
    console.log(`  Description: ${paymentRequest.description}`);

    return {
      success: true,
      transactionId,
    };
  }
}

/**
 * Mock notification channel for testing and development
 * Logs notifications to console
 */
export class MockNotificationChannel implements NotificationChannel {
  async notifyPending(paymentRequest: PaymentRequest): Promise<void> {
    console.log(`[MockNotificationChannel] 📧 Pending notification`);
    console.log(`  Request ID: ${paymentRequest.id}`);
    console.log(`  Amount: ${paymentRequest.amount} ${paymentRequest.currency}`);
    console.log(`  Description: ${paymentRequest.description}`);
  }

  async notifyApproved(
    paymentRequest: PaymentRequest,
    approvedBy: string,
  ): Promise<void> {
    console.log(`[MockNotificationChannel] ✅ Approval notification`);
    console.log(`  Request ID: ${paymentRequest.id}`);
    console.log(`  Approved by: ${approvedBy}`);
  }

  async notifyDenied(
    paymentRequest: PaymentRequest,
    deniedBy: string,
    reason?: string,
  ): Promise<void> {
    console.log(`[MockNotificationChannel] ❌ Denial notification`);
    console.log(`  Request ID: ${paymentRequest.id}`);
    console.log(`  Denied by: ${deniedBy}`);
    if (reason) {
      console.log(`  Reason: ${reason}`);
    }
  }

  async notifyExecuted(paymentRequest: PaymentRequest): Promise<void> {
    console.log(`[MockNotificationChannel] 💳 Execution notification`);
    console.log(`  Request ID: ${paymentRequest.id}`);
    console.log(`  Executed at: ${paymentRequest.executedAt}`);
  }

  async notifyFailed(
    paymentRequest: PaymentRequest,
    reason: string,
  ): Promise<void> {
    console.log(`[MockNotificationChannel] 💥 Failure notification`);
    console.log(`  Request ID: ${paymentRequest.id}`);
    console.log(`  Reason: ${reason}`);
  }
}
