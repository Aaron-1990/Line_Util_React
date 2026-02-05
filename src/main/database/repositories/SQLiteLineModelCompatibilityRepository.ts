// ============================================
// SQLITE REPOSITORY: LineModelCompatibility
// Implementation of ILineModelCompatibilityRepository
// Uses surrogate keys (IDs) for referential integrity
// Phase 7.5: Now uses canvas_object_compatibilities table
// (line_model_compatibilities is a VIEW for backward compatibility)
// ============================================

import Database from 'better-sqlite3';
import { ILineModelCompatibilityRepository } from '@domain/repositories';
import { LineModelCompatibility } from '@domain/entities';

// Table name - Phase 7.5: use actual table, not VIEW
const TABLE_NAME = 'canvas_object_compatibilities';

interface CompatibilityRow {
  id: string;
  canvas_object_id: string;  // Phase 7.5: renamed from line_id
  model_id: string;
  cycle_time: number;
  efficiency: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteLineModelCompatibilityRepository implements ILineModelCompatibilityRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: CompatibilityRow): LineModelCompatibility {
    return LineModelCompatibility.fromDatabase({
      id: row.id,
      lineId: row.canvas_object_id,  // Phase 7.5: map canvas_object_id to lineId
      modelId: row.model_id,
      cycleTime: row.cycle_time,
      efficiency: row.efficiency,
      priority: row.priority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async create(compatibility: LineModelCompatibility): Promise<void> {
    const data = compatibility.toJSON();

    this.db
      .prepare(`
        INSERT INTO ${TABLE_NAME}
        (id, canvas_object_id, model_id, cycle_time, efficiency, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.id,
        data.lineId,  // Maps to canvas_object_id
        data.modelId,
        data.cycleTime,
        data.efficiency,
        data.priority,
        data.createdAt.toISOString(),
        data.updatedAt.toISOString()
      );
  }

  async update(
    id: string,
    compatibility: Partial<{
      cycleTime: number;
      efficiency: number;
      priority: number;
    }>
  ): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (compatibility.cycleTime !== undefined) {
      updates.push('cycle_time = ?');
      values.push(compatibility.cycleTime);
    }
    if (compatibility.efficiency !== undefined) {
      updates.push('efficiency = ?');
      values.push(compatibility.efficiency);
    }
    if (compatibility.priority !== undefined) {
      updates.push('priority = ?');
      values.push(compatibility.priority);
    }

    if (updates.length === 0) return;

    values.push(id);

    this.db
      .prepare(`UPDATE ${TABLE_NAME} SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  async findById(id: string): Promise<LineModelCompatibility | null> {
    const row = this.db
      .prepare(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`)
      .get(id) as CompatibilityRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByLineAndModel(lineId: string, modelId: string): Promise<LineModelCompatibility | null> {
    const row = this.db
      .prepare(`SELECT * FROM ${TABLE_NAME} WHERE canvas_object_id = ? AND model_id = ?`)
      .get(lineId, modelId) as CompatibilityRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByLine(lineId: string): Promise<LineModelCompatibility[]> {
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE_NAME} WHERE canvas_object_id = ? ORDER BY priority`)
      .all(lineId) as CompatibilityRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByLineOrderedByPriority(lineId: string): Promise<LineModelCompatibility[]> {
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE_NAME} WHERE canvas_object_id = ? ORDER BY priority ASC`)
      .all(lineId) as CompatibilityRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByModel(modelId: string): Promise<LineModelCompatibility[]> {
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE_NAME} WHERE model_id = ? ORDER BY priority`)
      .all(modelId) as CompatibilityRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findAll(): Promise<LineModelCompatibility[]> {
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE_NAME} ORDER BY canvas_object_id, priority`)
      .all() as CompatibilityRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async delete(id: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM ${TABLE_NAME} WHERE id = ?`)
      .run(id);
  }

  async deleteByLine(lineId: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM ${TABLE_NAME} WHERE canvas_object_id = ?`)
      .run(lineId);
  }

  async deleteByModel(modelId: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM ${TABLE_NAME} WHERE model_id = ?`)
      .run(modelId);
  }

  async batchCreate(compatibilities: LineModelCompatibility[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT INTO ${TABLE_NAME}
      (id, canvas_object_id, model_id, cycle_time, efficiency, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((compatibilities: LineModelCompatibility[]) => {
      for (const compat of compatibilities) {
        const data = compat.toJSON();
        insert.run(
          data.id,
          data.lineId,  // Maps to canvas_object_id
          data.modelId,
          data.cycleTime,
          data.efficiency,
          data.priority,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
      }
    });

    insertMany(compatibilities);
  }

  async existsByLineAndModel(lineId: string, modelId: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT 1 FROM ${TABLE_NAME} WHERE canvas_object_id = ? AND model_id = ?`)
      .get(lineId, modelId);
    return row !== undefined;
  }

  async getAllLineIds(): Promise<string[]> {
    const rows = this.db
      .prepare(`SELECT DISTINCT canvas_object_id FROM ${TABLE_NAME} ORDER BY canvas_object_id`)
      .all() as { canvas_object_id: string }[];

    return rows.map(row => row.canvas_object_id);
  }

  async getAllModelIds(): Promise<string[]> {
    const rows = this.db
      .prepare(`SELECT DISTINCT model_id FROM ${TABLE_NAME} ORDER BY model_id`)
      .all() as { model_id: string }[];

    return rows.map(row => row.model_id);
  }
}
