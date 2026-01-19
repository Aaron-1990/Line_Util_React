// ============================================
// SQLITE REPOSITORY: ProductVolume
// Implementation of IProductVolumeRepository
// Supports multi-year volume queries
// ============================================

import Database from 'better-sqlite3';
import { IProductVolumeRepository } from '@domain/repositories';
import { ProductVolume } from '@domain/entities';

interface VolumeRow {
  id: string;
  model_id: string;
  year: number;
  volume: number;
  operations_days: number;
  created_at: string;
  updated_at: string;
}

interface YearSummaryRow {
  year: number;
  model_count: number;
  total_volume: number;
  avg_operations_days: number;
}

export class SQLiteProductVolumeRepository implements IProductVolumeRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: VolumeRow): ProductVolume {
    return ProductVolume.fromDatabase({
      id: row.id,
      modelId: row.model_id,
      year: row.year,
      volume: row.volume,
      operationsDays: row.operations_days,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async create(volume: ProductVolume): Promise<void> {
    const data = volume.toJSON();

    this.db
      .prepare(`
        INSERT INTO product_volumes
        (id, model_id, year, volume, operations_days, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.id,
        data.modelId,
        data.year,
        data.volume,
        data.operationsDays,
        data.createdAt.toISOString(),
        data.updatedAt.toISOString()
      );
  }

  async update(
    id: string,
    data: Partial<{
      volume: number;
      operationsDays: number;
    }>
  ): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.volume !== undefined) {
      updates.push('volume = ?');
      values.push(data.volume);
    }
    if (data.operationsDays !== undefined) {
      updates.push('operations_days = ?');
      values.push(data.operationsDays);
    }

    if (updates.length === 0) return;

    values.push(id);

    this.db
      .prepare(`UPDATE product_volumes SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  async findById(id: string): Promise<ProductVolume | null> {
    const row = this.db
      .prepare('SELECT * FROM product_volumes WHERE id = ?')
      .get(id) as VolumeRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByModel(modelId: string): Promise<ProductVolume[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_volumes WHERE model_id = ? ORDER BY year')
      .all(modelId) as VolumeRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByYear(year: number): Promise<ProductVolume[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_volumes WHERE year = ? ORDER BY model_id')
      .all(year) as VolumeRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByModelAndYear(modelId: string, year: number): Promise<ProductVolume | null> {
    const row = this.db
      .prepare('SELECT * FROM product_volumes WHERE model_id = ? AND year = ?')
      .get(modelId, year) as VolumeRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findAll(): Promise<ProductVolume[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_volumes ORDER BY year, model_id')
      .all() as VolumeRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async getAvailableYears(): Promise<number[]> {
    const rows = this.db
      .prepare('SELECT DISTINCT year FROM product_volumes ORDER BY year')
      .all() as { year: number }[];

    return rows.map(row => row.year);
  }

  async getYearRange(): Promise<{ min: number; max: number } | null> {
    const row = this.db
      .prepare('SELECT MIN(year) as min_year, MAX(year) as max_year FROM product_volumes')
      .get() as { min_year: number | null; max_year: number | null } | undefined;

    if (!row || row.min_year === null || row.max_year === null) {
      return null;
    }

    return { min: row.min_year, max: row.max_year };
  }

  async delete(id: string): Promise<void> {
    this.db
      .prepare('DELETE FROM product_volumes WHERE id = ?')
      .run(id);
  }

  async deleteByModel(modelId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM product_volumes WHERE model_id = ?')
      .run(modelId);
  }

  async deleteByYear(year: number): Promise<void> {
    this.db
      .prepare('DELETE FROM product_volumes WHERE year = ?')
      .run(year);
  }

  async batchCreate(volumes: ProductVolume[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT INTO product_volumes
      (id, model_id, year, volume, operations_days, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((volumes: ProductVolume[]) => {
      for (const vol of volumes) {
        const data = vol.toJSON();
        insert.run(
          data.id,
          data.modelId,
          data.year,
          data.volume,
          data.operationsDays,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
      }
    });

    insertMany(volumes);
  }

  async existsByModelAndYear(modelId: string, year: number): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 FROM product_volumes WHERE model_id = ? AND year = ?')
      .get(modelId, year);
    return row !== undefined;
  }

  async getYearSummary(): Promise<Array<{
    year: number;
    modelCount: number;
    totalVolume: number;
    avgOperationsDays: number;
  }>> {
    const rows = this.db
      .prepare(`
        SELECT
          year,
          COUNT(DISTINCT model_id) as model_count,
          SUM(volume) as total_volume,
          AVG(operations_days) as avg_operations_days
        FROM product_volumes
        GROUP BY year
        ORDER BY year
      `)
      .all() as YearSummaryRow[];

    return rows.map(row => ({
      year: row.year,
      modelCount: row.model_count,
      totalVolume: row.total_volume,
      avgOperationsDays: row.avg_operations_days,
    }));
  }
}
