import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import {
  PaymentRequest,
  PaymentRequestState,
  ApprovalWorkflow,
  generateApprovalToken,
  AuthenticationError,
  AuthorizationError,
  PaymentRequestNotFoundError,
  InvalidPaymentRequestStateError,
} from '@bot-pay/core';
import {
  PaymentRequestRepository,
  AgentRepository,
  OwnerRepository,
  AuditLogRepository,
} from './repositories.js';

interface CreatePaymentRequestBody {
  amount: number;
  currency: string;
  description: string;
  recipient?: string;
  idempotencyKey?: string;
}

interface ApprovePaymentBody {
  token: string;
}

interface DenyPaymentBody {
  reason?: string;
}

/**
 * Register API routes
 */
export function registerRoutes(
  fastify: FastifyInstance,
  paymentRepo: PaymentRequestRepository,
  agentRepo: AgentRepository,
  ownerRepo: OwnerRepository,
  auditRepo: AuditLogRepository,
  workflow: ApprovalWorkflow,
  approvalTokenSecret: string,
): void {
  /**
   * POST /api/payment-requests
   * Agent creates a payment request
   */
  fastify.post<{ Body: CreatePaymentRequestBody }>(
    '/api/payment-requests',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const agent = request.agent as any;
      const { amount, currency, description, recipient } = request.body;

      const paymentRequestId = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const approvalTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const approvalToken = generateApprovalToken(
        paymentRequestId,
        approvalTokenSecret,
      );

      const paymentRequest: Omit<
        PaymentRequest,
        'createdAt' | 'updatedAt'
      > = {
        id: paymentRequestId,
        agentId: agent.id,
        ownerId: agent.ownerId,
        amount,
        currency,
        description,
        recipient,
        state: PaymentRequestState.PENDING,
        approvalToken,
        approvalTokenExpiresAt,
        expiresAt,
      };

      const created = await paymentRepo.create(paymentRequest);

      // Log audit entry
      await auditRepo.create({
        paymentRequestId: created.id,
        action: 'CREATED',
        actor: agent.id,
      });

      // Send notification
      await workflow.onPaymentRequestCreated(created);

      return reply.status(201).send({
        id: created.id,
        status: created.state,
        amount: created.amount,
        currency: created.currency,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
      });
    },
  );

  /**
   * GET /api/payment-requests/:id
   * Poll payment request status
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/payment-requests/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const agent = request.agent as any;

      const paymentRequest = await paymentRepo.findById(id);
      if (!paymentRequest) {
        throw new PaymentRequestNotFoundError(id);
      }

      // Verify agent owns this request
      if (paymentRequest.agentId !== agent.id) {
        throw new AuthorizationError(
          'You do not own this payment request',
        );
      }

      return reply.send({
        id: paymentRequest.id,
        status: paymentRequest.state,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        description: paymentRequest.description,
        approvedAt: paymentRequest.approvedAt,
        deniedAt: paymentRequest.deniedAt,
        executedAt: paymentRequest.executedAt,
        failedAt: paymentRequest.failedAt,
        failureReason: paymentRequest.failureReason,
        createdAt: paymentRequest.createdAt,
      });
    },
  );

  /**
   * GET /api/payment-requests
   * List payment requests for agent
   */
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/payment-requests',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const agent = request.agent as any;
      const limit = Math.min(parseInt(request.query.limit || '50'), 100);
      const offset = parseInt(request.query.offset || '0');

      const requests = await paymentRepo.findByAgentId(
        agent.id,
        limit,
        offset,
      );

      return reply.send({
        requests: requests.map((r) => ({
          id: r.id,
          status: r.state,
          amount: r.amount,
          currency: r.currency,
          description: r.description,
          createdAt: r.createdAt,
        })),
        limit,
        offset,
      });
    },
  );

  /**
   * POST /api/payment-requests/:id/approve
   * Owner approves a payment request
   */
  fastify.post<{
    Params: { id: string };
    Body: ApprovePaymentBody;
  }>(
    '/api/payment-requests/:id/approve',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { token } = request.body;
      const owner = request.owner as any;

      if (!owner) {
        throw new AuthenticationError(
          'Owner authentication required',
        );
      }

      const paymentRequest = await paymentRepo.findById(id);
      if (!paymentRequest) {
        throw new PaymentRequestNotFoundError(id);
      }

      if (!paymentRequest.canBeApproved()) {
        throw new InvalidPaymentRequestStateError(
          id,
          paymentRequest.state,
          'approve',
        );
      }

      const approved = await workflow.onPaymentApproved(
        paymentRequest,
        token,
        owner.id,
      );

      await paymentRepo.update(approved);

      // Log audit entry
      await auditRepo.create({
        paymentRequestId: id,
        action: 'APPROVED',
        actor: owner.id,
      });

      return reply.send({
        id: approved.id,
        status: approved.state,
        approvedAt: approved.approvedAt,
      });
    },
  );

  /**
   * POST /api/payment-requests/:id/deny
   * Owner denies a payment request
   */
  fastify.post<{
    Params: { id: string };
    Body: DenyPaymentBody;
  }>(
    '/api/payment-requests/:id/deny',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body;
      const owner = request.owner as any;

      if (!owner) {
        throw new AuthenticationError(
          'Owner authentication required',
        );
      }

      const paymentRequest = await paymentRepo.findById(id);
      if (!paymentRequest) {
        throw new PaymentRequestNotFoundError(id);
      }

      if (!paymentRequest.canBeDenied()) {
        throw new InvalidPaymentRequestStateError(
          id,
          paymentRequest.state,
          'deny',
        );
      }

      const denied = await workflow.onPaymentDenied(
        paymentRequest,
        owner.id,
        reason,
      );

      await paymentRepo.update(denied);

      // Log audit entry
      await auditRepo.create({
        paymentRequestId: id,
        action: 'DENIED',
        actor: owner.id,
        metadata: { reason },
      });

      return reply.send({
        id: denied.id,
        status: denied.state,
        deniedAt: denied.deniedAt,
        reason: denied.denialReason,
      });
    },
  );

  /**
   * POST /api/internal/payment-requests/:id/execute
   * Internal endpoint to execute an approved payment
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/internal/payment-requests/:id/execute',
    async (request, reply) => {
      const { id } = request.params;

      const paymentRequest = await paymentRepo.findById(id);
      if (!paymentRequest) {
        throw new PaymentRequestNotFoundError(id);
      }

      if (paymentRequest.state !== PaymentRequestState.APPROVED) {
        throw new InvalidPaymentRequestStateError(
          id,
          paymentRequest.state,
          'execute',
        );
      }

      const executed = await workflow.executePayment(paymentRequest);
      await paymentRepo.update(executed);

      // Log audit entry
      await auditRepo.create({
        paymentRequestId: id,
        action: 'EXECUTED',
        metadata: { transactionId: executed.executedAt },
      });

      return reply.send({
        id: executed.id,
        status: executed.state,
      });
    },
  );

  /**
   * GET /api/health
   * Health check endpoint
   */
  fastify.get('/api/health', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
