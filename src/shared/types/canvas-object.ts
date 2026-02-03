// ============================================
// CANVAS OBJECT TYPES (Phase 7.5)
// Polymorphic canvas objects with shape references
// ============================================

import type { ShapeDefinition } from './shape-catalog';
import type { ProductionLine } from './index';

/**
 * Canvas object types for domain-specific behavior
 */
export type CanvasObjectType =
  | 'generic'
  | 'process'
  | 'buffer'
  | 'source'
  | 'sink'
  | 'quality_gate';

/**
 * Connection type for inter-object relationships
 */
export type ConnectionType = 'flow' | 'info' | 'material';

/**
 * Buffer overflow policies
 */
export type OverflowPolicy = 'block' | 'overflow' | 'alert';

/**
 * Core canvas object entity
 * Polymorphic: behavior depends on objectType
 */
export interface CanvasObject {
  id: string;
  plantId: string;
  shapeId: string;
  objectType: CanvasObjectType;
  name: string;
  description?: string;
  xPosition: number;
  yPosition: number;
  width?: number;           // Override shape default
  height?: number;          // Override shape default
  rotation: number;         // Degrees: 0, 90, 180, 270
  colorOverride?: string;   // Hex color override
  active: boolean;
  locked: boolean;          // Prevent editing/moving
  zIndex: number;           // Layer order
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Buffer-specific properties (type = 'buffer')
 * Stores WIP inventory between process steps
 */
export interface BufferProperties {
  id: string;
  canvasObjectId: string;
  maxCapacity: number;
  bufferTimeHours: number;
  currentWip: number;
  fifoEnforced: boolean;
  overflowPolicy: OverflowPolicy;
}

/**
 * Process line linkage (type = 'process')
 * Links canvas object to actual production line
 */
export interface ProcessLineLink {
  id: string;
  canvasObjectId: string;
  productionLineId?: string;    // NULL = unlinked process object
}

/**
 * Canvas connection between objects
 * Represents material/info flow
 */
export interface CanvasConnection {
  id: string;
  plantId: string;
  sourceObjectId: string;
  sourceAnchor?: string;        // Anchor ID from shape definition
  targetObjectId: string;
  targetAnchor?: string;        // Anchor ID from shape definition
  connectionType: ConnectionType;
  label?: string;
  active: boolean;
}

/**
 * Combined type for UI with all related data
 * Includes shape definition and polymorphic properties
 */
export interface CanvasObjectWithDetails extends CanvasObject {
  shape: ShapeDefinition;
  bufferProperties?: BufferProperties;
  processLink?: ProcessLineLink;
  linkedLine?: ProductionLine;
}

/**
 * Input for creating new canvas object
 */
export interface CreateCanvasObjectInput {
  plantId: string;
  shapeId: string;
  name: string;
  description?: string;
  xPosition?: number;
  yPosition?: number;
  width?: number;
  height?: number;
  objectType?: CanvasObjectType;
}

/**
 * Input for updating canvas object
 */
export interface UpdateCanvasObjectInput {
  name?: string;
  description?: string;
  xPosition?: number;
  yPosition?: number;
  width?: number;
  height?: number;
  rotation?: number;
  colorOverride?: string;
  locked?: boolean;
  zIndex?: number;
  objectType?: CanvasObjectType;
}

/**
 * Input for creating connection
 */
export interface CreateConnectionInput {
  plantId: string;
  sourceObjectId: string;
  sourceAnchor?: string;
  targetObjectId: string;
  targetAnchor?: string;
  connectionType?: ConnectionType;
  label?: string;
}

/**
 * Input for updating buffer properties
 */
export interface UpdateBufferPropertiesInput {
  maxCapacity?: number;
  bufferTimeHours?: number;
  currentWip?: number;
  fifoEnforced?: boolean;
  overflowPolicy?: OverflowPolicy;
}

/**
 * Input for linking process object to production line
 */
export interface UpdateProcessLinkInput {
  productionLineId?: string;    // NULL = unlink
}

// ============================================
// DATABASE ROW TYPES
// ============================================

/**
 * Database row for canvas_objects table
 */
export interface CanvasObjectRow {
  id: string;
  plant_id: string;
  shape_id: string;
  object_type: string;
  name: string;
  description: string | null;
  x_position: number;
  y_position: number;
  width: number | null;
  height: number | null;
  rotation: number;
  color_override: string | null;
  active: number;
  locked: number;
  z_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database row for buffer_properties table
 */
export interface BufferPropertiesRow {
  id: string;
  canvas_object_id: string;
  max_capacity: number;
  buffer_time_hours: number;
  current_wip: number;
  fifo_enforced: number;
  overflow_policy: string;
}

/**
 * Database row for process_line_links table
 */
export interface ProcessLineLinkRow {
  id: string;
  canvas_object_id: string;
  production_line_id: string | null;
}

/**
 * Database row for canvas_connections table
 */
export interface CanvasConnectionRow {
  id: string;
  plant_id: string;
  source_object_id: string;
  source_anchor: string | null;
  target_object_id: string;
  target_anchor: string | null;
  connection_type: string;
  label: string | null;
  active: number;
}
