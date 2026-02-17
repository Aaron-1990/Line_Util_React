// ============================================
// CANVAS OBJECT COMPATIBILITY STORE - Zustand
// State management for canvas object model assignments
// Phase 7.5: Unified Object Properties
// ============================================

import { create } from 'zustand';
import {
  CanvasObjectCompatibilityWithModel,
  CreateCanvasObjectCompatibilityInput,
  UpdateCanvasObjectCompatibilityInput,
} from '@shared/types/canvas-object';
import { CANVAS_OBJECT_COMPATIBILITY_CHANNELS } from '@shared/constants';
import { useCanvasObjectStore } from './useCanvasObjectStore';
import { useAnalysisStore } from '../../analysis/store/useAnalysisStore';

// ============================================
// TYPES
// ============================================

interface CanvasObjectCompatibilityState {
  // Data keyed by canvasObjectId
  compatibilitiesByObject: Map<string, CanvasObjectCompatibilityWithModel[]>;
  isLoading: boolean;
  error: string | null;

  // Modal state
  isFormOpen: boolean;
  editingCompatibility: CanvasObjectCompatibilityWithModel | null;
  targetObjectId: string | null;

  // Actions
  loadForObject: (canvasObjectId: string) => Promise<void>;
  createCompatibility: (data: CreateCanvasObjectCompatibilityInput) => Promise<boolean>;
  updateCompatibility: (id: string, data: UpdateCanvasObjectCompatibilityInput) => Promise<void>;
  deleteCompatibility: (id: string, canvasObjectId: string) => Promise<void>;

  openForm: (canvasObjectId: string, compatibility?: CanvasObjectCompatibilityWithModel) => void;
  closeForm: () => void;

  getForObject: (canvasObjectId: string) => CanvasObjectCompatibilityWithModel[];
  clearError: () => void;
}

// ============================================
// STORE
// ============================================

export const useCanvasObjectCompatibilityStore = create<CanvasObjectCompatibilityState>((set, get) => ({
  // Initial State
  compatibilitiesByObject: new Map(),
  isLoading: false,
  error: null,

  isFormOpen: false,
  editingCompatibility: null,
  targetObjectId: null,

  // ============================================
  // DATA LOADING
  // ============================================

  loadForObject: async (canvasObjectId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<CanvasObjectCompatibilityWithModel[]>(
        CANVAS_OBJECT_COMPATIBILITY_CHANNELS.GET_BY_OBJECT,
        canvasObjectId
      );

      if (response.success && response.data) {
        const { compatibilitiesByObject } = get();
        const newMap = new Map(compatibilitiesByObject);

        // Sort by priority (lowest = highest priority)
        const sorted = response.data.sort((a, b) => a.priority - b.priority);
        newMap.set(canvasObjectId, sorted);

        set({ compatibilitiesByObject: newMap, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load compatibilities', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load compatibilities',
        isLoading: false,
      });
    }
  },

  // ============================================
  // CRUD ACTIONS
  // ============================================

  createCompatibility: async (data: CreateCanvasObjectCompatibilityInput): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<CanvasObjectCompatibilityWithModel>(
        CANVAS_OBJECT_COMPATIBILITY_CHANNELS.CREATE,
        data
      );

      if (response.success && response.data) {
        // Reload compatibilities for this object
        await get().loadForObject(data.canvasObjectId);

        // Phase 7.6: Update objects[] directly (single source of truth)
        const newCount = get().getForObject(data.canvasObjectId).length;
        const currentObjects = useCanvasObjectStore.getState().objects;
        useCanvasObjectStore.getState().setObjects(
          currentObjects.map(obj =>
            obj.id === data.canvasObjectId
              ? { ...obj, compatibilitiesCount: newCount }
              : obj
          )
        );
        useAnalysisStore.getState().refreshData();

        set({ isFormOpen: false, editingCompatibility: null, targetObjectId: null, isLoading: false });
        return true;
      } else {
        set({ error: response.error || 'Failed to create compatibility', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create compatibility',
        isLoading: false,
      });
      return false;
    }
  },

  updateCompatibility: async (id: string, data: UpdateCanvasObjectCompatibilityInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<CanvasObjectCompatibilityWithModel>(
        CANVAS_OBJECT_COMPATIBILITY_CHANNELS.UPDATE,
        { id, ...data }
      );

      if (response.success && response.data) {
        // Find canvasObjectId from current data
        const { compatibilitiesByObject } = get();
        let canvasObjectId: string | null = null;

        for (const [objId, comps] of compatibilitiesByObject.entries()) {
          if (comps.some(c => c.id === id)) {
            canvasObjectId = objId;
            break;
          }
        }

        if (canvasObjectId) {
          await get().loadForObject(canvasObjectId);
        }

        set({ isFormOpen: false, editingCompatibility: null, targetObjectId: null });
      } else {
        set({ error: response.error || 'Failed to update compatibility' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update compatibility',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCompatibility: async (id: string, canvasObjectId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<boolean>(
        CANVAS_OBJECT_COMPATIBILITY_CHANNELS.DELETE,
        id
      );

      if (response.success) {
        // Reload compatibilities for this object
        await get().loadForObject(canvasObjectId);

        // Phase 7.6: Update objects[] directly (single source of truth)
        const newCount = get().getForObject(canvasObjectId).length;
        const currentObjects = useCanvasObjectStore.getState().objects;
        useCanvasObjectStore.getState().setObjects(
          currentObjects.map(obj =>
            obj.id === canvasObjectId
              ? { ...obj, compatibilitiesCount: newCount }
              : obj
          )
        );
        useAnalysisStore.getState().refreshData();
      } else {
        set({ error: response.error || 'Failed to delete compatibility' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete compatibility',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // ============================================
  // MODAL ACTIONS
  // ============================================

  openForm: (canvasObjectId: string, compatibility?: CanvasObjectCompatibilityWithModel) => {
    set({
      isFormOpen: true,
      editingCompatibility: compatibility || null,
      targetObjectId: canvasObjectId,
    });
  },

  closeForm: () => {
    set({
      isFormOpen: false,
      editingCompatibility: null,
      targetObjectId: null,
      error: null,
    });
  },

  // ============================================
  // COMPUTED
  // ============================================

  getForObject: (canvasObjectId: string) => {
    const { compatibilitiesByObject } = get();
    return compatibilitiesByObject.get(canvasObjectId) || [];
  },

  clearError: () => {
    set({ error: null });
  },
}));
