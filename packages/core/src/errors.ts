/**
 * Base error class for bot-pay domain errors
 */
export class BotPayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'BotPayError';
    Object.setPrototypeOf(this, BotPayError.prototype);
  }
}

/**
 * Raised when a payment request is not found
 */
export class PaymentRequestNotFoundError extends BotPayError {
  constructor(id: string) {
    super(
      `Payment request not found: ${id}`,
      'PAYMENT_REQUEST_NOT_FOUND',
      404,
    );
    this.name = 'PaymentRequestNotFoundError';
    Object.setPrototypeOf(this, PaymentRequestNotFoundError.prototype);
  }
}

/**
 * Raised when a state transition is invalid
 */
export class InvalidStateTransitionError extends BotPayError {
  constructor(fromState: string, toState: string) {
    super(
      `Invalid state transition from ${fromState} to ${toState}`,
      'INVALID_STATE_TRANSITION',
      400,
    );
    this.name = 'InvalidStateTransitionError';
    Object.setPrototypeOf(this, InvalidStateTransitionError.prototype);
  }
}

/**
 * Raised when an approval token is invalid or expired
 */
export class InvalidApprovalTokenError extends BotPayError {
  constructor(message: string = 'Invalid or expired approval token') {
    super(message, 'INVALID_APPROVAL_TOKEN', 401);
    this.name = 'InvalidApprovalTokenError';
    Object.setPrototypeOf(this, InvalidApprovalTokenError.prototype);
  }
}

/**
 * Raised when an operation cannot be performed due to payment request state
 */
export class InvalidPaymentRequestStateError extends BotPayError {
  constructor(id: string, currentState: string, operation: string) {
    super(
      `Cannot ${operation} payment request in ${currentState} state`,
      'INVALID_PAYMENT_REQUEST_STATE',
      409,
    );
    this.name = 'InvalidPaymentRequestStateError';
    Object.setPrototypeOf(this, InvalidPaymentRequestStateError.prototype);
  }
}

/**
 * Raised when payment execution fails
 */
export class PaymentExecutionError extends BotPayError {
  constructor(id: string, reason: string) {
    super(
      `Failed to execute payment ${id}: ${reason}`,
      'PAYMENT_EXECUTION_FAILED',
      500,
    );
    this.name = 'PaymentExecutionError';
    Object.setPrototypeOf(this, PaymentExecutionError.prototype);
  }
}

/**
 * Raised when authentication fails
 */
export class AuthenticationError extends BotPayError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_FAILED', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Raised when authorization fails
 */
export class AuthorizationError extends BotPayError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_FAILED', 403);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
