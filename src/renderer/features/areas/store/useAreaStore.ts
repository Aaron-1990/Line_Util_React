// ============================================
// AREA STORE - Zustand
// State management for area catalog CRUD
// Phase 6D: Custom Areas
// ============================================

import { create } from 'zustand';
import { AreaCatalogItem } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';

// ===== Types =====

export interface CreateAreaInput {
  code: string;
  name: string;
  color: string;
}

interface AreaState {
  // Data
  areas: AreaCatalogItem[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Modal State
  isFormOpen: boolean;
  editingArea: AreaCatalogItem | null;
  deleteConfirm: {
    isOpen: boolean;
    area: AreaCatalogItem | null;
    linesInUse: number;
  };

  // Actions - Data Loading
  loadAreas: () => Promise<void>;

  // Actions - Area CRUD
  createArea: (data: CreateAreaInput) => Promise<void>;
  updateArea: (id: string, data: Partial<AreaCatalogItem>) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;

  // Actions - Modals
  openForm: (area?: AreaCatalogItem) => void;
  closeForm: () => void;
  openDeleteConfirm: (area: AreaCatalogItem, linesInUse: number) => void;
  closeDeleteConfirm: () => void;

  // Computed
  getSortedAreas: () => AreaCatalogItem[];
}

// ===== Store =====

export const useAreaStore = create<AreaState>((set, get) => ({
  // Initial State
  areas: [],

  isLoading: false,
  error: null,

  isFormOpen: false,
  editingArea: null,
  deleteConfirm: {
    isOpen: false,
    area: null,
    linesInUse: 0,
  },

  // ===== Data Loading =====

  loadAreas: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<AreaCatalogItem[]>(
        IPC_CHANNELS.CATALOG_AREAS_GET_ALL
      );

      if (response.success && response.data) {
        set({
          areas: response.data,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'Failed to load areas',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load areas',
        isLoading: false,
      });
    }
  },

  // ===== Area CRUD =====

  createArea: async (data: CreateAreaInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<AreaCatalogItem>(
        IPC_CHANNELS.CATALOG_AREAS_CREATE,
        data
      );

      if (response.success && response.data) {
        // Reload areas to get the new one
        await get().loadAreas();
        set({ isFormOpen: false, editingArea: null });
      } else {
        set({ error: response.error || 'Failed to create area' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create area',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  updateArea: async (id: string, data: Partial<AreaCatalogItem>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<AreaCatalogItem>(
        IPC_CHANNELS.CATALOG_AREAS_UPDATE,
        { id, ...data }
      );

      if (response.success && response.data) {
        // Reload areas to get the updated one
        await get().loadAreas();
        set({ isFormOpen: false, editingArea: null });
      } else {
        set({ error: response.error || 'Failed to update area' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update area',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteArea: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        IPC_CHANNELS.CATALOG_AREAS_DELETE,
        { id }
      );

      if (response.success) {
        // Reload areas
        await get().loadAreas();
        set({
          deleteConfirm: { isOpen: false, area: null, linesInUse: 0 },
        });
      } else {
        set({ error: response.error || 'Failed to delete area' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete area',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // ===== Modal Actions =====

  openForm: (area) =>
    set({
      isFormOpen: true,
      editingArea: area || null,
      error: null,
    }),

  closeForm: () =>
    set({
      isFormOpen: false,
      editingArea: null,
      error: null,
    }),

  openDeleteConfirm: (area, linesInUse) =>
    set({
      deleteConfirm: {
        isOpen: true,
        area,
        linesInUse,
      },
      error: null,
    }),

  closeDeleteConfirm: () =>
    set({
      deleteConfirm: {
        isOpen: false,
        area: null,
        linesInUse: 0,
      },
      error: null,
    }),

  // ===== Computed =====

  getSortedAreas: () => {
    const { areas } = get();
    // Sort by sequence, then by code
    return [...areas].sort((a, b) => {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return a.code.localeCompare(b.code);
    });
  },
}));
