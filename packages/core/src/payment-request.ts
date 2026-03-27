import { PaymentRequest, PaymentRequestState } from './types.js';
import {
  InvalidStateTransitionError,
  InvalidPaymentRequestStateError,
} from './errors.js';

/**
 * Payment state machine - enforces valid state transitions
 * pending -> approved | denied | expired
 * approved -> executed | failed
 * Others are terminal states
 */
export class PaymentStateMachine {
  /**
   * Valid state transitions
   */
  private static readonly VALID_TRANSITIONS: Record<
    PaymentRequestState,
    PaymentRequestState[]
  > = {
    [PaymentRequestState.PENDING]: [
      PaymentRequestState.APPROVED,
      PaymentRequestState.DENIED,
      PaymentRequestState.EXPIRED,
    ],
    [PaymentRequestState.APPROVED]: [
      PaymentRequestState.EXECUTED,
      PaymentRequestState.FAILED,
    ],
    [PaymentRequestState.DENIED]: [],
    [PaymentRequestState.EXPIRED]: [],
    [PaymentRequestState.EXECUTED]: [],
    [PaymentRequestState.FAILED]: [],
  };

  /**
   * Check if a state transition is valid
   */
  static isValidTransition(
    fromState: PaymentRequestState,
    toState: PaymentRequestState,
  ): boolean {
    const validTargets = this.VALID_TRANSITIONS[fromState];
    return validTargets?.includes(toState) ?? false;
  }

  /**
   * Assert that a transition is valid, throw otherwise
   */
  static assertValidTransition(
    fromState: PaymentRequestState,
    toState: PaymentRequestState,
  ): void {
    if (!this.isValidTransition(fromState, toState)) {
      throw new InvalidStateTransitionError(fromState, toState);
    }
  }
}

/**
 * Domain model for a payment request
 */
export class PaymentRequestEntity {
  constructor(private request: PaymentRequest) {}

  /**
   * Get the current state
   */
  getState(): PaymentRequestState {
    return this.request.state;
  }

  /**
   * Get the payment request
   */
  toJSON(): PaymentRequest {
    return { ...this.request };
  }

  /**
   * Approve the payment request
   */
  approve(approvedBy: string): PaymentRequest {
    PaymentStateMachine.assertValidTransition(
      this.request.state,
      PaymentRequestState.APPROVED,
    );

    this.request.state = PaymentRequestState.APPROVED;
    this.request.approvedBy = approvedBy;
    this.request.approvedAt = new Date();
    this.request.updatedAt = new Date();

    return this.request;
  }

  /**
   * Deny the payment request
   */
  deny(deniedBy: string, reason?: string): PaymentRequest {
    PaymentStateMachine.assertValidTransition(
      this.request.state,
      PaymentRequestState.DENIED,
    );

    this.request.state = PaymentRequestState.DENIED;
    this.request.deniedBy = deniedBy;
    this.request.deniedAt = new Date();
    this.request.denialReason = reason;
    this.request.updatedAt = new Date();

    return this.request;
  }

  /**
   * Mark as expired
   */
  expire(): PaymentRequest {
    PaymentStateMachine.assertValidTransition(
      this.request.state,
      PaymentRequestState.EXPIRED,
    );

    this.request.state = PaymentRequestState.EXPIRED;
    this.request.updatedAt = new Date();

    return this.request;
  }

  /**
   * Mark as executed
   */
  markExecuted(transactionId?: string): PaymentRequest {
    PaymentStateMachine.assertValidTransition(
      this.request.state,
      PaymentRequestState.EXECUTED,
    );

    this.request.state = PaymentRequestState.EXECUTED;
    this.request.executedAt = new Date();
    this.request.updatedAt = new Date();

    return this.request;
  }

  /**
   * Mark as failed
   */
  markFailed(reason: string): PaymentRequest {
    PaymentStateMachine.assertValidTransition(
      this.request.state,
      PaymentRequestState.FAILED,
    );

    this.request.state = PaymentRequestState.FAILED;
    this.request.failedAt = new Date();
    this.request.failureReason = reason;
    this.request.updatedAt = new Date();

    return this.request;
  }

  /**
   * Check if the approval token is valid and not expired
   */
  isApprovalTokenValid(token: string): boolean {
    if (!this.request.approvalToken || !this.request.approvalTokenExpiresAt) {
      return false;
    }

    if (this.request.state !== PaymentRequestState.PENDING) {
      return false;
    }

    const isTokenValid = this.request.approvalToken === token;
    const isNotExpired = this.request.approvalTokenExpiresAt > new Date();

    return isTokenValid && isNotExpired;
  }

  /**
   * Check if payment request has expired
   */
  hasExpired(): boolean {
    return this.request.expiresAt <= new Date();
  }

  /**
   * Check if payment request can be approved
   */
  canBeApproved(): boolean {
    return (
      this.request.state === PaymentRequestState.PENDING &&
      !this.hasExpired()
    );
  }

  /**
   * Check if payment request can be denied
   */
  canBeDenied(): boolean {
    return (
      this.request.state === PaymentRequestState.PENDING &&
      !this.hasExpired()
    );
  }

  /**
   * Check if payment request is in a terminal state
   */
  isTerminal(): boolean {
    return ![
      PaymentRequestState.PENDING,
      PaymentRequestState.APPROVED,
    ].includes(this.request.state);
  }
}
