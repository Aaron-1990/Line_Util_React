// ============================================
// COMPATIBILITY STORE - Zustand
// State management for line-model compatibility CRUD
// Phase 6B: Line-Model Compatibility UI
// ============================================

import { create } from 'zustand';
import { ILineModelCompatibility } from '@domain/entities';
import { COMPATIBILITY_CHANNELS } from '@shared/constants';
import { useProjectStore } from '../../../store/useProjectStore';

// ===== Types =====

export interface CreateCompatibilityInput {
  lineId: string;
  modelId: string;
  cycleTime: number;
  efficiency: number;
  priority: number;
}

interface CompatibilityState {
  // Data keyed by lineId
  compatibilitiesByLine: Map<string, ILineModelCompatibility[]>;
  isLoading: boolean;
  error: string | null;

  // Modal state
  isFormOpen: boolean;
  editingCompatibility: ILineModelCompatibility | null;
  targetLineId: string | null;

  // Actions
  loadForLine: (lineId: string) => Promise<void>;
  createCompatibility: (data: CreateCompatibilityInput) => Promise<void>;
  updateCompatibility: (id: string, data: Partial<ILineModelCompatibility>) => Promise<void>;
  deleteCompatibility: (id: string, lineId: string) => Promise<void>;

  openForm: (lineId: string, compatibility?: ILineModelCompatibility) => void;
  closeForm: () => void;

  getForLine: (lineId: string) => ILineModelCompatibility[];
}

// ===== Helper: Mark Unsaved Changes =====

const markProjectUnsaved = () => {
  useProjectStore.getState().markUnsavedChanges();
};

// ===== Store =====

export const useCompatibilityStore = create<CompatibilityState>((set, get) => ({
  // Initial State
  compatibilitiesByLine: new Map(),
  isLoading: false,
  error: null,

  isFormOpen: false,
  editingCompatibility: null,
  targetLineId: null,

  // ===== Data Loading =====

  loadForLine: async (lineId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<ILineModelCompatibility[]>(
        COMPATIBILITY_CHANNELS.GET_BY_LINE,
        lineId
      );

      if (response.success && response.data) {
        const { compatibilitiesByLine } = get();
        const newMap = new Map(compatibilitiesByLine);

        // Sort by priority (lowest = highest priority)
        const sorted = response.data.sort((a, b) => a.priority - b.priority);
        newMap.set(lineId, sorted);

        set({ compatibilitiesByLine: newMap, isLoading: false });
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

  // ===== CRUD Actions =====

  createCompatibility: async (data: CreateCompatibilityInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<ILineModelCompatibility>(
        COMPATIBILITY_CHANNELS.CREATE,
        data
      );

      if (response.success && response.data) {
        // Reload compatibilities for this line
        await get().loadForLine(data.lineId);
        set({ isFormOpen: false, editingCompatibility: null, targetLineId: null });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to create compatibility' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create compatibility',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  updateCompatibility: async (id: string, data: Partial<ILineModelCompatibility>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<ILineModelCompatibility>(
        COMPATIBILITY_CHANNELS.UPDATE,
        { id, ...data }
      );

      if (response.success && response.data) {
        // Reload compatibilities for the affected line
        // Find lineId from current data
        const { compatibilitiesByLine } = get();
        let lineId: string | null = null;

        for (const [lid, comps] of compatibilitiesByLine.entries()) {
          if (comps.some(c => c.id === id)) {
            lineId = lid;
            break;
          }
        }

        if (lineId) {
          await get().loadForLine(lineId);
        }

        set({ isFormOpen: false, editingCompatibility: null, targetLineId: null });
        markProjectUnsaved(); // Track unsaved changes
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

  deleteCompatibility: async (id: string, lineId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<boolean>(
        COMPATIBILITY_CHANNELS.DELETE,
        id
      );

      if (response.success) {
        // Reload compatibilities for this line
        await get().loadForLine(lineId);
        markProjectUnsaved(); // Track unsaved changes
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

  // ===== Modal Actions =====

  openForm: (lineId: string, compatibility?: ILineModelCompatibility) => {
    set({
      isFormOpen: true,
      editingCompatibility: compatibility || null,
      targetLineId: lineId,
    });
  },

  closeForm: () => {
    set({
      isFormOpen: false,
      editingCompatibility: null,
      targetLineId: null,
      error: null,
    });
  },

  // ===== Computed =====

  getForLine: (lineId: string) => {
    const { compatibilitiesByLine } = get();
    return compatibilitiesByLine.get(lineId) || [];
  },
}));
