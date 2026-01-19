// ============================================
// DATABASE CONNECTION MANAGER
// Singleton pattern para conexion SQLite
// ============================================

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DB_CONFIG } from '@shared/constants';
import { seedDatabase } from './seed-data';

class DatabaseConnection {
  private static instance: Database.Database | null = null;
  private static dbPath: string | null = null;

  private constructor() {}

  static getInstance(): Database.Database {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = DatabaseConnection.createConnection();
      DatabaseConnection.runMigrations();
      
      if (process.env.NODE_ENV === 'development') {
        seedDatabase(DatabaseConnection.instance);
      }
    }
    return DatabaseConnection.instance;
  }

  private static createConnection(): Database.Database {
    const userDataPath = app.getPath('userData');
    DatabaseConnection.dbPath = path.join(userDataPath, DB_CONFIG.FILE_NAME);

    console.log('Database path:', DatabaseConnection.dbPath);

    const db = new Database(DatabaseConnection.dbPath, {
      // verbose: Solo descomentar cuando debuggees queries SQL
      // verbose: console.log,
    });

    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    return db;
  }

  private static runMigrations(): void {
    const db = DatabaseConnection.instance;
    if (!db) return;

    // List of migration files in order
    const migrations = [
      '001_initial_schema.sql',
      '002_multi_sheet_import.sql',
      '003_product_volumes.sql',
    ];

    try {
      for (const migrationFile of migrations) {
        const migrationsPath = path.join(__dirname, 'migrations', migrationFile);

        // Check if migration file exists
        if (!fs.existsSync(migrationsPath)) {
          console.log(`Migration file not found, skipping: ${migrationFile}`);
          continue;
        }

        const migrationSQL = fs.readFileSync(migrationsPath, 'utf-8');
        db.exec(migrationSQL);
        console.log(`Migration completed: ${migrationFile}`);
      }
      console.log('All database migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw new Error('Failed to run database migrations');
    }
  }

  static close(): void {
    if (DatabaseConnection.instance) {
      DatabaseConnection.instance.close();
      DatabaseConnection.instance = null;
      console.log('Database connection closed');
    }
  }

  static getPath(): string | null {
    return DatabaseConnection.dbPath;
  }
}

export default DatabaseConnection;
