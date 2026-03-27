import postgres from 'postgres';

let dbInstance: postgres.Sql | null = null;

/**
 * Initialize database connection
 */
export async function initializeDatabase(
  connectionString: string,
): Promise<postgres.Sql> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = postgres(connectionString, {
    max: 20,
    idle_timeout: 30,
  });

  return dbInstance;
}

/**
 * Get database instance
 */
export function getDatabase(): postgres.Sql {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.end();
    dbInstance = null;
  }
}

/**
 * Run migrations
 */
export async function runMigrations(db: postgres.Sql): Promise<void> {
  // Create migration tracking table
  await db`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  const migrations = [
    {
      name: '001_initial_schema',
      sql: `
        CREATE TABLE IF NOT EXISTS owners (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          telegram_user_id BIGINT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          api_key VARCHAR(255) NOT NULL UNIQUE,
          owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payment_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
          amount DECIMAL(19, 4) NOT NULL,
          currency VARCHAR(3) NOT NULL,
          description TEXT NOT NULL,
          recipient VARCHAR(255),
          state VARCHAR(50) NOT NULL DEFAULT 'pending',
          approval_token VARCHAR(255),
          approval_token_expires_at TIMESTAMP,
          approved_at TIMESTAMP,
          approved_by UUID REFERENCES owners(id),
          denied_at TIMESTAMP,
          denied_by UUID REFERENCES owners(id),
          denial_reason TEXT,
          executed_at TIMESTAMP,
          failed_at TIMESTAMP,
          failure_reason TEXT,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          actor UUID,
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id);
        CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
        CREATE INDEX IF NOT EXISTS idx_payment_requests_agent_id ON payment_requests(agent_id);
        CREATE INDEX IF NOT EXISTS idx_payment_requests_owner_id ON payment_requests(owner_id);
        CREATE INDEX IF NOT EXISTS idx_payment_requests_state ON payment_requests(state);
        CREATE INDEX IF NOT EXISTS idx_payment_requests_expires_at ON payment_requests(expires_at);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_payment_request_id ON audit_logs(payment_request_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      `,
    },
  ];

  for (const migration of migrations) {
    const existing = await db`
      SELECT * FROM migrations WHERE name = ${migration.name}
    `;

    if (existing.length === 0) {
      console.log(`Running migration: ${migration.name}`);
      await db.unsafe(migration.sql);
      await db`INSERT INTO migrations (name) VALUES (${migration.name})`;
    }
  }
}
