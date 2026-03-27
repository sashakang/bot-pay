import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import postgres from 'postgres';
import Redis from 'ioredis';
import {
  ApprovalWorkflow,
  MockPaymentRail,
  MockNotificationChannel,
} from '@bot-pay/core';
import {
  PaymentRequestRepository,
  AgentRepository,
  OwnerRepository,
  AuditLogRepository,
} from './repositories.js';
import { registerRoutes } from './routes.js';
import { AuthenticationError, AuthorizationError } from '@bot-pay/core';

interface AppConfig {
  port: number;
  environment: string;
  jwtSecret: string;
  approvalTokenSecret: string;
  database: postgres.Sql;
  redis: Redis;
  allowedOrigins: string[];
}

/**
 * Create and configure Fastify app
 */
export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.allowedOrigins,
  });

  await fastify.register(jwt, {
    secret: config.jwtSecret,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const code = (error as any).code || 'INTERNAL_ERROR';

    fastify.log.error(error);

    return reply.status(statusCode).send({
      error: {
        code,
        message: error.message,
        statusCode,
      },
    });
  });

  // Authentication decorator
  fastify.decorate(
    'authenticate',
    async function (request: any, reply: any) {
      try {
        // Try JWT authentication (for agents)
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (token) {
          try {
            const decoded = await fastify.jwt.verify(token);
            const agentRepo = new AgentRepository(config.database);
            const agent = await agentRepo.findById((decoded as any).sub);

            if (!agent) {
              throw new AuthenticationError('Agent not found');
            }

            request.agent = agent;
            return;
          } catch {
            // Not a valid JWT, try other auth methods
          }
        }

        // Try API key authentication (for agents)
        const apiKey = request.headers['x-api-key'];
        if (apiKey) {
          const agentRepo = new AgentRepository(config.database);
          const agent = await agentRepo.findByApiKey(apiKey);

          if (!agent) {
            throw new AuthenticationError('Invalid API key');
          }

          request.agent = agent;
          return;
        }

        throw new AuthenticationError('No authentication provided');
      } catch (error) {
        if (error instanceof AuthenticationError) {
          throw error;
        }
        throw new AuthenticationError('Authentication failed');
      }
    },
  );

  // Setup repositories
  const paymentRequestRepo = new PaymentRequestRepository(config.database);
  const agentRepo = new AgentRepository(config.database);
  const ownerRepo = new OwnerRepository(config.database);
  const auditRepo = new AuditLogRepository(config.database);

  // Setup workflow with mock adapters
  const paymentRail = new MockPaymentRail();
  const notificationChannel = new MockNotificationChannel();
  const workflow = new ApprovalWorkflow(
    paymentRail,
    notificationChannel,
    config.approvalTokenSecret,
  );

  // Register routes
  registerRoutes(
    fastify,
    paymentRequestRepo,
    agentRepo,
    ownerRepo,
    auditRepo,
    workflow,
    config.approvalTokenSecret,
  );

  return fastify;
}
