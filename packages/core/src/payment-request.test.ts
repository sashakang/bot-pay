import { describe, it, expect } from 'vitest';
import {
  PaymentRequestEntity,
  PaymentStateMachine,
  PaymentRequestState,
  InvalidStateTransitionError,
} from './index.js';

describe('PaymentStateMachine', () => {
  it('should allow pending -> approved transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.PENDING,
        PaymentRequestState.APPROVED,
      ),
    ).toBe(true);
  });

  it('should allow pending -> denied transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.PENDING,
        PaymentRequestState.DENIED,
      ),
    ).toBe(true);
  });

  it('should allow pending -> expired transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.PENDING,
        PaymentRequestState.EXPIRED,
      ),
    ).toBe(true);
  });

  it('should allow approved -> executed transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.APPROVED,
        PaymentRequestState.EXECUTED,
      ),
    ).toBe(true);
  });

  it('should allow approved -> failed transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.APPROVED,
        PaymentRequestState.FAILED,
      ),
    ).toBe(true);
  });

  it('should reject denied -> approved transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.DENIED,
        PaymentRequestState.APPROVED,
      ),
    ).toBe(false);
  });

  it('should reject executed -> failed transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.EXECUTED,
        PaymentRequestState.FAILED,
      ),
    ).toBe(false);
  });

  it('should reject pending -> executed transition', () => {
    expect(
      PaymentStateMachine.isValidTransition(
        PaymentRequestState.PENDING,
        PaymentRequestState.EXECUTED,
      ),
    ).toBe(false);
  });

  it('should throw on invalid assertion', () => {
    expect(() => {
      PaymentStateMachine.assertValidTransition(
        PaymentRequestState.DENIED,
        PaymentRequestState.APPROVED,
      );
    }).toThrow(InvalidStateTransitionError);
  });
});

describe('PaymentRequestEntity', () => {
  const createPaymentRequest = () => ({
    id: 'req-123',
    agentId: 'agent-1',
    ownerId: 'owner-1',
    amount: 100,
    currency: 'USD' as const,
    description: 'Test payment',
    state: PaymentRequestState.PENDING,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should approve a pending payment request', () => {
    const request = createPaymentRequest();
    const entity = new PaymentRequestEntity(request);

    const approved = entity.approve('owner-1');

    expect(approved.state).toBe(PaymentRequestState.APPROVED);
    expect(approved.approvedBy).toBe('owner-1');
    expect(approved.approvedAt).toBeDefined();
  });

  it('should deny a pending payment request', () => {
    const request = createPaymentRequest();
    const entity = new PaymentRequestEntity(request);

    const denied = entity.deny('owner-1', 'Insufficient funds');

    expect(denied.state).toBe(PaymentRequestState.DENIED);
    expect(denied.deniedBy).toBe('owner-1');
    expect(denied.denialReason).toBe('Insufficient funds');
    expect(denied.deniedAt).toBeDefined();
  });

  it('should mark as expired', () => {
    const request = createPaymentRequest();
    const entity = new PaymentRequestEntity(request);

    const expired = entity.expire();

    expect(expired.state).toBe(PaymentRequestState.EXPIRED);
  });

  it('should mark approved request as executed', () => {
    const request = createPaymentRequest();
    request.state = PaymentRequestState.APPROVED;
    const entity = new PaymentRequestEntity(request);

    const executed = entity.markExecuted('txn-123');

    expect(executed.state).toBe(PaymentRequestState.EXECUTED);
    expect(executed.executedAt).toBeDefined();
  });

  it('should mark approved request as failed', () => {
    const request = createPaymentRequest();
    request.state = PaymentRequestState.APPROVED;
    const entity = new PaymentRequestEntity(request);

    const failed = entity.markFailed('Network error');

    expect(failed.state).toBe(PaymentRequestState.FAILED);
    expect(failed.failureReason).toBe('Network error');
  });

  it('should throw when approving denied request', () => {
    const request = createPaymentRequest();
    request.state = PaymentRequestState.DENIED;
    const entity = new PaymentRequestEntity(request);

    expect(() => entity.approve('owner-1')).toThrow(
      InvalidStateTransitionError,
    );
  });

  it('should detect expired requests', () => {
    const request = createPaymentRequest();
    request.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
    const entity = new PaymentRequestEntity(request);

    expect(entity.hasExpired()).toBe(true);
  });

  it('should detect non-expired requests', () => {
    const request = createPaymentRequest();
    const entity = new PaymentRequestEntity(request);

    expect(entity.hasExpired()).toBe(false);
  });

  it('should verify valid approval tokens', () => {
    const request = createPaymentRequest();
    const futureDate = new Date(Date.now() + 15 * 60 * 1000);
    request.approvalToken = 'valid-token';
    request.approvalTokenExpiresAt = futureDate;
    const entity = new PaymentRequestEntity(request);

    expect(entity.isApprovalTokenValid('valid-token')).toBe(true);
  });

  it('should reject invalid tokens', () => {
    const request = createPaymentRequest();
    request.approvalToken = 'valid-token';
    request.approvalTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const entity = new PaymentRequestEntity(request);

    expect(entity.isApprovalTokenValid('invalid-token')).toBe(false);
  });

  it('should reject expired approval tokens', () => {
    const request = createPaymentRequest();
    request.approvalToken = 'valid-token';
    request.approvalTokenExpiresAt = new Date(Date.now() - 1000); // Expired
    const entity = new PaymentRequestEntity(request);

    expect(entity.isApprovalTokenValid('valid-token')).toBe(false);
  });

  it('should be in terminal state when executed', () => {
    const request = createPaymentRequest();
    request.state = PaymentRequestState.EXECUTED;
    const entity = new PaymentRequestEntity(request);

    expect(entity.isTerminal()).toBe(true);
  });

  it('should not be in terminal state when pending', () => {
    const request = createPaymentRequest();
    const entity = new PaymentRequestEntity(request);

    expect(entity.isTerminal()).toBe(false);
  });
});
