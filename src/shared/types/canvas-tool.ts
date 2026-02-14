// ============================================
// CANVAS TOOL TYPES (Phase 7.5)
// UI state management for canvas interaction tools
// ============================================

/**
 * Base canvas tool types
 */
export type CanvasToolType = 'select' | 'pan' | 'connect' | 'place' | 'paste';

/**
 * Place tool configuration
 * Active when user is placing a new shape on canvas
 */
export interface PlaceTool {
  type: 'place';
  shapeId: string;        // Which shape is being placed
}

/**
 * Paste tool configuration
 * Active when user is pasting a copied object with ghost preview
 */
export interface PasteTool {
  type: 'paste';
  sourceObjectId: string;  // Object being pasted
}

/**
 * Union type for all canvas tools
 */
export type CanvasTool = 'select' | 'pan' | 'connect' | PlaceTool | PasteTool;

/**
 * Complete canvas tool state
 */
export interface ToolState {
  activeTool: CanvasTool;
  ghostPosition: { x: number; y: number } | null;    // Preview position during place
  selectedObjectIds: string[];                       // Currently selected objects
  connectionSource: { objectId: string; anchor: string } | null;  // Active connection source
}

/**
 * Helper type guard for PlaceTool
 */
export function isPlaceTool(tool: CanvasTool): tool is PlaceTool {
  return typeof tool === 'object' && tool.type === 'place';
}

/**
 * Helper type guard for PasteTool
 */
export function isPasteTool(tool: CanvasTool): tool is PasteTool {
  return typeof tool === 'object' && tool.type === 'paste';
}

/**
 * Canvas interaction mode for keyboard shortcuts
 */
export type InteractionMode = 'normal' | 'multi_select' | 'panning';

/**
 * Cursor style based on active tool
 */
export type CursorStyle =
  | 'default'
  | 'pointer'
  | 'grab'
  | 'grabbing'
  | 'crosshair'
  | 'move'
  | 'not-allowed';

/**
 * Tool configuration with hotkeys
 */
export interface ToolConfig {
  type: CanvasToolType;
  icon: string;
  label: string;
  hotkey?: string;
  description: string;
}

/**
 * Default tool configurations
 */
export const TOOL_CONFIGS: Record<CanvasToolType, Omit<ToolConfig, 'type'>> = {
  select: {
    icon: 'cursor-arrow',
    label: 'Select',
    hotkey: 'V',
    description: 'Select and move objects',
  },
  pan: {
    icon: 'hand',
    label: 'Pan',
    hotkey: 'H',
    description: 'Pan canvas view',
  },
  connect: {
    icon: 'link',
    label: 'Connect',
    hotkey: 'C',
    description: 'Create connections between objects',
  },
  place: {
    icon: 'plus-circle',
    label: 'Place',
    hotkey: 'P',
    description: 'Place new object on canvas',
  },
  paste: {
    icon: 'clipboard',
    label: 'Paste',
    hotkey: 'Ctrl+V',
    description: 'Paste copied object with preview',
  },
};
