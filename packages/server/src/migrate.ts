import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const sql = postgres(databaseUrl);
  const migrationsDir = join(__dirname, '../migrations');

  try {
    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await sql`
        SELECT id FROM migrations WHERE filename = ${file}
      `;

      if (existing.length > 0) {
        console.log(`Skipping migration (already applied): ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      await sql.unsafe(content);
      await sql`INSERT INTO migrations (filename) VALUES (${file})`;
      console.log(`✅ Applied: ${file}`);
    }

    console.log('All migrations complete.');
  } finally {
    await sql.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
