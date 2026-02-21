// ============================================
// SQLITE REPOSITORY: ProductionLine
// Implementacion de IProductionLineRepository
// Phase 7.5: production_lines is now a VIEW over canvas_objects + process_properties
// Reads use the VIEW, writes go to the underlying tables
// ============================================

import Database from 'better-sqlite3';
import { IProductionLineRepository } from '@domain/repositories';
import { ProductionLine } from '@domain/entities';

interface LineRow {
  id: string;
  name: string;
  area: string;
  line_type: 'shared' | 'dedicated' | null;
  time_available_daily: number;
  active: number;
  x_position: number;
  y_position: number;
  changeover_enabled: number | null;  // Phase 5.6
  changeover_explicit: number | null; // Phase 5.6.1: True if user explicitly set toggle
  plant_id: string | null;            // Phase 7: Multi-plant support
  created_at: string;
  updated_at: string;
}

export class SQLiteProductionLineRepository implements IProductionLineRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: LineRow): ProductionLine {
    return ProductionLine.fromDatabase({
      id: row.id,
      name: row.name,
      area: row.area,
      lineType: row.line_type ?? 'shared',
      timeAvailableDaily: row.time_available_daily,
      active: Boolean(row.active),
      xPosition: row.x_position,
      yPosition: row.y_position,
      changeoverEnabled: row.changeover_enabled !== 0,  // Phase 5.6: default true if null
      changeoverExplicit: row.changeover_explicit === 1, // Phase 5.6.1: default false
      plantId: row.plant_id ?? undefined,  // Phase 7: Multi-plant support
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findAll(): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.active = 1 AND co.object_type = 'process'
        ORDER BY co.name
      `)
      .all() as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<ProductionLine | null> {
    const row = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.id = ? AND co.object_type = 'process'
      `)
      .get(id) as LineRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByArea(area: string): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE pp.area = ? AND co.active = 1 AND co.object_type = 'process'
        ORDER BY co.name
      `)
      .all(area) as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.active = 1 AND co.object_type = 'process'
        ORDER BY co.name
      `)
      .all() as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async save(line: ProductionLine): Promise<void> {
    const data = line.toJSON();
    const now = new Date().toISOString();

    const existing = await this.findById(line.id);

    if (existing) {
      // Phase 7.5: Update underlying tables (not the VIEW)
      // Update canvas_objects
      this.db
        .prepare(`
          UPDATE canvas_objects
          SET name = ?, active = ?, x_position = ?, y_position = ?,
              plant_id = COALESCE(?, plant_id), updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.name,
          data.active ? 1 : 0,
          data.xPosition,
          data.yPosition,
          data.plantId ?? null,
          now,
          data.id
        );

      // Update process_properties
      this.db
        .prepare(`
          UPDATE process_properties
          SET area = ?, line_type = ?, time_available_daily = ?, updated_at = ?
          WHERE canvas_object_id = ?
        `)
        .run(
          data.area,
          data.lineType,
          data.timeAvailableDaily,
          now,
          data.id
        );
    } else {
      // Phase 7.5: Insert into underlying tables (not the VIEW)
      const { nanoid } = require('nanoid');
      const ppId = nanoid();

      // Insert into canvas_objects
      this.db
        .prepare(`
          INSERT INTO canvas_objects
          (id, plant_id, shape_id, object_type, name, description, x_position, y_position,
           width, height, rotation, z_index, locked, active, created_at, updated_at)
          VALUES (?, ?, 'rect-basic', 'process', ?, '', ?, ?, 180, 80, 0, 1, 0, ?, ?, ?)
        `)
        .run(
          data.id,
          data.plantId ?? null,
          data.name,
          data.xPosition,
          data.yPosition,
          data.active ? 1 : 0,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );

      // Insert into process_properties
      this.db
        .prepare(`
          INSERT INTO process_properties
          (id, canvas_object_id, area, line_type, time_available_daily,
           changeover_enabled, changeover_explicit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
        `)
        .run(
          ppId,
          data.id,
          data.area,
          data.lineType,
          data.timeAvailableDaily,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
    }
  }

  async delete(id: string): Promise<void> {
    // Phase 7.5: Soft delete in canvas_objects (underlying table)
    const result = this.db
      .prepare('UPDATE canvas_objects SET active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    if (result.changes === 0) {
      throw new Error(`Failed to delete production line ${id} - no rows updated`);
    }

    // Force WAL checkpoint to ensure persistence across app restarts
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    let sql = `
      SELECT 1 FROM canvas_objects co
      WHERE co.name = ? AND co.active = 1 AND co.object_type = 'process'
    `;
    const params: unknown[] = [name];

    if (excludeId) {
      sql += ' AND co.id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(sql).get(...params);
    return row !== undefined;
  }

  async findByName(name: string): Promise<ProductionLine | null> {
    const row = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.name = ? AND co.active = 1 AND co.object_type = 'process'
      `)
      .get(name) as LineRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async updatePosition(id: string, x: number, y: number): Promise<void> {
    // Phase 7.5: Update position in canvas_objects (underlying table)
    this.db
      .prepare('UPDATE canvas_objects SET x_position = ?, y_position = ? WHERE id = ?')
      .run(x, y, id);
  }

  /**
   * Phase 5.6: Update changeover toggle for a specific line
   * Phase 5.6.1: Also marks the toggle as explicitly set by user
   * Phase 7.5: Updates process_properties (underlying table)
   */
  async updateChangeoverEnabled(id: string, enabled: boolean): Promise<void> {
    this.db
      .prepare('UPDATE process_properties SET changeover_enabled = ?, changeover_explicit = 1 WHERE canvas_object_id = ?')
      .run(enabled ? 1 : 0, id);
  }

  /**
   * Phase 5.6: Get all lines with their changeover toggle states
   * Phase 5.6.1: Also returns explicit flag for true override logic
   */
  async getChangeoverToggles(): Promise<{ [lineId: string]: { enabled: boolean; explicit: boolean } }> {
    const rows = this.db
      .prepare(`
        SELECT co.id, pp.changeover_enabled, pp.changeover_explicit
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.active = 1 AND co.object_type = 'process'
      `)
      .all() as { id: string; changeover_enabled: number | null; changeover_explicit: number | null }[];

    const toggles: { [lineId: string]: { enabled: boolean; explicit: boolean } } = {};
    for (const row of rows) {
      toggles[row.id] = {
        enabled: row.changeover_enabled !== 0,  // default true if null
        explicit: row.changeover_explicit === 1, // default false if null
      };
    }
    return toggles;
  }

  /**
   * Phase 5.6.3: Reset all changeover toggles to a specific state
   * Clears explicit flag (so lines follow global again)
   * Phase 7.5: Updates process_properties via join with canvas_objects
   * @param enabled - Target state for all lines (true = ON, false = OFF)
   */
  async resetAllChangeoverToggles(enabled: boolean = true): Promise<number> {
    const result = this.db
      .prepare(`
        UPDATE process_properties
        SET changeover_enabled = ?, changeover_explicit = 0
        WHERE canvas_object_id IN (
          SELECT id FROM canvas_objects WHERE active = 1 AND object_type = 'process'
        )
      `)
      .run(enabled ? 1 : 0);
    return result.changes;
  }

  /**
   * Phase 5.6.3: Set changeover enabled for non-sticky lines only
   * Lines with changeover_explicit = 1 (sticky) are NOT affected
   * Phase 7.5: Updates process_properties via join with canvas_objects
   */
  async setAllChangeoverEnabled(enabled: boolean): Promise<number> {
    const result = this.db
      .prepare(`
        UPDATE process_properties
        SET changeover_enabled = ?
        WHERE canvas_object_id IN (
          SELECT id FROM canvas_objects WHERE active = 1 AND object_type = 'process'
        )
        AND (changeover_explicit = 0 OR changeover_explicit IS NULL)
      `)
      .run(enabled ? 1 : 0);
    return result.changes;
  }

  // ============================================
  // PHASE 7: MULTI-PLANT METHODS
  // ============================================

  /**
   * Phase 7: Get all active lines for a specific plant
   */
  async findActiveByPlant(plantId: string): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.active = 1 AND co.plant_id = ? AND co.object_type = 'process'
        ORDER BY co.name
      `)
      .all(plantId) as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Phase 7: Get all active lines for a specific plant
   */
  async findAllByPlant(plantId: string): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.plant_id = ? AND co.active = 1 AND co.object_type = 'process'
        ORDER BY co.name
      `)
      .all(plantId) as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Phase 7: Get lines by area within a specific plant
   */
  async findByAreaAndPlant(area: string, plantId: string): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE pp.area = ? AND co.plant_id = ? AND co.active = 1 AND co.object_type = 'process'
        ORDER BY co.name
      `)
      .all(area, plantId) as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Phase 7: Check if name exists within a plant (for validation)
   */
  async existsByNameInPlant(name: string, plantId: string, excludeId?: string): Promise<boolean> {
    let sql = `
      SELECT 1 FROM canvas_objects co
      WHERE co.name = ? AND co.plant_id = ? AND co.active = 1 AND co.object_type = 'process'
    `;
    const params: unknown[] = [name, plantId];

    if (excludeId) {
      sql += ' AND co.id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(sql).get(...params);
    return row !== undefined;
  }

  /**
   * Phase 7: Find line by name within a specific plant
   */
  async findByNameInPlant(name: string, plantId: string): Promise<ProductionLine | null> {
    const row = this.db
      .prepare(`
        SELECT co.id, co.plant_id, co.name, pp.area, pp.line_type,
               pp.time_available_daily, co.x_position, co.y_position,
               pp.changeover_enabled, pp.changeover_explicit,
               co.active, co.created_at, co.updated_at
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.name = ? AND co.plant_id = ? AND co.active = 1 AND co.object_type = 'process'
      `)
      .get(name, plantId) as LineRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Phase 7: Get changeover toggles for a specific plant
   */
  async getChangeoverTogglesByPlant(plantId: string): Promise<{ [lineId: string]: { enabled: boolean; explicit: boolean } }> {
    const rows = this.db
      .prepare(`
        SELECT co.id, pp.changeover_enabled, pp.changeover_explicit
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.active = 1 AND co.plant_id = ? AND co.object_type = 'process'
      `)
      .all(plantId) as { id: string; changeover_enabled: number | null; changeover_explicit: number | null }[];

    const toggles: { [lineId: string]: { enabled: boolean; explicit: boolean } } = {};
    for (const row of rows) {
      toggles[row.id] = {
        enabled: row.changeover_enabled !== 0,
        explicit: row.changeover_explicit === 1,
      };
    }
    return toggles;
  }

  /**
   * Phase 7: Reset changeover toggles for a specific plant
   * Phase 7.5: Updates process_properties via join with canvas_objects
   */
  async resetAllChangeoverTogglesByPlant(plantId: string, enabled: boolean = true): Promise<number> {
    const result = this.db
      .prepare(`
        UPDATE process_properties
        SET changeover_enabled = ?, changeover_explicit = 0
        WHERE canvas_object_id IN (
          SELECT id FROM canvas_objects WHERE active = 1 AND object_type = 'process' AND plant_id = ?
        )
      `)
      .run(enabled ? 1 : 0, plantId);
    return result.changes;
  }

  /**
   * Phase 7: Count active lines per plant
   */
  async countByPlant(plantId: string): Promise<number> {
    const result = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM canvas_objects co
        WHERE co.active = 1 AND co.plant_id = ? AND co.object_type = 'process'
      `)
      .get(plantId) as { count: number };
    return result.count;
  }

  /**
   * Phase 7: Get unique areas within a plant
   */
  async getAreasByPlant(plantId: string): Promise<string[]> {
    const rows = this.db
      .prepare(`
        SELECT DISTINCT pp.area
        FROM canvas_objects co
        JOIN process_properties pp ON co.id = pp.canvas_object_id
        WHERE co.active = 1 AND co.plant_id = ? AND co.object_type = 'process'
        ORDER BY pp.area
      `)
      .all(plantId) as { area: string }[];
    return rows.map(row => row.area);
  }
}
