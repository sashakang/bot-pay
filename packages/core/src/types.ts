/**
 * Payment request states
 * pending -> approved/denied/expired
 * approved -> executed/failed
 */
export enum PaymentRequestState {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
  EXECUTED = 'executed',
  FAILED = 'failed',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
}

/**
 * Represents a payment request created by an agent
 */
export interface PaymentRequest {
  id: string;
  agentId: string;
  ownerId: string;
  amount: number;
  currency: Currency;
  description: string;
  recipient?: string;
  state: PaymentRequestState;
  approvalToken?: string;
  approvalTokenExpiresAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  deniedAt?: Date;
  deniedBy?: string;
  denialReason?: string;
  executedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * State transition event
 */
export interface StateTransitionEvent {
  fromState: PaymentRequestState;
  toState: PaymentRequestState;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Payment rail interface for pluggable payment backends
 */
export interface PaymentRail {
  execute(
    paymentRequest: PaymentRequest,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }>;
}

/**
 * Notification channel interface for pluggable notification backends
 */
export interface NotificationChannel {
  notifyPending(paymentRequest: PaymentRequest): Promise<void>;
  notifyApproved(
    paymentRequest: PaymentRequest,
    approvedBy: string,
  ): Promise<void>;
  notifyDenied(
    paymentRequest: PaymentRequest,
    deniedBy: string,
    reason?: string,
  ): Promise<void>;
  notifyExecuted(paymentRequest: PaymentRequest): Promise<void>;
  notifyFailed(
    paymentRequest: PaymentRequest,
    reason: string,
  ): Promise<void>;
}

/**
 * Represents an agent in the system
 */
export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents an owner who approves payments
 */
export interface Owner {
  id: string;
  name: string;
  email: string;
  telegramUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  paymentRequestId: string;
  action: string;
  actor: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
