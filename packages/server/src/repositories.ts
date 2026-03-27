import postgres from 'postgres';
import {
  PaymentRequest,
  PaymentRequestState,
  Agent,
  Owner,
  AuditLogEntry,
} from '@bot-pay/core';

/**
 * Payment request repository
 */
export class PaymentRequestRepository {
  constructor(private db: postgres.Sql) {}

  async create(request: Omit<PaymentRequest, 'createdAt' | 'updatedAt'>) {
    const result = await this.db<PaymentRequest[]>`
      INSERT INTO payment_requests (
        id, agent_id, owner_id, amount, currency, description, recipient,
        state, approval_token, approval_token_expires_at, expires_at
      ) VALUES (
        ${request.id}, ${request.agentId}, ${request.ownerId},
        ${request.amount}, ${request.currency}, ${request.description},
        ${request.recipient || null}, ${request.state},
        ${request.approvalToken || null}, ${request.approvalTokenExpiresAt || null},
        ${request.expiresAt}
      )
      RETURNING *
    `;
    return result[0];
  }

  async findById(id: string): Promise<PaymentRequest | null> {
    const result = await this.db<PaymentRequest[]>`
      SELECT * FROM payment_requests WHERE id = ${id}
    `;
    return result[0] || null;
  }

  async findByAgentId(
    agentId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaymentRequest[]> {
    return this.db<PaymentRequest[]>`
      SELECT * FROM payment_requests
      WHERE agent_id = ${agentId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async findByOwnerId(
    ownerId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaymentRequest[]> {
    return this.db<PaymentRequest[]>`
      SELECT * FROM payment_requests
      WHERE owner_id = ${ownerId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async update(request: PaymentRequest): Promise<PaymentRequest | null> {
    const result = await this.db<PaymentRequest[]>`
      UPDATE payment_requests SET
        state = ${request.state},
        approval_token = ${request.approvalToken || null},
        approval_token_expires_at = ${request.approvalTokenExpiresAt || null},
        approved_at = ${request.approvedAt || null},
        approved_by = ${request.approvedBy || null},
        denied_at = ${request.deniedAt || null},
        denied_by = ${request.deniedBy || null},
        denial_reason = ${request.denialReason || null},
        executed_at = ${request.executedAt || null},
        failed_at = ${request.failedAt || null},
        failure_reason = ${request.failureReason || null},
        updated_at = NOW()
      WHERE id = ${request.id}
      RETURNING *
    `;
    return result[0] || null;
  }

  async findExpiredPending(): Promise<PaymentRequest[]> {
    return this.db<PaymentRequest[]>`
      SELECT * FROM payment_requests
      WHERE state = ${PaymentRequestState.PENDING}
      AND expires_at < NOW()
    `;
  }
}

/**
 * Agent repository
 */
export class AgentRepository {
  constructor(private db: postgres.Sql) {}

  async create(agent: Omit<Agent, 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const result = await this.db<Agent[]>`
      INSERT INTO agents (id, name, api_key, owner_id)
      VALUES (${agent.id}, ${agent.name}, ${agent.apiKey}, ${agent.ownerId})
      RETURNING *
    `;
    return result[0];
  }

  async findById(id: string): Promise<Agent | null> {
    const result = await this.db<Agent[]>`
      SELECT * FROM agents WHERE id = ${id}
    `;
    return result[0] || null;
  }

  async findByApiKey(apiKey: string): Promise<Agent | null> {
    const result = await this.db<Agent[]>`
      SELECT * FROM agents WHERE api_key = ${apiKey}
    `;
    return result[0] || null;
  }

  async findByOwnerId(ownerId: string): Promise<Agent[]> {
    return this.db<Agent[]>`
      SELECT * FROM agents WHERE owner_id = ${ownerId}
    `;
  }
}

/**
 * Owner repository
 */
export class OwnerRepository {
  constructor(private db: postgres.Sql) {}

  async create(owner: Omit<Owner, 'createdAt' | 'updatedAt'>): Promise<Owner> {
    const result = await this.db<Owner[]>`
      INSERT INTO owners (id, name, email, telegram_user_id)
      VALUES (${owner.id}, ${owner.name}, ${owner.email}, ${owner.telegramUserId || null})
      RETURNING *
    `;
    return result[0];
  }

  async findById(id: string): Promise<Owner | null> {
    const result = await this.db<Owner[]>`
      SELECT * FROM owners WHERE id = ${id}
    `;
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<Owner | null> {
    const result = await this.db<Owner[]>`
      SELECT * FROM owners WHERE email = ${email}
    `;
    return result[0] || null;
  }

  async findByTelegramUserId(telegramUserId: number): Promise<Owner | null> {
    const result = await this.db<Owner[]>`
      SELECT * FROM owners WHERE telegram_user_id = ${telegramUserId}
    `;
    return result[0] || null;
  }

  async update(owner: Owner): Promise<Owner | null> {
    const result = await this.db<Owner[]>`
      UPDATE owners SET
        name = ${owner.name},
        email = ${owner.email},
        telegram_user_id = ${owner.telegramUserId || null},
        updated_at = NOW()
      WHERE id = ${owner.id}
      RETURNING *
    `;
    return result[0] || null;
  }
}

/**
 * Audit log repository
 */
export class AuditLogRepository {
  constructor(private db: postgres.Sql) {}

  async create(
    log: Omit<AuditLogEntry, 'id' | 'createdAt'>,
  ): Promise<AuditLogEntry> {
    const result = await this.db<AuditLogEntry[]>`
      INSERT INTO audit_logs (payment_request_id, action, actor, metadata)
      VALUES (${log.paymentRequestId}, ${log.action}, ${log.actor || null}, ${JSON.stringify(log.metadata || {})})
      RETURNING *
    `;
    return result[0];
  }

  async findByPaymentRequestId(
    paymentRequestId: string,
  ): Promise<AuditLogEntry[]> {
    return this.db<AuditLogEntry[]>`
      SELECT * FROM audit_logs
      WHERE payment_request_id = ${paymentRequestId}
      ORDER BY created_at ASC
    `;
  }
}
