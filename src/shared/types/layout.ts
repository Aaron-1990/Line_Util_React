// ============================================
// LAYOUT IMAGE TYPES (Phase 8.5)
// Background layout images on the ReactFlow canvas
// ============================================

/**
 * Supported source formats for layout images
 */
export type LayoutSourceFormat = 'png' | 'jpg' | 'bmp' | 'webp' | 'svg' | 'dxf' | 'pdf';

/**
 * Core layout image entity
 * Rendered as a ReactFlow node behind process objects
 */
export interface LayoutImage {
  id: string;
  plantId: string;
  name: string;
  /** base64 data URI for raster formats, SVG string for vector formats */
  imageData: string;
  sourceFormat: LayoutSourceFormat;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  /** 0.0 - 1.0 */
  opacity: number;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  active: boolean;
  /** Rotation in degrees (0-359). Applied via CSS transform. */
  rotation: number;
  /** Original width at import time. Immutable after creation. Used for "Reset to Original". */
  originalWidth: number;
  /** Original height at import time. Immutable after creation. Used for "Reset to Original". */
  originalHeight: number;
  /** When true, NodeResizer and W/H inputs maintain aspect ratio. Defaults to true. */
  aspectRatioLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new layout image
 */
export interface CreateLayoutInput {
  plantId: string;
  name: string;
  imageData: string;
  sourceFormat: LayoutSourceFormat;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  opacity?: number;
  /** Original width at import time (stored immutably for Reset to Original). */
  originalWidth: number;
  /** Original height at import time (stored immutably for Reset to Original). */
  originalHeight: number;
}

/**
 * Input for updating a layout image
 */
export interface UpdateLayoutInput {
  name?: string;
  xPosition?: number;
  yPosition?: number;
  width?: number;
  height?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
  zIndex?: number;
  /** Rotation in degrees (0-359) */
  rotation?: number;
  /** Toggle aspect ratio lock */
  aspectRatioLocked?: boolean;
}

/**
 * Minimal data stored in ReactFlow nodes for layout images.
 * Full data is retrieved from useLayoutStore via layoutId selector.
 */
export interface LayoutNodeData {
  layoutId: string;
}

/**
 * Database row for project_layouts table
 */
export interface LayoutImageRow {
  id: string;
  plant_id: string;
  name: string;
  image_data: string;
  source_format: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  opacity: number;
  locked: number;
  visible: number;
  z_index: number;
  active: number;
  rotation: number;
  original_width: number;
  original_height: number;
  aspect_ratio_locked: number;
  created_at: string;
  updated_at: string;
}

/**
 * Result returned to renderer from LAYOUT_CHANNELS.IMPORT
 */
export interface ImportLayoutResult {
  layout: LayoutImage;
  fileSizeBytes: number;
}
