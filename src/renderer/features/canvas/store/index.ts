// ============================================
// CANVAS STORES - EXPORTS
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

export { useToolStore } from './useToolStore';
export { useShapeCatalogStore } from './useShapeCatalogStore';
export { useCanvasObjectStore } from './useCanvasObjectStore';

// Re-export types for convenience
export type {
  CanvasTool,
  ToolState,
  CanvasToolType,
  PlaceTool,
} from '@shared/types/canvas-tool';

export type {
  ShapeCategory,
  ShapeDefinition,
  ShapeAnchor,
  CreateShapeInput,
  UpdateShapeInput,
} from '@shared/types/shape-catalog';

export type {
  CanvasObject,
  CanvasObjectWithDetails,
  CanvasObjectType,
  BufferProperties,
  CanvasConnection,
  CreateCanvasObjectInput,
  UpdateCanvasObjectInput,
  UpdateBufferPropertiesInput,
} from '@shared/types/canvas-object';
