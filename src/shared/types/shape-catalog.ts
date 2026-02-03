// ============================================
// SHAPE CATALOG TYPES (Phase 7.5)
// ============================================

/**
 * Shape source types - where the shape came from
 */
export type ShapeSource = 'builtin' | 'imported' | 'ai_generated' | 'user';

/**
 * Shape rendering method
 */
export type ShapeRenderType = 'svg' | 'image' | 'path' | 'primitive';

/**
 * Built-in primitive shape types
 */
export type PrimitiveType = 'rectangle' | 'triangle' | 'circle' | 'diamond';

/**
 * Shape category for organizing shapes in catalog
 */
export interface ShapeCategory {
  id: string;
  name: string;
  displayOrder: number;
  icon?: string;
}

/**
 * Core shape definition entity
 * Defines the visual representation of canvas objects
 */
export interface ShapeDefinition {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  source: ShapeSource;
  sourceFile?: string;
  renderType: ShapeRenderType;
  svgContent?: string;
  imageUrl?: string;
  primitiveType?: PrimitiveType;
  defaultWidth: number;
  defaultHeight: number;
  thumbnailSvg?: string;
  isActive: boolean;
  isFavorite: boolean;
  usageCount: number;
  anchors: ShapeAnchor[];
}

/**
 * Connection anchor point on a shape
 * Defines where connections can attach
 */
export interface ShapeAnchor {
  id: string;
  shapeId: string;
  name?: string;
  position: 'top' | 'right' | 'bottom' | 'left';
  offsetX: number;          // Offset from position in pixels
  offsetY: number;          // Offset from position in pixels
  isInput: boolean;         // Can receive incoming connections
  isOutput: boolean;        // Can send outgoing connections
}

/**
 * Input for creating new shapes (e.g., from import)
 */
export interface CreateShapeInput {
  categoryId: string;
  name: string;
  description?: string;
  source: ShapeSource;
  sourceFile?: string;
  renderType: ShapeRenderType;
  svgContent?: string;
  imageUrl?: string;
  primitiveType?: PrimitiveType;
  defaultWidth?: number;
  defaultHeight?: number;
  thumbnailSvg?: string;
}

/**
 * Input for updating existing shapes
 */
export interface UpdateShapeInput {
  name?: string;
  description?: string;
  categoryId?: string;
  isActive?: boolean;
  isFavorite?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

/**
 * Database row type for shape_categories table
 */
export interface ShapeCategoryRow {
  id: string;
  name: string;
  display_order: number;
  icon: string | null;
}

/**
 * Database row type for shape_definitions table
 */
export interface ShapeDefinitionRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  source: string;
  source_file: string | null;
  render_type: string;
  svg_content: string | null;
  image_url: string | null;
  primitive_type: string | null;
  default_width: number;
  default_height: number;
  thumbnail_svg: string | null;
  is_active: number;
  is_favorite: number;
  usage_count: number;
}

/**
 * Database row type for shape_anchors table
 */
export interface ShapeAnchorRow {
  id: string;
  shape_id: string;
  name: string | null;
  position: string;
  offset_x: number;
  offset_y: number;
  is_input: number;
  is_output: number;
}
