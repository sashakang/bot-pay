import { createHmac, randomBytes } from 'crypto';

/**
 * Generate an HMAC-signed approval token
 * Token format: base64(random(32)) + '.' + base64(hmac_signature)
 */
export function generateApprovalToken(
  paymentRequestId: string,
  secret: string,
): string {
  const randomPart = randomBytes(32).toString('base64url');
  const message = `${paymentRequestId}:${randomPart}`;
  const signature = createHmac('sha256', secret).update(message).digest('base64url');

  return `${message}.${signature}`;
}

/**
 * Verify an HMAC-signed approval token
 */
export function verifyApprovalToken(
  token: string,
  paymentRequestId: string,
  secret: string,
): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [id, randomPart, providedSignature] = parts;

    if (id !== paymentRequestId) {
      return false;
    }

    const message = `${id}:${randomPart}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(message)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(providedSignature, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
