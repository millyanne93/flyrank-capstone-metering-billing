import { query, getPool, closePool } from './client';
import { log } from '../config';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  log('info', 'Running migrations...');
  
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  
  const executed = await query<{ name: string }>(
    'SELECT name FROM migrations ORDER BY id'
  );
  const executedNames = new Set(executed.map(row => row.name));
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  let executedCount = 0;
  
  for (const file of files) {
    if (executedNames.has(file)) {
      log('debug', ` Skipping ${file} (already executed)`);
      continue;
    }
    
    log('info', ` Executing ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await query(sql);
      await query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      executedCount++;
      log('info', ` ${file} executed successfully`);
    } catch (error: any) {
      log('error', `Failed to execute ${file}`, { error: error.message });
      throw error;
    }
  }
  
  log('info', ` ${executedCount} migration(s) executed`);
  await closePool();
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { runMigrations };
