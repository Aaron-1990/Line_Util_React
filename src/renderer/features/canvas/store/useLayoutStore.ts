// ============================================
// LAYOUT STORE - Zustand
// State management for background layout images
// Phase 8.5: Canvas Background Layouts
// Phase 8.5c Phase 2: imageOriginX/Y + imageScale primary fields
// ============================================

import { create } from 'zustand';
import type { LayoutImage, UpdateLayoutInput, ImportLayoutResult } from '@shared/types/layout';
import { LAYOUT_CHANNELS } from '@shared/constants';
import { useProjectStore } from '../../../store/useProjectStore';
import { deriveBounds } from '../utils/deriveBounds';

// ============================================
// TYPES
// ============================================

/** Image-coordinate crop rectangle (mirrors CropRect in CropOverlay.tsx). */
type CropRect = { cropX: number; cropY: number; cropW: number; cropH: number };

interface LayoutStore {
  // State
  layouts: LayoutImage[];
  isLoading: boolean;
  error: string | null;
  /** ID of the layout currently in crop mode (ephemeral UI state, not persisted). */
  cropModeLayoutId: string | null;
  /** Live crop from the latest CropOverlay drag tick — not yet persisted via mouseup.
   *  Used by commitCrop as the authoritative source when the user clicks "Done Cropping"
   *  without releasing the mouse (no mouseup → no handleCropEnd → store still null). */
  pendingCrop: { layoutId: string; crop: CropRect } | null;
  /** Plant ID for which layouts are currently loaded. Used by loadLayoutsForPlant to skip
   *  unnecessary DB reloads when ProductionCanvas re-mounts on tab navigation (same plant).
   *  Reset to null by refreshAllStores() so project open/new always forces a fresh load. */
  loadedForPlantId: string | null;

  // Actions
  loadLayoutsForPlant: (plantId: string) => Promise<void>;
  /** Reset the loadedForPlantId guard so the next loadLayoutsForPlant call always
   *  hits the DB regardless of which plant is currently loaded. Call from
   *  refreshAllStores() before switching databases (project open / new project). */
  resetLoadedPlant: () => void;
  importLayout: (plantId: string, viewportCenter?: { x: number; y: number }) => Promise<LayoutImage | null>;
  updateLayout: (id: string, input: UpdateLayoutInput) => Promise<void>;
  deleteLayout: (id: string) => Promise<void>;
  toggleVisibility: (id: string) => Promise<void>;
  setOpacity: (id: string, opacity: number) => Promise<void>;
  toggleLock: (id: string) => Promise<void>;
  toggleAspectRatioLock: (id: string) => Promise<void>;
  setCropMode: (layoutId: string | null) => void;
  /** Resize the node to fit the stored crop, then exit crop mode. Call on "Done Cropping" / overlay exit. */
  commitCrop: (id: string) => void;
  resetCrop: (id: string) => void;
  /** Write live crop data from CropOverlay drag tick to the store so commitCrop can access it.
   *  Pass (null, null) to clear. */
  setPendingCrop: (layoutId: string | null, crop: CropRect | null) => void;

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
  pendingCrop: null,
  loadedForPlantId: null,

  // ============================================
  // LOAD LAYOUTS FOR PLANT
  // ============================================

