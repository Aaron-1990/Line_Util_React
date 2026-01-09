// ============================================
// DATABASE SERVICE
// Helper methods para operaciones comunes
// ============================================

import Database from 'better-sqlite3';
import DatabaseConnection from './connection';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  getDb(): Database.Database {
    return this.db;
  }

  transaction<T>(callback: () => T): T {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.transaction(() => callback());
  }

  rowExists(table: string, conditions: Record<string, unknown>): boolean {
    const where = Object.keys(conditions)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `SELECT 1 FROM ${table} WHERE ${where} LIMIT 1`;
    const values = Object.values(conditions);

    const row = this.db.prepare(sql).get(...values);
    return row !== undefined;
  }

  getRowCount(table: string, conditions?: Record<string, unknown>): number {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const values: unknown[] = [];

    if (conditions) {
      const where = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${where}`;
      values.push(...Object.values(conditions));
    }

    const row = this.db.prepare(sql).get(...values) as { count: number };
    return row.count;
  }

  vacuum(): void {
    this.db.exec('VACUUM');
  }

  analyze(): void {
    this.db.exec('ANALYZE');
  }

  checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }
}
