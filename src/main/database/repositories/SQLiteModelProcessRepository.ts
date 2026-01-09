// ============================================
// SQLITE REPOSITORY: ModelProcess
// Implementacion de IModelProcessRepository
// ============================================

import Database from 'better-sqlite3';
import { IModelProcessRepository } from '@domain/repositories';
import { ModelProcess } from '@domain/entities';

interface ProcessRow {
  id: string;
  model_id: string;
  name: string;
  cycle_time: number;
  quantity_per_product: number;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteModelProcessRepository implements IModelProcessRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: ProcessRow): ModelProcess {
    return ModelProcess.fromDatabase({
      id: row.id,
      modelId: row.model_id,
      name: row.name,
      cycleTime: row.cycle_time,
      quantityPerProduct: row.quantity_per_product,
      sequence: row.sequence,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findAll(): Promise<ModelProcess[]> {
    const rows = this.db
      .prepare('SELECT * FROM model_processes ORDER BY model_id, sequence')
      .all() as ProcessRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<ModelProcess | null> {
    const row = this.db
      .prepare('SELECT * FROM model_processes WHERE id = ?')
      .get(id) as ProcessRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByModelId(modelId: string): Promise<ModelProcess[]> {
    const rows = this.db
      .prepare('SELECT * FROM model_processes WHERE model_id = ? ORDER BY sequence')
      .all(modelId) as ProcessRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async save(process: ModelProcess): Promise<void> {
    const data = process.toJSON();

    const existing = await this.findById(process.id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE model_processes 
          SET model_id = ?, name = ?, cycle_time = ?, quantity_per_product = ?, sequence = ?
          WHERE id = ?
        `)
        .run(
          data.modelId,
          data.name,
          data.cycleTime,
          data.quantityPerProduct,
          data.sequence,
          data.id
        );
    } else {
      this.db
        .prepare(`
          INSERT INTO model_processes 
          (id, model_id, name, cycle_time, quantity_per_product, sequence, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.id,
          data.modelId,
          data.name,
          data.cycleTime,
          data.quantityPerProduct,
          data.sequence,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM model_processes WHERE id = ?').run(id);
  }

  async deleteByModelId(modelId: string): Promise<void> {
    this.db.prepare('DELETE FROM model_processes WHERE model_id = ?').run(modelId);
  }
}
