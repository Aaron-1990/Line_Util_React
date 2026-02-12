// ============================================
// CANVAS SHAPE CONSTANTS
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

/**
 * Default shape ID for production line objects
 *
 * References the built-in rectangle shape from shape_catalog table.
 * This shape is used when:
 * - Creating production line objects from Excel import
 * - Converting production lines to canvas objects
 * - Default shape for process-type canvas objects
 *
 * Shape specifications:
 * - ID: 'rect-basic'
 * - Category: 'basic'
 * - Render type: 'primitive'
 * - Primitive type: 'rectangle'
 * - Default dimensions: 200x100
 *
 * @see migrations/012_shape_catalog.sql - Shape definition
 */
export const PRODUCTION_LINE_SHAPE_ID = 'rect-basic';

/**
 * Default shape IDs for different canvas object types
 */
export const DEFAULT_SHAPE_IDS = {
  PRODUCTION_LINE: 'rect-basic',
  BUFFER: 'rect-basic',
  SOURCE: 'circle-basic',
  SINK: 'circle-basic',
  QUALITY_GATE: 'diamond-basic',
  GENERIC: 'rect-basic',
} as const;
