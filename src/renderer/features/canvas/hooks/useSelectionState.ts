// ============================================
// USE SELECTION STATE HOOK
// Unified selection state for properties panel
// Phase 7.5: All objects are now canvas_objects (unified)
// ============================================

import { useCanvasStore } from '../store/useCanvasStore';
import { useCanvasObjectStore } from '../store/useCanvasObjectStore';
import { useToolStore } from '../store/useToolStore';

export type SelectionType = 'none' | 'line' | 'object' | 'multi';

export interface SelectionState {
  type: SelectionType;
  selectedId: string | null;
  selectedIds: string[];
}

/**
 * Hook to get unified selection state across different selection mechanisms
 *
 * - 'none': Nothing selected
 * - 'line': A process object is selected (former production line)
 * - 'object': A canvas object (buffer, generic, etc.) is selected
 * - 'multi': Multiple items selected (no properties panel shown)
 *
 * Phase 7.5: All nodes are now genericShape. We distinguish by objectType in data.
 */
export function useSelectionState(): SelectionState {
  const selectedNode = useCanvasStore((s) => s.selectedNode);
  const selectedObjectIds = useToolStore((s) => s.selectedObjectIds);
  const nodes = useCanvasStore((s) => s.nodes);
  // Phase 7.6: Subscribe to objects[] to get objectType (nodes only have objectId now)
  const objects = useCanvasObjectStore((s) => s.objects);

  // Multi-select: show nothing (could show multi-select UI later)
  if (selectedObjectIds.length > 1) {
    return { type: 'multi', selectedId: null, selectedIds: selectedObjectIds };
  }

  // Single selection from either store
  const activeId = selectedObjectIds[0] || selectedNode;

  if (!activeId) {
    return { type: 'none', selectedId: null, selectedIds: [] };
  }

  // Find the node (still needed to verify it exists in ReactFlow)
  const node = nodes.find((n) => n.id === activeId);

  if (!node) {
    return { type: 'none', selectedId: null, selectedIds: [] };
  }

  // Phase 7.6: Look up objectType from objects[] (nodes only have objectId reference)
  const object = objects.find((o) => o.id === activeId);
  if (!object) {
    return { type: 'none', selectedId: null, selectedIds: [] };
  }
  const objectType = object.objectType;

  if (objectType === 'process') {
    // Process objects show as 'line' for UnifiedPropertiesPanel
    return { type: 'line', selectedId: activeId, selectedIds: [activeId] };
  }

  // Buffer, generic, source, sink, quality_gate = object
  return { type: 'object', selectedId: activeId, selectedIds: [activeId] };
}
