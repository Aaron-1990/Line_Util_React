// ============================================
// DATABASE CONNECTION MANAGER
// Singleton pattern para conexion SQLite
// ============================================

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { DB_CONFIG } from '@shared/constants';
import { MigrationRunner } from './MigrationRunner';

class DatabaseConnection {
  private static instance: Database.Database | null = null;
  private static dbPath: string | null = null;

  private constructor() {}

  static getInstance(): Database.Database {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = DatabaseConnection.createConnection();
      DatabaseConnection.runMigrations();
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

    try {
      const migrationRunner = new MigrationRunner(db);
      migrationRunner.runPendingMigrations();
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

  /**
   * Configure pragmas for a database instance.
   * Should be called on any newly opened database.
   */
  static configurePragmas(db: Database.Database): void {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
  }

  /**
   * Replace the current database instance with a new one.
   * Used when opening a project file (.lop).
   * @param newDb New database instance
   */
  static replaceInstance(newDb: Database.Database): void {
    // Close old instance if exists
    if (DatabaseConnection.instance) {
      DatabaseConnection.instance.close();
    }

    // Configure pragmas for the new instance
    DatabaseConnection.configurePragmas(newDb);

    // Set new instance
    DatabaseConnection.instance = newDb;
    console.log('Database instance replaced');
  }
}

export default DatabaseConnection;
