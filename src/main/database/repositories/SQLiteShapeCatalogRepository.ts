// ============================================
// SQLITE REPOSITORY: Shape Catalog
// Phase 7.5: Polymorphic Canvas Objects
// ============================================

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  ShapeCategory,
  ShapeDefinition,
  ShapeAnchor,
  CreateShapeInput,
  ShapeCategoryRow,
  ShapeDefinitionRow,
  ShapeAnchorRow,
} from '@shared/types';

export class SQLiteShapeCatalogRepository {
  constructor(private db: Database.Database) {}

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapCategoryRowToEntity(row: ShapeCategoryRow): ShapeCategory {
    return {
      id: row.id,
      name: row.name,
      displayOrder: row.display_order,
      icon: row.icon ?? undefined,
    };
  }

  private mapShapeRowToEntity(
    row: ShapeDefinitionRow,
    anchors: ShapeAnchor[]
  ): ShapeDefinition {
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description ?? undefined,
      source: row.source as any,
      sourceFile: row.source_file ?? undefined,
      renderType: row.render_type as any,
      svgContent: row.svg_content ?? undefined,
      imageUrl: row.image_url ?? undefined,
      primitiveType: row.primitive_type as any,
      defaultWidth: row.default_width,
      defaultHeight: row.default_height,
      thumbnailSvg: row.thumbnail_svg ?? undefined,
      isActive: Boolean(row.is_active),
      isFavorite: Boolean(row.is_favorite),
      usageCount: row.usage_count,
      anchors,
    };
  }

  private mapAnchorRowToEntity(row: ShapeAnchorRow): ShapeAnchor {
    return {
      id: row.id,
      shapeId: row.shape_id,
      name: row.name ?? undefined,
      position: row.position as any,
      offsetX: row.offset_x,
      offsetY: row.offset_y,
      isInput: Boolean(row.is_input),
      isOutput: Boolean(row.is_output),
    };
  }

  // ============================================
  // CATEGORY OPERATIONS
  // ============================================

  /**
   * Get all shape categories
   */
  async findAllCategories(): Promise<ShapeCategory[]> {
    const rows = this.db
      .prepare('SELECT * FROM shape_categories ORDER BY display_order, name')
      .all() as ShapeCategoryRow[];

    return rows.map(row => this.mapCategoryRowToEntity(row));
  }

  // ============================================
  // SHAPE OPERATIONS
  // ============================================

  /**
   * Get all shapes with their anchors
   */
  async findAllShapes(): Promise<ShapeDefinition[]> {
    const shapeRows = this.db
      .prepare('SELECT * FROM shape_catalog WHERE is_active = 1 ORDER BY name')
      .all() as ShapeDefinitionRow[];

    return this.attachAnchorsToShapes(shapeRows);
  }

  /**
   * Alias for findAllShapes (used by handlers)
   */
  async findAll(): Promise<ShapeDefinition[]> {
    return this.findAllShapes();
  }

  /**
   * Get shapes by category with their anchors
   */
  async findShapesByCategory(categoryId: string): Promise<ShapeDefinition[]> {
    const shapeRows = this.db
      .prepare(`
        SELECT * FROM shape_catalog
        WHERE category_id = ? AND is_active = 1
        ORDER BY usage_count DESC, name
      `)
      .all(categoryId) as ShapeDefinitionRow[];

    return this.attachAnchorsToShapes(shapeRows);
  }

  /**
   * Alias for findShapesByCategory (used by handlers)
   */
  async findByCategory(categoryId: string): Promise<ShapeDefinition[]> {
    return this.findShapesByCategory(categoryId);
  }

  /**
   * Get a single shape by ID
   */
  async findShapeById(id: string): Promise<ShapeDefinition | null> {
    const row = this.db
      .prepare('SELECT * FROM shape_catalog WHERE id = ?')
      .get(id) as ShapeDefinitionRow | undefined;

    if (!row) {
      return null;
    }

    const anchors = await this.findAnchorsForShape(id);
    return this.mapShapeRowToEntity(row, anchors);
  }

  /**
   * Alias for findShapeById (used by handlers)
   */
  async findById(id: string): Promise<ShapeDefinition | null> {
    return this.findShapeById(id);
  }

  /**
   * Get all anchors for a shape
   */
  async findAnchorsForShape(shapeId: string): Promise<ShapeAnchor[]> {
    const rows = this.db
      .prepare('SELECT * FROM shape_anchors WHERE shape_id = ?')
      .all(shapeId) as ShapeAnchorRow[];

    return rows.map(row => this.mapAnchorRowToEntity(row));
  }

  /**
   * Helper to attach anchors to multiple shapes
   */
  private async attachAnchorsToShapes(
    shapeRows: ShapeDefinitionRow[]
  ): Promise<ShapeDefinition[]> {
    if (shapeRows.length === 0) {
      return [];
    }

    // Get all anchors for these shapes in one query
    const shapeIds = shapeRows.map(r => r.id);
    const placeholders = shapeIds.map(() => '?').join(',');

    const anchorRows = this.db
      .prepare(`SELECT * FROM shape_anchors WHERE shape_id IN (${placeholders})`)
      .all(...shapeIds) as ShapeAnchorRow[];

    // Group anchors by shape ID
    const anchorsByShape = new Map<string, ShapeAnchor[]>();
    for (const anchorRow of anchorRows) {
      if (!anchorsByShape.has(anchorRow.shape_id)) {
        anchorsByShape.set(anchorRow.shape_id, []);
      }
      anchorsByShape.get(anchorRow.shape_id)!.push(this.mapAnchorRowToEntity(anchorRow));
    }

    // Map shape rows to entities with their anchors
    return shapeRows.map(row =>
      this.mapShapeRowToEntity(row, anchorsByShape.get(row.id) || [])
    );
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Update favorite status
   */
  async updateFavorite(shapeId: string, isFavorite: boolean): Promise<void> {
    this.db
      .prepare('UPDATE shape_catalog SET is_favorite = ?, updated_at = ? WHERE id = ?')
      .run(isFavorite ? 1 : 0, new Date().toISOString(), shapeId);
  }

  /**
   * Increment usage count (when shape is placed on canvas)
   */
  async incrementUsage(shapeId: string): Promise<void> {
    this.db
      .prepare('UPDATE shape_catalog SET usage_count = usage_count + 1 WHERE id = ?')
      .run(shapeId);
  }

  /**
   * Create a new shape (for imported shapes)
   */
  async createShape(input: CreateShapeInput): Promise<ShapeDefinition> {
    const id = nanoid();
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO shape_catalog (
          id, category_id, name, description, source, source_file,
          render_type, svg_content, image_url, primitive_type,
          default_width, default_height, thumbnail_svg,
          is_active, is_favorite, usage_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.categoryId,
        input.name,
        input.description ?? null,
        input.source,
        input.sourceFile ?? null,
        input.renderType,
        input.svgContent ?? null,
        input.imageUrl ?? null,
        input.primitiveType ?? null,
        input.defaultWidth ?? 200,
        input.defaultHeight ?? 100,
        input.thumbnailSvg ?? null,
        1, // is_active
        0, // is_favorite
        0, // usage_count
        now,
        now
      );

    const shape = await this.findShapeById(id);
    if (!shape) {
      throw new Error('Failed to create shape');
    }
    return shape;
  }

  /**
   * Soft delete a shape (set is_active = 0)
   */
  async deleteShape(shapeId: string): Promise<void> {
    const existing = await this.findShapeById(shapeId);
    if (!existing) {
      throw new Error(`Shape with id "${shapeId}" not found`);
    }

    // Prevent deleting built-in shapes
    if (existing.source === 'builtin') {
      throw new Error('Cannot delete built-in shapes');
    }

    this.db
      .prepare('UPDATE shape_catalog SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), shapeId);
  }

  /**
   * Alias for deleteShape (used by handlers)
   */
  async delete(shapeId: string): Promise<void> {
    return this.deleteShape(shapeId);
  }

  /**
   * Import SVG shape (placeholder for future implementation)
   */
  async importSvg(
    svgContent: string,
    name: string,
    categoryId: string = 'custom'
  ): Promise<ShapeDefinition> {
    return this.createShape({
      categoryId,
      name,
      source: 'imported',
      renderType: 'svg',
      svgContent,
      defaultWidth: 200,
      defaultHeight: 100,
    });
  }

  /**
   * Import DXF shape (placeholder for future implementation)
   */
  async importDxf(
    _dxfPath: string,
    _name: string,
    _categoryId: string = 'custom'
  ): Promise<ShapeDefinition> {
    // TODO: Parse DXF and convert to SVG
    // For now, just throw
    throw new Error('DXF import not yet implemented');
  }

  /**
   * Import image shape (placeholder for future implementation)
   */
  async importImage(
    _imagePath: string,
    _name: string,
    _categoryId: string = 'custom'
  ): Promise<ShapeDefinition> {
    // TODO: Convert image to base64 and store
    // For now, just throw
    throw new Error('Image import not yet implemented');
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get favorite shapes
   */
  async findFavoriteShapes(): Promise<ShapeDefinition[]> {
    const shapeRows = this.db
      .prepare(`
        SELECT * FROM shape_catalog
        WHERE is_favorite = 1 AND is_active = 1
        ORDER BY usage_count DESC, name
      `)
      .all() as ShapeDefinitionRow[];

    return this.attachAnchorsToShapes(shapeRows);
  }

  /**
   * Get most used shapes
   */
  async findMostUsedShapes(limit: number = 10): Promise<ShapeDefinition[]> {
    const shapeRows = this.db
      .prepare(`
        SELECT * FROM shape_catalog
        WHERE is_active = 1 AND usage_count > 0
        ORDER BY usage_count DESC, name
        LIMIT ?
      `)
      .all(limit) as ShapeDefinitionRow[];

    return this.attachAnchorsToShapes(shapeRows);
  }

  /**
   * Search shapes by name or description
   */
  async searchShapes(query: string): Promise<ShapeDefinition[]> {
    const searchPattern = `%${query}%`;

    const shapeRows = this.db
      .prepare(`
        SELECT * FROM shape_catalog
        WHERE is_active = 1
        AND (name LIKE ? OR description LIKE ?)
        ORDER BY usage_count DESC, name
      `)
      .all(searchPattern, searchPattern) as ShapeDefinitionRow[];

    return this.attachAnchorsToShapes(shapeRows);
  }

  /**
   * Get shape count by category
   */
  async getShapeCountByCategory(categoryId: string): Promise<number> {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM shape_catalog WHERE category_id = ? AND is_active = 1')
      .get(categoryId) as { count: number };
    return result.count;
  }
}
