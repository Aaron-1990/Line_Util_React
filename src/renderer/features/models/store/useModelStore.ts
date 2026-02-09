// ============================================
// MODEL STORE - Zustand
// State management for models and volumes CRUD
// Phase 6A+: Models + Volumes Combined
// ============================================

import { create } from 'zustand';
import { IProductModelV2, IProductVolume } from '@domain/entities';
import { MODELS_V2_CHANNELS, PRODUCT_VOLUME_CHANNELS } from '@shared/constants';
import { useProjectStore } from '../../../store/useProjectStore';

// ===== Types =====

export interface CreateModelInput {
  name: string;
  customer: string;
  program: string;
  family: string;
  active?: boolean;
}

export interface CreateVolumeInput {
  modelId: string;
  year: number;
  volume: number;
  operationsDays: number;
}

interface ModelState {
  // Data
  models: IProductModelV2[];
  volumes: Map<string, IProductVolume[]>;  // modelId -> volumes

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedModelId: string | null;
  expandedModelIds: Set<string>;

  // Search & Filter
  searchQuery: string;
  familyFilter: string | null;

  // Modal State
  isModelFormOpen: boolean;
  editingModel: IProductModelV2 | null;
  isVolumeFormOpen: boolean;
  editingVolume: IProductVolume | null;

  // Actions - Data Loading
  loadModels: () => Promise<void>;
  loadVolumesForModel: (modelId: string) => Promise<void>;

  // Actions - Model CRUD
  createModel: (data: CreateModelInput) => Promise<void>;
  updateModel: (name: string, data: Partial<IProductModelV2>) => Promise<void>;
  deleteModel: (name: string) => Promise<void>;

  // Actions - Volume CRUD
  createVolume: (data: CreateVolumeInput) => Promise<void>;
  updateVolume: (id: string, data: Partial<IProductVolume>) => Promise<void>;
  deleteVolume: (id: string) => Promise<void>;

  // Actions - UI
  setSelectedModel: (id: string | null) => void;
  toggleExpandModel: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setFamilyFilter: (family: string | null) => void;

  // Actions - Modals
  openModelForm: (model?: IProductModelV2) => void;
  closeModelForm: () => void;
  openVolumeForm: (modelId: string, volume?: IProductVolume) => void;
  closeVolumeForm: () => void;

  // Computed
  getFilteredModels: () => IProductModelV2[];
  getUniqueFamilies: () => string[];
  getVolumesForModel: (modelId: string) => IProductVolume[];
}

// ===== Helper: Mark Unsaved Changes =====

const markProjectUnsaved = () => {
  useProjectStore.getState().markUnsavedChanges();
};

// ===== Store =====

