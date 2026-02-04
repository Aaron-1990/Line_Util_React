// ============================================
// SQLITE REPOSITORY: Canvas Object Compatibility
// CRUD operations for canvas object model assignments
// Phase 7.5: Unified Object Properties
// ============================================

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  CanvasObjectCompatibility,
  CanvasObjectCompatibilityWithModel,
  CanvasObjectCompatibilityRow,
  CreateCanvasObjectCompatibilityInput,
  UpdateCanvasObjectCompatibilityInput,
} from '@shared/types/canvas-object';

export class SQLiteCanvasObjectCompatibilityRepository {
  constructor(private db: Database.Database) {}

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapRowToEntity(row: CanvasObjectCompatibilityRow): CanvasObjectCompatibility {
    return {
      id: row.id,
      canvasObjectId: row.canvas_object_id,
      modelId: row.model_id,
      cycleTime: row.cycle_time,
      efficiency: row.efficiency,
      priority: row.priority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToEntityWithModel(
    row: CanvasObjectCompatibilityRow & { model_name?: string; model_family?: string }
  ): CanvasObjectCompatibilityWithModel {
    return {
      ...this.mapRowToEntity(row),
      modelName: row.model_name ?? 'Unknown',
      modelFamily: row.model_family,
    };
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get all compatibilities for a canvas object
   */
  async findByCanvasObject(canvasObjectId: string): Promise<CanvasObjectCompatibilityWithModel[]> {
    const rows = this.db
      .prepare(`
        SELECT
          coc.*,
          m.name as model_name,
          m.family as model_family
        FROM canvas_object_compatibilities coc
        LEFT JOIN product_models_v2 m ON coc.model_id = m.id
        WHERE coc.canvas_object_id = ?
        ORDER BY coc.priority ASC
      `)
      .all(canvasObjectId) as (CanvasObjectCompatibilityRow & { model_name?: string; model_family?: string })[];

    return rows.map(row => this.mapRowToEntityWithModel(row));
  }

  /**
   * Get a single compatibility by ID
   */
  async findById(id: string): Promise<CanvasObjectCompatibility | null> {
    const row = this.db
      .prepare('SELECT * FROM canvas_object_compatibilities WHERE id = ?')
      .get(id) as CanvasObjectCompatibilityRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Get compatibility by canvas object and model
   */
  async findByCanvasObjectAndModel(
    canvasObjectId: string,
    modelId: string
  ): Promise<CanvasObjectCompatibility | null> {
    const row = this.db
      .prepare('SELECT * FROM canvas_object_compatibilities WHERE canvas_object_id = ? AND model_id = ?')
      .get(canvasObjectId, modelId) as CanvasObjectCompatibilityRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Check if a compatibility already exists
   */
  async existsByCanvasObjectAndModel(canvasObjectId: string, modelId: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 FROM canvas_object_compatibilities WHERE canvas_object_id = ? AND model_id = ?')
      .get(canvasObjectId, modelId);
    return row !== undefined;
  }

  /**
   * Get all compatibilities for a model (to find which objects can produce it)
   */
  async findByModel(modelId: string): Promise<CanvasObjectCompatibility[]> {
    const rows = this.db
      .prepare('SELECT * FROM canvas_object_compatibilities WHERE model_id = ? ORDER BY priority ASC')
      .all(modelId) as CanvasObjectCompatibilityRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new compatibility
   */
  async create(input: CreateCanvasObjectCompatibilityInput): Promise<CanvasObjectCompatibility> {
    const id = nanoid();
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO canvas_object_compatibilities (
          id, canvas_object_id, model_id, cycle_time, efficiency, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.canvasObjectId,
        input.modelId,
        input.cycleTime,
        input.efficiency,
        input.priority,
        now,
        now
      );

    // Force WAL checkpoint for persistence
    this.db.pragma('wal_checkpoint(PASSIVE)');

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to retrieve created compatibility');
    }

    return created;
  }

  /**
   * Update an existing compatibility
   */
  async update(id: string, input: UpdateCanvasObjectCompatibilityInput): Promise<CanvasObjectCompatibility> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Compatibility with id "${id}" not found`);
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.cycleTime !== undefined) {
      updates.push('cycle_time = ?');
      params.push(input.cycleTime);
    }
    if (input.efficiency !== undefined) {
      updates.push('efficiency = ?');
      params.push(input.efficiency);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }

    if (updates.length === 0) {
      return existing;
    }

    // Always update timestamp
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    this.db
      .prepare(`UPDATE canvas_object_compatibilities SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    // Force WAL checkpoint for persistence
    this.db.pragma('wal_checkpoint(PASSIVE)');

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated compatibility');
    }

    return updated;
  }

  /**
   * Delete a compatibility
   */
  async delete(id: string): Promise<void> {
    this.db
      .prepare('DELETE FROM canvas_object_compatibilities WHERE id = ?')
      .run(id);

    // Force WAL checkpoint for persistence
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }

  /**
   * Delete all compatibilities for a canvas object
   */
  async deleteByCanvasObject(canvasObjectId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM canvas_object_compatibilities WHERE canvas_object_id = ?')
      .run(canvasObjectId);

    // Force WAL checkpoint for persistence
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }

  /**
   * Copy compatibilities from a production line to a canvas object
   * Used when converting a production line to a canvas object
   */
  async copyFromLine(lineId: string, canvasObjectId: string): Promise<void> {
    const now = new Date().toISOString();

    // Copy all compatibilities from line_model_compatibilities to canvas_object_compatibilities
    this.db
      .prepare(`
        INSERT INTO canvas_object_compatibilities (
          id, canvas_object_id, model_id, cycle_time, efficiency, priority, created_at, updated_at
        )
        SELECT
          ?,  -- New ID will be generated for each row
          ?,  -- Target canvas object ID
          model_id,
          cycle_time,
          efficiency,
          priority,
          ?,
          ?
        FROM line_model_compatibilities
        WHERE line_id = ?
      `)
      .run(nanoid(), canvasObjectId, now, now, lineId);

    // Actually we need to insert row by row to generate unique IDs
    const lineCompats = this.db
      .prepare('SELECT * FROM line_model_compatibilities WHERE line_id = ?')
      .all(lineId) as Array<{
        model_id: string;
        cycle_time: number;
        efficiency: number;
        priority: number;
      }>;

    // Delete the incorrectly inserted row (if any)
    this.db
      .prepare('DELETE FROM canvas_object_compatibilities WHERE canvas_object_id = ?')
      .run(canvasObjectId);

    // Insert each compatibility with a unique ID
    const insertStmt = this.db.prepare(`
      INSERT INTO canvas_object_compatibilities (
        id, canvas_object_id, model_id, cycle_time, efficiency, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const compat of lineCompats) {
      insertStmt.run(
        nanoid(),
        canvasObjectId,
        compat.model_id,
        compat.cycle_time,
        compat.efficiency,
        compat.priority,
        now,
        now
      );
    }

    // Force WAL checkpoint for persistence
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }

  /**
   * Batch create compatibilities (for imports)
   */
  async batchCreate(compatibilities: CreateCanvasObjectCompatibilityInput[]): Promise<void> {
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT INTO canvas_object_compatibilities (
        id, canvas_object_id, model_id, cycle_time, efficiency, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: CreateCanvasObjectCompatibilityInput[]) => {
      for (const item of items) {
        insertStmt.run(
          nanoid(),
          item.canvasObjectId,
          item.modelId,
          item.cycleTime,
          item.efficiency,
          item.priority,
          now,
          now
        );
      }
    });

    insertMany(compatibilities);

    // Force WAL checkpoint for persistence
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }
}
