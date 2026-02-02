// ============================================
// PLANT STORE - Zustand
// State management for multi-plant support
// Phase 7: Multi-Plant Support
// ============================================

import { create } from 'zustand';
import { Plant, CreatePlantInput, UpdatePlantInput } from '@shared/types';
import { PLANT_CHANNELS } from '@shared/constants';
import { useNavigationStore } from '../../../store/useNavigationStore';

// ===== Types =====

interface PlantState {
  // Data
  plants: Plant[];
  defaultPlantId: string | null;

  // UI State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Modal State
  isFormOpen: boolean;
  editingPlant: Plant | null;
  deleteConfirm: {
    isOpen: boolean;
    plant: Plant | null;
    linesInPlant: number;
  };

  // Actions - Initialization
  initialize: () => Promise<void>;

  // Actions - Data Loading
  loadPlants: () => Promise<void>;

  // Actions - Plant CRUD
  createPlant: (data: CreatePlantInput) => Promise<Plant | null>;
  updatePlant: (id: string, data: UpdatePlantInput) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;
  setDefaultPlant: (id: string) => Promise<void>;

  // Actions - Modals
  openForm: (plant?: Plant) => void;
  closeForm: () => void;
  openDeleteConfirm: (plant: Plant, linesInPlant: number) => void;
  closeDeleteConfirm: () => void;

  // Actions - Utilities
  clearError: () => void;

  // Computed
  getPlantById: (id: string) => Plant | undefined;
  getPlantByCode: (code: string) => Plant | undefined;
  getActivePlants: () => Plant[];
  getCurrentPlant: () => Plant | undefined;
}

// ===== Store =====

export const usePlantStore = create<PlantState>((set, get) => ({
  // Initial State
  plants: [],
  defaultPlantId: null,

  isLoading: false,
  isInitialized: false,
  error: null,

  isFormOpen: false,
  editingPlant: null,
  deleteConfirm: {
    isOpen: false,
    plant: null,
    linesInPlant: 0,
  },

  // ===== Initialization =====

  /**
   * Initialize plant store - called once on app startup
   * Loads plants and sets up current plant context
   */
  initialize: async () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    set({ isLoading: true, error: null });

    try {
      // Load all plants
      const response = await window.electronAPI.invoke<Plant[]>(
        PLANT_CHANNELS.GET_ALL
      );

      if (response.success && response.data) {
        const plants = response.data.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));

        // Find default plant
        const defaultPlant = plants.find(p => p.isDefault);
        const defaultPlantId = defaultPlant?.id || plants[0]?.id || null;

        set({
          plants,
          defaultPlantId,
          isInitialized: true,
          isLoading: false,
        });

        // Initialize navigation store's plant context
        const navStore = useNavigationStore.getState();
        navStore.initializePlantFromStorage();

        // If no stored plant, use default
        if (!navStore.currentPlantId && defaultPlantId) {
          navStore.setCurrentPlant(defaultPlantId);
        }

        // Validate stored plant still exists
        if (navStore.currentPlantId) {
          const storedPlantExists = plants.some(p => p.id === navStore.currentPlantId);
          if (!storedPlantExists) {
            console.warn('[PlantStore] Stored plant no longer exists, using default');
            navStore.setCurrentPlant(defaultPlantId);
          }
        }

        console.log(`[PlantStore] Initialized with ${plants.length} plants, default: ${defaultPlant?.code || 'none'}`);
      } else {
        set({
          error: response.error || 'Failed to load plants',
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[PlantStore] Initialization failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize plants',
        isLoading: false,
      });
    }
  },

  // ===== Data Loading =====

  loadPlants: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<Plant[]>(
        PLANT_CHANNELS.GET_ALL
      );

      if (response.success && response.data) {
        const plants = response.data.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));

        const defaultPlant = plants.find(p => p.isDefault);

        set({
          plants,
          defaultPlantId: defaultPlant?.id || plants[0]?.id || null,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'Failed to load plants',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load plants',
        isLoading: false,
      });
    }
  },

  // ===== Plant CRUD =====

  createPlant: async (data: CreatePlantInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<Plant>(
        PLANT_CHANNELS.CREATE,
        data
      );

      if (response.success && response.data) {
        await get().loadPlants();
        set({ isFormOpen: false, editingPlant: null });
        return {
          ...response.data,
          createdAt: new Date(response.data.createdAt),
          updatedAt: new Date(response.data.updatedAt),
        };
      } else {
        set({ error: response.error || 'Failed to create plant' });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create plant',
      });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePlant: async (id: string, data: UpdatePlantInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<Plant>(
        PLANT_CHANNELS.UPDATE,
        { id, ...data }
      );

      if (response.success) {
        await get().loadPlants();
        set({ isFormOpen: false, editingPlant: null });
      } else {
        set({ error: response.error || 'Failed to update plant' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update plant',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  deletePlant: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        PLANT_CHANNELS.DELETE,
        { id }
      );

      if (response.success) {
        // If we deleted the current plant, switch to default
        const navStore = useNavigationStore.getState();
        if (navStore.currentPlantId === id) {
          const { defaultPlantId, plants } = get();
          const nextPlant = plants.find(p => p.id !== id);
          navStore.setCurrentPlant(defaultPlantId !== id ? defaultPlantId : nextPlant?.id || null);
        }

        await get().loadPlants();
        set({
          deleteConfirm: { isOpen: false, plant: null, linesInPlant: 0 },
        });
      } else {
        set({ error: response.error || 'Failed to delete plant' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete plant',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  setDefaultPlant: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        PLANT_CHANNELS.SET_DEFAULT,
        { id }
      );

      if (response.success) {
        await get().loadPlants();
      } else {
        set({ error: response.error || 'Failed to set default plant' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set default plant',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // ===== Modal Actions =====

  openForm: (plant) =>
    set({
      isFormOpen: true,
      editingPlant: plant || null,
      error: null,
    }),

  closeForm: () =>
    set({
      isFormOpen: false,
      editingPlant: null,
      error: null,
    }),

  openDeleteConfirm: (plant, linesInPlant) =>
    set({
      deleteConfirm: {
        isOpen: true,
        plant,
        linesInPlant,
      },
      error: null,
    }),

  closeDeleteConfirm: () =>
    set({
      deleteConfirm: {
        isOpen: false,
        plant: null,
        linesInPlant: 0,
      },
      error: null,
    }),

  // ===== Utilities =====

  clearError: () => set({ error: null }),

  // ===== Computed =====

  getPlantById: (id: string) => {
    const { plants } = get();
    return plants.find(p => p.id === id);
  },

  getPlantByCode: (code: string) => {
    const { plants } = get();
    return plants.find(p => p.code === code);
  },

  getActivePlants: () => {
    const { plants } = get();
    return plants.filter(p => p.isActive);
  },

  getCurrentPlant: () => {
    const { plants } = get();
    const { currentPlantId } = useNavigationStore.getState();
    if (!currentPlantId) return undefined;
    return plants.find(p => p.id === currentPlantId);
  },
}));
