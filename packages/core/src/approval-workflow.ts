import { PaymentRequest, PaymentRail, NotificationChannel } from './types.js';
import { PaymentRequestEntity } from './payment-request.js';
import { InvalidApprovalTokenError } from './errors.js';
import { verifyApprovalToken } from './crypto.js';

/**
 * Approval workflow orchestrator
 * Coordinates state transitions, notifications, and payment execution
 */
export class ApprovalWorkflow {
  constructor(
    private paymentRail: PaymentRail,
    private notificationChannel: NotificationChannel,
    private approvalTokenSecret: string,
  ) {}

  /**
   * Handle payment request creation
   * Sends notification to owner
   */
  async onPaymentRequestCreated(
    paymentRequest: PaymentRequest,
  ): Promise<void> {
    await this.notificationChannel.notifyPending(paymentRequest);
  }

  /**
   * Handle approval with token verification
   */
  async onPaymentApproved(
    paymentRequest: PaymentRequest,
    approvalToken: string,
    approvedBy: string,
  ): Promise<PaymentRequest> {
    // Verify token
    if (
      !verifyApprovalToken(
        approvalToken,
        paymentRequest.id,
        this.approvalTokenSecret,
      )
    ) {
      throw new InvalidApprovalTokenError();
    }

    // Update state
    const entity = new PaymentRequestEntity(paymentRequest);
    const updated = entity.approve(approvedBy);

    // Send notification
    await this.notificationChannel.notifyApproved(updated, approvedBy);

    return updated;
  }

  /**
   * Handle denial
   */
  async onPaymentDenied(
    paymentRequest: PaymentRequest,
    deniedBy: string,
    reason?: string,
  ): Promise<PaymentRequest> {
    const entity = new PaymentRequestEntity(paymentRequest);
    const updated = entity.deny(deniedBy, reason);

    await this.notificationChannel.notifyDenied(updated, deniedBy, reason);

    return updated;
  }

  /**
   * Handle expiration
   */
  async onPaymentExpired(
    paymentRequest: PaymentRequest,
  ): Promise<PaymentRequest> {
    const entity = new PaymentRequestEntity(paymentRequest);
    return entity.expire();
  }

  /**
   * Execute payment on the payment rail
   */
  async executePayment(
    paymentRequest: PaymentRequest,
  ): Promise<PaymentRequest> {
    const entity = new PaymentRequestEntity(paymentRequest);

    try {
      const result = await this.paymentRail.execute(paymentRequest);

      if (!result.success) {
        const updated = entity.markFailed(
          result.error || 'Unknown payment failure',
        );
        await this.notificationChannel.notifyFailed(
          updated,
          result.error || 'Unknown payment failure',
        );
        return updated;
      }

      const updated = entity.markExecuted(result.transactionId);
      await this.notificationChannel.notifyExecuted(updated);
      return updated;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const updated = entity.markFailed(errorMessage);
      await this.notificationChannel.notifyFailed(updated, errorMessage);
      return updated;
    }
  }
}