export const useModelStore = create<ModelState>((set, get) => ({
  // Initial State
  models: [],
  volumes: new Map(),

  isLoading: false,
  error: null,
  selectedModelId: null,
  expandedModelIds: new Set(),

  searchQuery: '',
  familyFilter: null,

  isModelFormOpen: false,
  editingModel: null,
  isVolumeFormOpen: false,
  editingVolume: null,

  // ===== Data Loading =====

  loadModels: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load models and all volumes in parallel
      const [modelsResponse, volumesResponse] = await Promise.all([
        window.electronAPI.invoke<IProductModelV2[]>(MODELS_V2_CHANNELS.GET_ALL),
        window.electronAPI.invoke<IProductVolume[]>(PRODUCT_VOLUME_CHANNELS.GET_ALL),
      ]);

      if (modelsResponse.success && modelsResponse.data) {
        // Group volumes by modelId
        const volumesMap = new Map<string, IProductVolume[]>();
        if (volumesResponse.success && volumesResponse.data) {
          for (const volume of volumesResponse.data) {
            const existing = volumesMap.get(volume.modelId) || [];
            existing.push(volume);
            volumesMap.set(volume.modelId, existing);
          }
          // Sort volumes by year for each model
          for (const [modelId, vols] of volumesMap.entries()) {
            volumesMap.set(modelId, vols.sort((a, b) => a.year - b.year));
          }
        }

        set({
          models: modelsResponse.data,
          volumes: volumesMap,
          isLoading: false
        });
      } else {
        set({ error: modelsResponse.error || 'Failed to load models', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load models',
        isLoading: false,
      });
    }
  },

  loadVolumesForModel: async (modelId: string) => {
    try {
      const response = await window.electronAPI.invoke<IProductVolume[]>(
        PRODUCT_VOLUME_CHANNELS.GET_BY_MODEL,
        modelId
      );

      if (response.success && response.data) {
        const { volumes } = get();
        const newVolumes = new Map(volumes);
        newVolumes.set(modelId, response.data);
        set({ volumes: newVolumes });
      }
    } catch (error) {
      console.error('Failed to load volumes for model:', error);
    }
  },

  // ===== Model CRUD =====

  createModel: async (data: CreateModelInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<IProductModelV2>(
        MODELS_V2_CHANNELS.CREATE,
        data
      );

      if (response.success && response.data) {
        // Reload models to get the new one
        await get().loadModels();
        set({ isModelFormOpen: false, editingModel: null });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to create model' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create model',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  updateModel: async (name: string, data: Partial<IProductModelV2>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<IProductModelV2>(
        MODELS_V2_CHANNELS.UPDATE,
        { name, updates: data }
      );

      if (response.success && response.data) {
        // Reload models to get the updated one
        await get().loadModels();
        set({ isModelFormOpen: false, editingModel: null });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to update model' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update model',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteModel: async (name: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        MODELS_V2_CHANNELS.DELETE,
        name
      );

      if (response.success) {
        // Reload models
        await get().loadModels();
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to delete model' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete model',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // ===== Volume CRUD =====

  createVolume: async (data: CreateVolumeInput) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<IProductVolume>(
        PRODUCT_VOLUME_CHANNELS.CREATE,
        data
      );

      if (response.success && response.data) {
        // Reload volumes for this model
        await get().loadVolumesForModel(data.modelId);
        set({ isVolumeFormOpen: false, editingVolume: null });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to create volume' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create volume',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  updateVolume: async (id: string, data: Partial<IProductVolume>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<IProductVolume>(
        PRODUCT_VOLUME_CHANNELS.UPDATE,
        { id, ...data }
      );

      if (response.success && response.data) {
        // Reload volumes for this model
        const modelId = response.data.modelId;
        await get().loadVolumesForModel(modelId);
        set({ isVolumeFormOpen: false, editingVolume: null });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to update volume' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update volume',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteVolume: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      // Get the volume to know which model to reload
      const { volumes } = get();
      let modelId: string | null = null;

      for (const [mId, vols] of volumes.entries()) {
        if (vols.some(v => v.id === id)) {
          modelId = mId;
          break;
        }
      }

      const response = await window.electronAPI.invoke<void>(
        PRODUCT_VOLUME_CHANNELS.DELETE,
        id
      );

      if (response.success && modelId) {
        // Reload volumes for this model
        await get().loadVolumesForModel(modelId);
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ error: response.error || 'Failed to delete volume' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete volume',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // ===== UI Actions =====

  setSelectedModel: (id) => set({ selectedModelId: id }),

  toggleExpandModel: (id) => {
    const { expandedModelIds } = get();
    const newExpanded = new Set(expandedModelIds);

    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      // Load volumes when expanding
      get().loadVolumesForModel(id);
    }

    set({ expandedModelIds: newExpanded });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFamilyFilter: (family) => set({ familyFilter: family }),

  // ===== Modal Actions =====

  openModelForm: (model) => set({
    isModelFormOpen: true,
    editingModel: model || null,
  }),

  closeModelForm: () => set({
    isModelFormOpen: false,
    editingModel: null,
  }),

  openVolumeForm: (modelId, volume) => set({
    isVolumeFormOpen: true,
    editingVolume: volume || null,
    selectedModelId: modelId,
  }),

  closeVolumeForm: () => set({
    isVolumeFormOpen: false,
    editingVolume: null,
  }),

  // ===== Computed =====

  getFilteredModels: () => {
    const { models, searchQuery, familyFilter } = get();

    let filtered = models;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.customer.toLowerCase().includes(query) ||
        m.program.toLowerCase().includes(query)
      );
    }

    // Apply family filter
    if (familyFilter) {
      filtered = filtered.filter(m => m.family === familyFilter);
    }

    // Sort by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },

  getUniqueFamilies: () => {
    const { models } = get();
    const families = new Set(models.map(m => m.family));
    return Array.from(families).sort();
  },

  getVolumesForModel: (modelId: string) => {
    const { volumes } = get();
    return volumes.get(modelId) || [];
  },
}));
