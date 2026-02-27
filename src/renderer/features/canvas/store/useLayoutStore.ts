// ============================================
// LAYOUT STORE - Zustand
// State management for background layout images
// Phase 8.5: Canvas Background Layouts
// ============================================

import { create } from 'zustand';
import type { LayoutImage, UpdateLayoutInput, ImportLayoutResult } from '@shared/types/layout';
import { LAYOUT_CHANNELS } from '@shared/constants';
import { useProjectStore } from '../../../store/useProjectStore';

// ============================================
// TYPES
// ============================================

interface LayoutStore {
  // State
  layouts: LayoutImage[];
  isLoading: boolean;
  error: string | null;
  /** ID of the layout currently in crop mode (ephemeral UI state, not persisted). */
  cropModeLayoutId: string | null;

  // Actions
  loadLayoutsForPlant: (plantId: string) => Promise<void>;
  importLayout: (plantId: string, viewportCenter?: { x: number; y: number }) => Promise<LayoutImage | null>;
  updateLayout: (id: string, input: UpdateLayoutInput) => Promise<void>;
  deleteLayout: (id: string) => Promise<void>;
  toggleVisibility: (id: string) => Promise<void>;
  setOpacity: (id: string, opacity: number) => Promise<void>;
  toggleLock: (id: string) => Promise<void>;
  toggleAspectRatioLock: (id: string) => Promise<void>;
  setCropMode: (layoutId: string | null) => void;
  resetCrop: (id: string) => Promise<void>;

  // Helpers
  getLayoutById: (id: string) => LayoutImage | undefined;
}

// ============================================
// Helper: Mark Unsaved Changes
// ============================================

const markProjectUnsaved = () => {
  useProjectStore.getState().markUnsavedChanges();
};

// ============================================
// STORE
// ============================================

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  layouts: [],
  isLoading: false,
  error: null,
  cropModeLayoutId: null,

  // ============================================
  // LOAD LAYOUTS FOR PLANT
  // ============================================

  loadLayoutsForPlant: async (plantId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<LayoutImage[]>(
        LAYOUT_CHANNELS.GET_BY_PLANT,
        plantId
      );

      if (response.success && response.data) {
        set({ layouts: response.data, isLoading: false });
      } else {
        set({ error: response.error ?? 'Failed to load layouts', isLoading: false });
      }
    } catch (error) {
      console.error('[LayoutStore] Error loading layouts:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  // ============================================
  // IMPORT LAYOUT (opens file dialog via IPC)
  // ============================================

  importLayout: async (plantId: string, viewportCenter?: { x: number; y: number }) => {
    try {
      const response = await window.electronAPI.invoke<ImportLayoutResult>(
        LAYOUT_CHANNELS.IMPORT,
        { plantId, viewportCenter }
      );

      if (response.success && response.data) {
        const { layout } = response.data;

        // Optimistic update: add to local state immediately
        set((state) => ({ layouts: [...state.layouts, layout] }));

        markProjectUnsaved();
        console.log('[LayoutStore] Imported layout:', layout.name);
        return layout;
      } else if (response.error === 'Import canceled') {
        // User canceled - not an error
        return null;
      } else {
        console.error('[LayoutStore] Import failed:', response.error);
        return null;
      }
    } catch (error) {
      console.error('[LayoutStore] Error importing layout:', error);
      return null;
    }
  },

  // ============================================
  // UPDATE LAYOUT
  // ============================================

  updateLayout: async (id: string, input: UpdateLayoutInput) => {
    // Optimistic update: apply changes locally first (no server-confirm overwrite to avoid
    // race conditions between concurrent drag-end + opacity/lock IPC calls)
    set((state) => ({
      layouts: state.layouts.map((l) =>
        l.id === id ? { ...l, ...input } : l
      ),
    }));

    try {
      const response = await window.electronAPI.invoke<LayoutImage>(
        LAYOUT_CHANNELS.UPDATE,
        { id, ...input }
      );

      if (response.success) {
        markProjectUnsaved();
      } else {
        console.error('[LayoutStore] Update failed:', response.error);
        // On failure, reload from DB to restore consistent state
        const layout = get().layouts.find((l) => l.id === id);
        if (layout?.plantId) {
          get().loadLayoutsForPlant(layout.plantId);
        }
      }
    } catch (error) {
      console.error('[LayoutStore] Error updating layout:', error);
    }
  },

  // ============================================
  // DELETE LAYOUT
  // ============================================

  deleteLayout: async (id: string) => {
    // Optimistic update: remove from local state immediately
    set((state) => ({
      layouts: state.layouts.filter((l) => l.id !== id),
    }));

    try {
      const response = await window.electronAPI.invoke<void>(
        LAYOUT_CHANNELS.DELETE,
        id
      );

      if (response.success) {
        markProjectUnsaved();
        console.log('[LayoutStore] Deleted layout:', id);
      } else {
        console.error('[LayoutStore] Delete failed:', response.error);
      }
    } catch (error) {
      console.error('[LayoutStore] Error deleting layout:', error);
    }
  },

  // ============================================
  // TOGGLE VISIBILITY
  // ============================================

  toggleVisibility: async (id: string) => {
    const layout = get().layouts.find((l) => l.id === id);
    if (!layout) return;

    await get().updateLayout(id, { visible: !layout.visible });
  },

  // ============================================
  // SET OPACITY
  // ============================================

  setOpacity: async (id: string, opacity: number) => {
    const clamped = Math.max(0, Math.min(1, opacity));
    await get().updateLayout(id, { opacity: clamped });
  },

  // ============================================
  // TOGGLE LOCK
  // ============================================

  toggleLock: async (id: string) => {
    const layout = get().layouts.find((l) => l.id === id);
    if (!layout) return;

    await get().updateLayout(id, { locked: !layout.locked });
  },

  // ============================================
  // TOGGLE ASPECT RATIO LOCK
  // ============================================

  toggleAspectRatioLock: async (id: string) => {
    const layout = get().layouts.find((l) => l.id === id);
    if (!layout) return;

    await get().updateLayout(id, { aspectRatioLocked: !layout.aspectRatioLocked });
  },

  // ============================================
  // CROP MODE
  // ============================================

  setCropMode: (layoutId: string | null) => {
    set({ cropModeLayoutId: layoutId });
  },

  resetCrop: async (id: string) => {
    // Clear all 4 crop fields (null = no crop) and exit crop mode
    await get().updateLayout(id, { cropX: null, cropY: null, cropW: null, cropH: null });
    set({ cropModeLayoutId: null });
  },

  // ============================================
  // HELPERS
  // ============================================

  getLayoutById: (id: string) => {
    return get().layouts.find((l) => l.id === id);
  },
}));
