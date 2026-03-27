import { describe, it, expect } from 'vitest';
import { generateApprovalToken, verifyApprovalToken } from './index.js';

describe('Approval Token Crypto', () => {
  const secret = 'test-secret-key-12345';
  const paymentRequestId = 'req-123';

  it('should generate a valid approval token', () => {
    const token = generateApprovalToken(paymentRequestId, secret);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('should verify a valid approval token', () => {
    const token = generateApprovalToken(paymentRequestId, secret);
    const isValid = verifyApprovalToken(token, paymentRequestId, secret);

    expect(isValid).toBe(true);
  });

  it('should reject an invalid token signature', () => {
    const token = generateApprovalToken(paymentRequestId, secret);
    const [id, randomPart] = token.split('.');
    const invalidToken = `${id}.${randomPart}.invalidsignature`;

    const isValid = verifyApprovalToken(
      invalidToken,
      paymentRequestId,
      secret,
    );

    expect(isValid).toBe(false);
  });

  it('should reject a token with mismatched request ID', () => {
    const token = generateApprovalToken(paymentRequestId, secret);
    const isValid = verifyApprovalToken(
      token,
      'different-request-id',
      secret,
    );

    expect(isValid).toBe(false);
  });

  it('should reject a token signed with wrong secret', () => {
    const token = generateApprovalToken(paymentRequestId, secret);
    const isValid = verifyApprovalToken(
      token,
      paymentRequestId,
      'wrong-secret',
    );

    expect(isValid).toBe(false);
  });

  it('should reject a malformed token', () => {
    const isValid = verifyApprovalToken(
      'malformed-token-no-dots',
      paymentRequestId,
      secret,
    );

    expect(isValid).toBe(false);
  });

  it('should reject an empty token', () => {
    const isValid = verifyApprovalToken('', paymentRequestId, secret);

    expect(isValid).toBe(false);
  });

  it('should generate different tokens each time', () => {
    const token1 = generateApprovalToken(paymentRequestId, secret);
    const token2 = generateApprovalToken(paymentRequestId, secret);

    expect(token1).not.toBe(token2);
  });

  it('should verify all generated tokens with correct secret', () => {
    for (let i = 0; i < 5; i++) {
      const token = generateApprovalToken(paymentRequestId, secret);
      const isValid = verifyApprovalToken(token, paymentRequestId, secret);
      expect(isValid).toBe(true);
    }
  });
});
