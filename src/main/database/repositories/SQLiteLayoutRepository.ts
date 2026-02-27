// ============================================
// SQLITE REPOSITORY: Project Layouts
// Phase 8.5: Canvas Background Layouts
// Phase 8.5b: Added rotation, originalWidth/Height, aspectRatioLocked
// ============================================

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  LayoutImage,
  LayoutImageRow,
  CreateLayoutInput,
  UpdateLayoutInput,
} from '@shared/types';

export class SQLiteLayoutRepository {
  constructor(private db: Database.Database) {}

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapRowToEntity(row: LayoutImageRow): LayoutImage {
    return {
      id: row.id,
      plantId: row.plant_id,
      name: row.name,
      imageData: row.image_data,
      sourceFormat: row.source_format as LayoutImage['sourceFormat'],
      xPosition: row.x_position,
      yPosition: row.y_position,
      width: row.width,
      height: row.height,
      opacity: row.opacity,
      locked: Boolean(row.locked),
      visible: Boolean(row.visible),
      zIndex: row.z_index,
      active: Boolean(row.active),
      rotation: row.rotation ?? 0,
      originalWidth: row.original_width ?? row.width,
      originalHeight: row.original_height ?? row.height,
      aspectRatioLocked: Boolean(row.aspect_ratio_locked ?? 1),
      cropX: row.crop_x ?? null,
      cropY: row.crop_y ?? null,
      cropW: row.crop_w ?? null,
      cropH: row.crop_h ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get all active layouts for a plant
   */
  findByPlant(plantId: string): LayoutImage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM project_layouts
         WHERE plant_id = ? AND active = 1
         ORDER BY z_index ASC, created_at ASC`
      )
      .all(plantId) as LayoutImageRow[];

    return rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get a single layout by ID
   */
  findById(id: string): LayoutImage | null {
    const row = this.db
      .prepare(`SELECT * FROM project_layouts WHERE id = ? AND active = 1`)
      .get(id) as LayoutImageRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new layout image.
   * originalWidth/Height are stored at creation and never updated.
   */
  create(input: CreateLayoutInput): LayoutImage {
    const id = nanoid();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO project_layouts (
           id, plant_id, name, image_data, source_format,
           x_position, y_position, width, height,
           opacity, locked, visible, z_index, active,
           rotation, original_width, original_height, aspect_ratio_locked,
           created_at, updated_at
         ) VALUES (
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, 0, 1, 0, 1,
           0, ?, ?, 1,
           ?, ?
         )`
      )
      .run(
        id,
        input.plantId,
        input.name,
        input.imageData,
        input.sourceFormat,
        input.xPosition,
        input.yPosition,
        input.width,
        input.height,
        input.opacity ?? 0.5,
        input.originalWidth,
        input.originalHeight,
        now,
        now
      );

    return this.findById(id)!;
  }

  /**
   * Update layout properties.
   * originalWidth/originalHeight are intentionally NOT updatable (immutable).
   */
  update(id: string, input: UpdateLayoutInput): LayoutImage | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE project_layouts SET
           name              = ?,
           x_position        = ?,
           y_position        = ?,
           width             = ?,
           height            = ?,
           opacity           = ?,
           locked            = ?,
           visible           = ?,
           z_index           = ?,
           rotation          = ?,
           aspect_ratio_locked = ?,
           crop_x            = ?,
           crop_y            = ?,
           crop_w            = ?,
           crop_h            = ?,
           updated_at        = ?
         WHERE id = ?`
      )
      .run(
        input.name            ?? existing.name,
        input.xPosition       ?? existing.xPosition,
        input.yPosition       ?? existing.yPosition,
        input.width           ?? existing.width,
        input.height          ?? existing.height,
        input.opacity         ?? existing.opacity,
        input.locked          !== undefined ? (input.locked ? 1 : 0)          : (existing.locked ? 1 : 0),
        input.visible         !== undefined ? (input.visible ? 1 : 0)         : (existing.visible ? 1 : 0),
        input.zIndex          ?? existing.zIndex,
        input.rotation        !== undefined ? input.rotation                  : existing.rotation,
        input.aspectRatioLocked !== undefined ? (input.aspectRatioLocked ? 1 : 0) : (existing.aspectRatioLocked ? 1 : 0),
        // null is valid (= reset crop), so use !== undefined, not ??
        input.cropX           !== undefined ? input.cropX                     : existing.cropX,
        input.cropY           !== undefined ? input.cropY                     : existing.cropY,
        input.cropW           !== undefined ? input.cropW                     : existing.cropW,
        input.cropH           !== undefined ? input.cropH                     : existing.cropH,
        now,
        id
      );

    return this.findById(id);
  }

  /**
   * Soft-delete a layout (sets active = 0)
   */
  delete(id: string): boolean {
    const result = this.db
      .prepare(`UPDATE project_layouts SET active = 0, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);

    return result.changes > 0;
  }
}
