// ============================================
// DATABASE MIGRATION RUNNER
// ============================================

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

export class MigrationRunner {
  private db: Database.Database;
  private migrationsDir: string;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private getExecutedMigrations(): Set<number> {
    const rows = this.db
      .prepare('SELECT version FROM migrations ORDER BY version')
      .all() as { version: number }[];

    return new Set(rows.map(row => row.version));
  }

  private getMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(`Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      // Exclude rollback and validation scripts
      .filter(f => !f.includes('_ROLLBACK') && !f.includes('_VALIDATION'));

    return files
      .map(file => {
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (!match || !match[1]) {
          console.warn(`Invalid migration file name: ${file}`);
          return null;
        }

        const version = parseInt(match[1], 10);
        const name = match[2];
        const sql = fs.readFileSync(path.join(this.migrationsDir, file), 'utf-8');

        return { version, name, sql };
      })
      .filter((m): m is Migration => m !== null)
      .sort((a, b) => a.version - b.version);
  }

  public runPendingMigrations(): void {
    const executed = this.getExecutedMigrations();
    const allMigrations = this.getMigrationFiles();
    const pending = allMigrations.filter(m => !executed.has(m.version));

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pending.length} pending migration(s)...`);

    for (const migration of pending) {
      console.log(`Executing migration ${migration.version}: ${migration.name}`);

      try {
        this.db.exec(migration.sql);

        this.db
          .prepare('INSERT INTO migrations (version, name) VALUES (?, ?)')
          .run(migration.version, migration.name);

        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  }
}
