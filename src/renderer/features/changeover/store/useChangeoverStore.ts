// ============================================
// CHANGEOVER STORE - Zustand
// State management for changeover matrix feature
// Phase 5.2: UI Components
// ============================================

import { create } from 'zustand';
import { CHANGEOVER_CHANNELS } from '@shared/constants';
import type {
  ChangeoverMatrix,
  FamilyChangeoverDefault,
  LineChangeoverOverride,
  ChangeoverMethodId,
} from '@shared/types/changeover';

// ============================================
// TYPES
// ============================================

export type ViewMode = 'family' | 'model';

export interface ChangeoverState {
  // Modal State
  isModalOpen: boolean;
  selectedLineId: string | null;
  selectedLineName: string | null;

  // View Mode
  viewMode: ViewMode;

  // Data
  matrix: ChangeoverMatrix | null;
  familyDefaults: FamilyChangeoverDefault[];
  lineOverrides: LineChangeoverOverride[];
  allFamilies: string[];

  // Global Settings
  globalDefault: number;
  smedBenchmark: number;
  calculationMethod: ChangeoverMethodId;

  // Loading States
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Dirty State (unsaved changes)
  hasUnsavedChanges: boolean;
  pendingChanges: Map<string, number>; // key: "fromId:toId", value: minutes

  // Actions - Modal
  openModal: (lineId: string, lineName: string) => Promise<void>;
  closeModal: () => void;

  // Actions - View
  setViewMode: (mode: ViewMode) => void;

  // Actions - Data Loading
  loadMatrix: (lineId: string) => Promise<void>;
  loadFamilyDefaults: () => Promise<void>;
  loadGlobalSettings: () => Promise<void>;

  // Actions - Editing
  setCellValue: (fromModelId: string, toModelId: string, minutes: number) => void;
  setFamilyDefault: (fromFamily: string, toFamily: string, minutes: number) => Promise<void>;
  setGlobalDefault: (minutes: number) => Promise<void>;

  // Actions - Save
  saveChanges: () => Promise<void>;
  discardChanges: () => void;

  // Actions - Copy
  copyMatrixFromLine: (sourceLineId: string) => Promise<void>;

  // Actions - Reset
  resetToFamilyDefaults: () => Promise<void>;

  // Actions - Calculation Method
  setCalculationMethod: (methodId: ChangeoverMethodId) => Promise<void>;
}

// ============================================
// STORE
// ============================================

