import { initializeDatabase, runMigrations, closeDatabase } from './database.js';
import { createApp } from './app.js';
import Redis from 'ioredis';

const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://bot_pay_user:bot_pay_password@localhost:5432/bot_pay_db';
const REDIS_URL =
  process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const APPROVAL_TOKEN_SECRET =
  process.env.APPROVAL_TOKEN_SECRET ||
  'dev-approval-secret-change-in-production';
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
).split(',');

async function main() {
  try {
    // Initialize database
    console.log('Initializing database...');
    const database = await initializeDatabase(DATABASE_URL);

    // Run migrations
    console.log('Running migrations...');
    await runMigrations(database);

    // Initialize Redis
    console.log('Connecting to Redis...');
    const redis = new Redis(REDIS_URL);
    redis.on('ready', () => console.log('Redis connected'));
    redis.on('error', (err) => console.error('Redis error:', err));

    // Create app
    console.log('Creating Fastify app...');
    const app = await createApp({
      port: PORT,
      environment: NODE_ENV,
      jwtSecret: JWT_SECRET,
      approvalTokenSecret: APPROVAL_TOKEN_SECRET,
      database,
      redis,
      allowedOrigins: ALLOWED_ORIGINS,
    });

    // Start server
    console.log(`Starting server on port ${PORT}...`);
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`✓ Server running at http://localhost:${PORT}`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        await app.close();
        await closeDatabase();
        redis.disconnect();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
