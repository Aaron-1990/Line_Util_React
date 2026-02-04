// ============================================
// USE SELECTION STATE HOOK
// Unified selection state for properties panel
// Determines if a line or canvas object is selected
// ============================================

import { useCanvasStore } from '../store/useCanvasStore';
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
 * - 'line': A production line node is selected
 * - 'object': A canvas object (process, buffer, generic) is selected
 * - 'multi': Multiple items selected (no properties panel shown)
 */
export function useSelectionState(): SelectionState {
  const selectedNode = useCanvasStore((s) => s.selectedNode);
  const selectedObjectIds = useToolStore((s) => s.selectedObjectIds);
  const nodes = useCanvasStore((s) => s.nodes);

  // Multi-select: show nothing (could show multi-select UI later)
  if (selectedObjectIds.length > 1) {
    return { type: 'multi', selectedId: null, selectedIds: selectedObjectIds };
  }

  // Single selection from either store
  // Priority: selectedObjectIds (canvas objects) > selectedNode (legacy lines)
  const activeId = selectedObjectIds[0] || selectedNode;

  if (!activeId) {
    return { type: 'none', selectedId: null, selectedIds: [] };
  }

  // Determine type from node
  const node = nodes.find((n) => n.id === activeId);

  if (!node) {
    return { type: 'none', selectedId: null, selectedIds: [] };
  }

  if (node.type === 'productionLine') {
    return { type: 'line', selectedId: activeId, selectedIds: [activeId] };
  }

  // genericShape or any other type = canvas object
  return { type: 'object', selectedId: activeId, selectedIds: [activeId] };
}
