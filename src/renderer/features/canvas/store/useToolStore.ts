// ============================================
// TOOL STORE - Zustand
// State management for canvas tool interaction
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { create } from 'zustand';
import { CanvasTool, ToolState, isPlaceTool } from '@shared/types/canvas-tool';

// ============================================
// TYPES
// ============================================

interface ToolStore extends ToolState {
  // Tool Actions
  setTool: (tool: CanvasTool) => void;
  setSelectTool: () => void;
  setPanTool: () => void;
  setConnectTool: () => void;
  setPlaceTool: (shapeId: string) => void;

  // Ghost Position (for place preview)
  setGhostPosition: (position: { x: number; y: number } | null) => void;

  // Selection Management
  setSelectedObjects: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;

  // Connection Management
  setConnectionSource: (source: { objectId: string; anchor: string } | null) => void;
  clearConnectionSource: () => void;

  // Derived/Helper Methods
  isPlacing: () => boolean;
  getPlacingShapeId: () => string | null;
  isSelected: (id: string) => boolean;
  hasSelection: () => boolean;
  getToolType: () => 'select' | 'pan' | 'connect' | 'place';
}

// ============================================
// STORE
// ============================================

export const useToolStore = create<ToolStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  activeTool: 'select',
  ghostPosition: null,
  selectedObjectIds: [],
  connectionSource: null,

  // ============================================
  // TOOL ACTIONS
  // ============================================

  /**
   * Set the active canvas tool
   * Clears ghost position and connection source when tool changes
   */
  setTool: (tool: CanvasTool) => {
    set({
      activeTool: tool,
      ghostPosition: null,
      connectionSource: null,
    });
  },

  /**
   * Switch to Select tool (default)
   * Hotkey: V or Esc
   */
  setSelectTool: () => {
    set({
      activeTool: 'select',
      ghostPosition: null,
      connectionSource: null,
    });
  },

  /**
   * Switch to Pan tool
   * Hotkey: H
   */
  setPanTool: () => {
    set({
      activeTool: 'pan',
      ghostPosition: null,
      connectionSource: null,
    });
  },

  /**
   * Switch to Connect tool
   * Hotkey: C
   */
  setConnectTool: () => {
    set({
      activeTool: 'connect',
      ghostPosition: null,
    });
  },

  /**
   * Switch to Place tool for a specific shape
   * Hotkey: Click on shape in palette
   */
  setPlaceTool: (shapeId: string) => {
    set({
      activeTool: { type: 'place', shapeId },
      connectionSource: null,
    });
  },

  // ============================================
  // GHOST POSITION (PLACE PREVIEW)
  // ============================================

  /**
   * Update ghost position for shape placement preview
   * Set to null to hide ghost
   */
  setGhostPosition: (position: { x: number; y: number } | null) => {
    set({ ghostPosition: position });
  },

  // ============================================
  // SELECTION MANAGEMENT
  // ============================================

  /**
   * Replace current selection with new set of IDs
   */
  setSelectedObjects: (ids: string[]) => {
    set({ selectedObjectIds: ids });
  },

  /**
   * Add single object to selection
   * For multi-select (Shift+Click)
   */
  addToSelection: (id: string) => {
    const { selectedObjectIds } = get();
    if (!selectedObjectIds.includes(id)) {
      set({ selectedObjectIds: [...selectedObjectIds, id] });
    }
  },

  /**
   * Remove single object from selection
   */
  removeFromSelection: (id: string) => {
    const { selectedObjectIds } = get();
    set({
      selectedObjectIds: selectedObjectIds.filter((objId) => objId !== id),
    });
  },

  /**
   * Clear all selections
   */
  clearSelection: () => {
    set({ selectedObjectIds: [] });
  },

  /**
   * Toggle single object in selection
   * For Ctrl/Cmd+Click
   */
  toggleSelection: (id: string) => {
    const { selectedObjectIds } = get();
    if (selectedObjectIds.includes(id)) {
      set({
        selectedObjectIds: selectedObjectIds.filter((objId) => objId !== id),
      });
    } else {
      set({ selectedObjectIds: [...selectedObjectIds, id] });
    }
  },

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Set the source for a new connection
   * Used in Connect tool mode
   */
  setConnectionSource: (source: { objectId: string; anchor: string } | null) => {
    set({ connectionSource: source });
  },

  /**
   * Clear connection source
   * Cancel connection creation
   */
  clearConnectionSource: () => {
    set({ connectionSource: null });
  },

  // ============================================
  // DERIVED/HELPER METHODS
  // ============================================

  /**
   * Check if currently in Place mode
   */
  isPlacing: () => {
    const { activeTool } = get();
    return isPlaceTool(activeTool);
  },

  /**
   * Get the shape ID being placed (or null if not placing)
   */
  getPlacingShapeId: () => {
    const { activeTool } = get();
    return isPlaceTool(activeTool) ? activeTool.shapeId : null;
  },

  /**
   * Check if a specific object is selected
   */
  isSelected: (id: string) => {
    const { selectedObjectIds } = get();
    return selectedObjectIds.includes(id);
  },

  /**
   * Check if any objects are selected
   */
  hasSelection: () => {
    const { selectedObjectIds } = get();
    return selectedObjectIds.length > 0;
  },

  /**
   * Get the current tool type as string
   * Useful for rendering logic
   */
  getToolType: () => {
    const { activeTool } = get();
    return isPlaceTool(activeTool) ? 'place' : activeTool;
  },
}));