export const useChangeoverStore = create<ChangeoverState>((set, get) => ({
  // Initial State
  isModalOpen: false,
  selectedLineId: null,
  selectedLineName: null,

  viewMode: 'family',

  matrix: null,
  familyDefaults: [],
  lineOverrides: [],
  allFamilies: [],

  globalDefault: 30,
  smedBenchmark: 10,
  calculationMethod: 'probability_weighted',

  isLoading: false,
  isSaving: false,
  error: null,

  hasUnsavedChanges: false,
  pendingChanges: new Map(),

  // ============================================
  // MODAL ACTIONS
  // ============================================

  openModal: async (lineId: string, lineName: string) => {
    set({
      isModalOpen: true,
      selectedLineId: lineId,
      selectedLineName: lineName,
      isLoading: true,
      error: null,
      hasUnsavedChanges: false,
      pendingChanges: new Map(),
    });

    try {
      // Load all data in parallel
      await Promise.all([
        get().loadMatrix(lineId),
        get().loadFamilyDefaults(),
        get().loadGlobalSettings(),
      ]);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load data' });
    } finally {
      set({ isLoading: false });
    }
  },

  closeModal: () => {
    const { hasUnsavedChanges } = get();

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }

    set({
      isModalOpen: false,
      selectedLineId: null,
      selectedLineName: null,
      matrix: null,
      hasUnsavedChanges: false,
      pendingChanges: new Map(),
      error: null,
    });
  },

  // ============================================
  // VIEW ACTIONS
  // ============================================

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  // ============================================
  // DATA LOADING ACTIONS
  // ============================================

  loadMatrix: async (lineId: string) => {
    try {
      const response = await window.electronAPI.invoke<ChangeoverMatrix>(
        CHANGEOVER_CHANNELS.GET_MATRIX,
        lineId
      );

      if (response.success && response.data) {
        set({ matrix: response.data });
      } else {
        throw new Error(response.error || 'Failed to load matrix');
      }
    } catch (error) {
      console.error('[Changeover Store] Load matrix error:', error);
      throw error;
    }
  },

  loadFamilyDefaults: async () => {
    try {
      const [defaultsRes, familiesRes] = await Promise.all([
        window.electronAPI.invoke<FamilyChangeoverDefault[]>(
          CHANGEOVER_CHANNELS.GET_ALL_FAMILY_DEFAULTS
        ),
        window.electronAPI.invoke<string[]>(
          CHANGEOVER_CHANNELS.GET_ALL_FAMILIES
        ),
      ]);

      if (defaultsRes.success) {
        set({ familyDefaults: defaultsRes.data || [] });
      }

      if (familiesRes.success) {
        set({ allFamilies: familiesRes.data || [] });
      }
    } catch (error) {
      console.error('[Changeover Store] Load family defaults error:', error);
      throw error;
    }
  },

  loadGlobalSettings: async () => {
    try {
      const [globalRes, smedRes, methodRes] = await Promise.all([
        window.electronAPI.invoke<number>(CHANGEOVER_CHANNELS.GET_GLOBAL_DEFAULT),
        window.electronAPI.invoke<number>(CHANGEOVER_CHANNELS.GET_SMED_BENCHMARK),
        window.electronAPI.invoke<{ methodId: ChangeoverMethodId }>(
          CHANGEOVER_CHANNELS.GET_CALCULATION_METHOD,
          'global'
        ),
      ]);

      if (globalRes.success && globalRes.data !== undefined) {
        set({ globalDefault: globalRes.data });
      }

      if (smedRes.success && smedRes.data !== undefined) {
        set({ smedBenchmark: smedRes.data });
      }

      if (methodRes.success && methodRes.data) {
        set({ calculationMethod: methodRes.data.methodId });
      }
    } catch (error) {
      console.error('[Changeover Store] Load global settings error:', error);
      throw error;
    }
  },

  // ============================================
  // EDITING ACTIONS
  // ============================================

  setCellValue: (fromModelId: string, toModelId: string, minutes: number) => {
    const { matrix, pendingChanges } = get();

    if (!matrix) return;

    // Validate: diagonal must be 0
    if (fromModelId === toModelId && minutes !== 0) {
      console.warn('Same model changeover must be 0');
      return;
    }

    // Update pending changes
    const key = `${fromModelId}:${toModelId}`;
    const newPendingChanges = new Map(pendingChanges);
    newPendingChanges.set(key, minutes);

    // Update matrix cells for immediate visual feedback
    const newCells = matrix.cells.map((row) =>
      row.map((cell) => {
        if (cell.fromModelId === fromModelId && cell.toModelId === toModelId) {
          return {
            ...cell,
            changeoverMinutes: minutes,
            source: 'line_override' as const,
            isDefault: false,
            exceedsBenchmark: minutes > matrix.smedBenchmark,
          };
        }
        return cell;
      })
    );

    set({
      matrix: { ...matrix, cells: newCells },
      pendingChanges: newPendingChanges,
      hasUnsavedChanges: true,
    });
  },

  setFamilyDefault: async (fromFamily: string, toFamily: string, minutes: number) => {
    const { loadFamilyDefaults, selectedLineId, loadMatrix } = get();

    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<FamilyChangeoverDefault>(
        CHANGEOVER_CHANNELS.SET_FAMILY_DEFAULT,
        fromFamily,
        toFamily,
        minutes
      );

      if (response.success) {
        await loadFamilyDefaults();

        // Reload matrix to reflect changes
        if (selectedLineId) {
          await loadMatrix(selectedLineId);
        }
      } else {
        throw new Error(response.error || 'Failed to set family default');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      set({ isSaving: false });
    }
  },

  setGlobalDefault: async (minutes: number) => {
    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        CHANGEOVER_CHANNELS.SET_GLOBAL_DEFAULT,
        minutes
      );

      if (response.success) {
        set({ globalDefault: minutes });

        // Reload matrix to reflect changes
        const { selectedLineId, loadMatrix } = get();
        if (selectedLineId) {
          await loadMatrix(selectedLineId);
        }
      } else {
        throw new Error(response.error || 'Failed to set global default');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      set({ isSaving: false });
    }
  },

  // ============================================
  // SAVE ACTIONS
  // ============================================

  saveChanges: async () => {
    const { selectedLineId, pendingChanges } = get();

    if (!selectedLineId || pendingChanges.size === 0) return;

    set({ isSaving: true, error: null });

    try {
      // Convert pending changes to array of overrides
      const overrides = Array.from(pendingChanges.entries()).map(([key, minutes]) => {
        const [fromModelId, toModelId] = key.split(':');
        return {
          lineId: selectedLineId,
          fromModelId: fromModelId!,
          toModelId: toModelId!,
          changeoverMinutes: minutes,
        };
      });

      const response = await window.electronAPI.invoke<number>(
        CHANGEOVER_CHANNELS.BULK_SET_LINE_OVERRIDES,
        overrides
      );

      if (response.success) {
        // Reload matrix to get updated stats
        await get().loadMatrix(selectedLineId);

        set({
          hasUnsavedChanges: false,
          pendingChanges: new Map(),
        });
      } else {
        throw new Error(response.error || 'Failed to save changes');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      set({ isSaving: false });
    }
  },

  discardChanges: () => {
    const { selectedLineId, loadMatrix } = get();

    if (!selectedLineId) return;

    set({
      hasUnsavedChanges: false,
      pendingChanges: new Map(),
    });

    // Reload original matrix
    loadMatrix(selectedLineId);
  },

  // ============================================
  // COPY ACTIONS
  // ============================================

  copyMatrixFromLine: async (sourceLineId: string) => {
    const { selectedLineId, loadMatrix } = get();

    if (!selectedLineId || sourceLineId === selectedLineId) return;

    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<number>(
        CHANGEOVER_CHANNELS.COPY_MATRIX,
        sourceLineId,
        selectedLineId
      );

      if (response.success) {
        await loadMatrix(selectedLineId);
        set({ hasUnsavedChanges: false, pendingChanges: new Map() });
      } else {
        throw new Error(response.error || 'Failed to copy matrix');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to copy' });
    } finally {
      set({ isSaving: false });
    }
  },

  // ============================================
  // RESET ACTIONS
  // ============================================

  resetToFamilyDefaults: async () => {
    const { selectedLineId, loadMatrix } = get();

    if (!selectedLineId) return;

    const confirmed = window.confirm(
      'This will delete all line-specific overrides and reset to family defaults. Continue?'
    );

    if (!confirmed) return;

    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<number>(
        CHANGEOVER_CHANNELS.DELETE_ALL_LINE_OVERRIDES,
        selectedLineId
      );

      if (response.success) {
        await loadMatrix(selectedLineId);
        set({ hasUnsavedChanges: false, pendingChanges: new Map() });
      } else {
        throw new Error(response.error || 'Failed to reset');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reset' });
    } finally {
      set({ isSaving: false });
    }
  },

  // ============================================
  // CALCULATION METHOD ACTIONS
  // ============================================

  setCalculationMethod: async (methodId: ChangeoverMethodId) => {
    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        CHANGEOVER_CHANNELS.SET_CALCULATION_METHOD,
        'global',
        methodId
      );

      if (response.success) {
        set({ calculationMethod: methodId });
      } else {
        throw new Error(response.error || 'Failed to set calculation method');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      set({ isSaving: false });
    }
  },
}));
