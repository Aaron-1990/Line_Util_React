// ============================================
// SQLITE REPOSITORY: ProductionVolume
// Implementacion de IProductionVolumeRepository
// ============================================

import Database from 'better-sqlite3';
import { IProductionVolumeRepository } from '@domain/repositories';
import { ProductionVolume } from '@domain/entities';

interface VolumeRow {
  id: string;
  family: string;
  days_of_operation: number;
  year: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteProductionVolumeRepository implements IProductionVolumeRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: VolumeRow): ProductionVolume {
    return ProductionVolume.fromDatabase({
      id: row.id,
      family: row.family,
      daysOfOperation: row.days_of_operation,
      year: row.year,
      quantity: row.quantity,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findAll(): Promise<ProductionVolume[]> {
    const rows = this.db
      .prepare('SELECT * FROM production_volumes ORDER BY year DESC, family')
      .all() as VolumeRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<ProductionVolume | null> {
    const row = this.db
      .prepare('SELECT * FROM production_volumes WHERE id = ?')
      .get(id) as VolumeRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByYear(year: number): Promise<ProductionVolume[]> {
    const rows = this.db
      .prepare('SELECT * FROM production_volumes WHERE year = ? ORDER BY family')
      .all(year) as VolumeRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByFamily(family: string): Promise<ProductionVolume[]> {
    const rows = this.db
      .prepare('SELECT * FROM production_volumes WHERE family = ? ORDER BY year DESC')
      .all(family) as VolumeRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByFamilyAndYear(family: string, year: number): Promise<ProductionVolume | null> {
    const row = this.db
      .prepare('SELECT * FROM production_volumes WHERE family = ? AND year = ?')
      .get(family, year) as VolumeRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async save(volume: ProductionVolume): Promise<void> {
    const data = volume.toJSON();

    const existing = await this.findById(volume.id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE production_volumes 
          SET family = ?, days_of_operation = ?, year = ?, quantity = ?
          WHERE id = ?
        `)
        .run(data.family, data.daysOfOperation, data.year, data.quantity, data.id);
    } else {
      this.db
        .prepare(`
          INSERT INTO production_volumes 
          (id, family, days_of_operation, year, quantity, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.id,
          data.family,
          data.daysOfOperation,
          data.year,
          data.quantity,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM production_volumes WHERE id = ?').run(id);
  }

  async existsByFamilyAndYear(
    family: string,
    year: number,
    excludeId?: string
  ): Promise<boolean> {
    let sql = 'SELECT 1 FROM production_volumes WHERE family = ? AND year = ?';
    const params: unknown[] = [family, year];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(sql).get(...params);
    return row !== undefined;
  }
}