  loadLayoutsForPlant: async (plantId: string) => {
    // Guard: skip DB reload if this plant is already loaded in memory.
    // Prevents position revert when ProductionCanvas re-mounts on tab navigation.
    // refreshAllStores() calls resetLoadedPlant() first to bypass this guard on
    // project open / new project (where a fresh DB read is required).
    if (get().loadedForPlantId === plantId) {
      console.log('[LayoutStore] Skipping reload — layouts already loaded for plant:', plantId);
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<LayoutImage[]>(
        LAYOUT_CHANNELS.GET_BY_PLANT,
        plantId
      );

      if (response.success && response.data) {
        set({ layouts: response.data, isLoading: false, loadedForPlantId: plantId });
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

  resetLoadedPlant: () => {
    set({ loadedForPlantId: null });
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
        // On failure, reload from DB to restore consistent state.
        // Reset the guard first so the reload is not skipped.
        const layout = get().layouts.find((l) => l.id === id);
        if (layout?.plantId) {
          set({ loadedForPlantId: null });
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
    if (layoutId === null) {
      set({ cropModeLayoutId: null, pendingCrop: null });
      return;
    }

    const layout = get().layouts.find((l) => l.id === layoutId);
    if (!layout) {
      set({ cropModeLayoutId: layoutId, pendingCrop: null });
      return;
    }

    // Expand the node to the FULL uncropped image dimensions.
    // CropOverlay receives a node that shows the entire image; the existing crop handles
    // appear on top at their correct image-pixel positions.
    // activeArea in LayoutImageNode = {0, 0, originalW*imageScale, originalH*imageScale}.
    const expandedBounds = deriveBounds({
      imageOriginX: layout.imageOriginX,
      imageOriginY: layout.imageOriginY,
      imageScale: layout.imageScale,
      originalWidth: layout.originalWidth,
      originalHeight: layout.originalHeight,
      cropX: null, cropY: null, cropW: null, cropH: null, // full image
    });

    // Pre-populate pendingCrop with the existing crop (if any) so that "Done Cropping"
    // without moving any handle re-applies the same crop instead of defaulting to null.
    // commitCrop reads pendingCrop first, layout.cropX/Y/W/H as fallback — but expandedBounds
    // doesn't clear cropX/Y/W/H, so the fallback already works. This is defensive:
    // it makes the intent explicit and guards against any future path that clears cropX/Y/W/H.
    const preCrop =
      layout.cropX !== null &&
      layout.cropY !== null &&
      layout.cropW !== null &&
      layout.cropH !== null
        ? { layoutId, crop: { cropX: layout.cropX, cropY: layout.cropY, cropW: layout.cropW, cropH: layout.cropH } }
        : null;

    set((state) => ({
      layouts: state.layouts.map((l) =>
        l.id === layoutId ? { ...l, ...expandedBounds } : l
      ),
      cropModeLayoutId: layoutId,
      pendingCrop: preCrop,
    }));
  },

  commitCrop: (id: string) => {
    const layout = get().layouts.find((l) => l.id === id);
    if (!layout) {
      set({ cropModeLayoutId: null, pendingCrop: null });
      return;
    }

    // pendingCrop has priority: it's the latest drag position when the user clicks
    // "Done Cropping" without releasing the mouse (no mouseup → no handleCropEnd).
    // layout.cropX/Y/W/H is the last mouseup-persisted position and is used as fallback.
    const pending = get().pendingCrop;
    const pendingForThis = pending?.layoutId === id ? pending.crop : null;
    const cropX = pendingForThis?.cropX ?? layout.cropX;
    const cropY = pendingForThis?.cropY ?? layout.cropY;
    const cropW = pendingForThis?.cropW ?? layout.cropW;
    const cropH = pendingForThis?.cropH ?? layout.cropH;

    if (cropX === null || cropY === null || cropW === null || cropH === null) {
      // No crop applied — just exit crop mode without changing the layout.
      set({ cropModeLayoutId: null, pendingCrop: null });
      return;
    }

    // ONE-WAY derivation: primary fields (imageOriginX/Y, imageScale) are unchanged.
    // Only cropX/Y/W/H change; deriveBounds computes the new node position/size.
    const bounds = deriveBounds({
      imageOriginX: layout.imageOriginX,
      imageOriginY: layout.imageOriginY,
      imageScale: layout.imageScale,
      originalWidth: layout.originalWidth,
      originalHeight: layout.originalHeight,
      cropX, cropY, cropW, cropH,
    });

    // Single atomic state transition — one user action = one set() call.
    set((state) => ({
      layouts: state.layouts.map((l) =>
        l.id === id
          ? { ...l, cropX, cropY, cropW, cropH, ...bounds }
          : l
      ),
      cropModeLayoutId: null,
      pendingCrop: null,
    }));

    // Async IPC persistence — fire-and-forget, decoupled from UI state update.
    window.electronAPI.invoke<LayoutImage>(LAYOUT_CHANNELS.UPDATE, {
      id, cropX, cropY, cropW, cropH, ...bounds,
    }).then((response) => {
      if (response.success) markProjectUnsaved();
      else console.error('[commitCrop] IPC update failed:', response.error);
    }).catch((err) => console.error('[commitCrop] IPC error:', err));
  },

  resetCrop: (id: string) => {
    const layout = get().layouts.find((l) => l.id === id);
    if (!layout) {
      set({ cropModeLayoutId: null, pendingCrop: null });
      return;
    }

    // Restore to full image: cropX/Y/W/H = null → deriveBounds uses originalWidth/Height.
    const bounds = deriveBounds({
      imageOriginX: layout.imageOriginX,
      imageOriginY: layout.imageOriginY,
      imageScale: layout.imageScale,
      originalWidth: layout.originalWidth,
      originalHeight: layout.originalHeight,
      cropX: null, cropY: null, cropW: null, cropH: null,
    });

    set((state) => ({
      layouts: state.layouts.map((l) =>
        l.id === id
          ? { ...l, cropX: null, cropY: null, cropW: null, cropH: null, ...bounds }
          : l
      ),
      cropModeLayoutId: null,
      pendingCrop: null,
    }));

    window.electronAPI.invoke<LayoutImage>(LAYOUT_CHANNELS.UPDATE, {
      id, cropX: null, cropY: null, cropW: null, cropH: null, ...bounds,
    }).then((response) => {
      if (response.success) markProjectUnsaved();
      else console.error('[resetCrop] IPC update failed:', response.error);
    }).catch((err) => console.error('[resetCrop] IPC error:', err));
  },

  setPendingCrop: (layoutId: string | null, crop: CropRect | null) => {
    set({ pendingCrop: layoutId && crop ? { layoutId, crop } : null });
  },

  // ============================================
  // HELPERS
  // ============================================

  getLayoutById: (id: string) => {
    return get().layouts.find((l) => l.id === id);
  },
}));
