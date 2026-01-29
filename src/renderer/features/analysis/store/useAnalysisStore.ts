// ============================================
// ANALYSIS STORE - Zustand
// State management for analysis control bar
// ============================================

import { create } from 'zustand';
import { OptimizationResult, RunOptimizationRequest, AreaCatalogItem } from '@shared/types';
import { ANALYSIS_CHANNELS, IPC_CHANNELS, CHANGEOVER_CHANNELS } from '@shared/constants';

// ===== Types =====

export interface DataCounts {
  lines: number;
  models: number;
  volumes: number;
  compatibilities: number;
}

export type YearSelectionMode = 'all' | 'range' | 'single';

export type AnalysisStatus = 'idle' | 'ready' | 'running' | 'complete' | 'error';

interface YearSelection {
  mode: YearSelectionMode;
  fromYear: number | null;
  toYear: number | null;
  singleYear: number | null;
}

interface AnalysisProgress {
  currentYear: number;
  currentIndex: number;
  totalYears: number;
}

interface AnalysisState {
  // Data Status
  dataCounts: DataCounts;
  isDataLoading: boolean;
  dataError: string | null;

  // Area Catalog (for ordering)
  areaCatalog: AreaCatalogItem[];

  // Phase 5.6: Global changeover toggle
  globalChangeoverEnabled: boolean;

  // Available Years (from database)
  availableYears: number[];
  yearRange: { min: number; max: number } | null;

  // Year Selection
  yearSelection: YearSelection;

  // Analysis Status
  status: AnalysisStatus;
  progress: AnalysisProgress | null;
  analysisError: string | null;

  // Results
  results: OptimizationResult | null;

  // Computed
  isDataReady: boolean;
  selectedYearsCount: number;

  // Actions - Data Loading
  setDataCounts: (counts: DataCounts) => void;
  setDataLoading: (loading: boolean) => void;
  setDataError: (error: string | null) => void;
  setAreaCatalog: (areas: AreaCatalogItem[]) => void;

  // Phase 5.6: Global changeover toggle
  setGlobalChangeoverEnabled: (enabled: boolean) => Promise<void>;
  loadGlobalChangeoverEnabled: () => Promise<void>;

  // Actions - Years
  setAvailableYears: (years: number[]) => void;
  setYearRange: (range: { min: number; max: number } | null) => void;

  // Actions - Year Selection
  setYearSelectionMode: (mode: YearSelectionMode) => void;
  setFromYear: (year: number | null) => void;
  setToYear: (year: number | null) => void;
  setSingleYear: (year: number | null) => void;

  // Actions - Analysis
  startAnalysis: () => void;
  updateProgress: (year: number, index: number, total: number) => void;
  completeAnalysis: (results: OptimizationResult) => void;
  setAnalysisError: (error: string) => void;
  resetAnalysis: () => void;

  // Actions - Run Optimization
  runOptimization: () => Promise<void>;
  getSelectedYears: () => number[];

  // Actions - Refresh
  refreshData: () => Promise<void>;
}

// ===== Initial State =====

const initialDataCounts: DataCounts = {
  lines: 0,
  models: 0,
  volumes: 0,
  compatibilities: 0,
};

const initialYearSelection: YearSelection = {
  mode: 'all',
  fromYear: null,
  toYear: null,
  singleYear: null,
};

// ===== Helper Functions =====

const calculateIsDataReady = (counts: DataCounts): boolean => {
  return (
    counts.lines > 0 &&
    counts.models > 0 &&
    counts.volumes > 0 &&
    counts.compatibilities > 0
  );
};

const calculateSelectedYearsCount = (
  selection: YearSelection,
  availableYears: number[]
): number => {
  if (availableYears.length === 0) return 0;

  switch (selection.mode) {
    case 'all':
      return availableYears.length;
    case 'single':
      return selection.singleYear ? 1 : 0;
    case 'range': {
      if (!selection.fromYear || !selection.toYear) return 0;
      const from = Math.min(selection.fromYear, selection.toYear);
      const to = Math.max(selection.fromYear, selection.toYear);
      return availableYears.filter(y => y >= from && y <= to).length;
    }
    default:
      return 0;
  }
};

// ===== Store =====

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  // Initial State
  dataCounts: initialDataCounts,
  isDataLoading: false,
  dataError: null,

  areaCatalog: [],

  // Phase 5.6: Global changeover toggle (default ON)
  globalChangeoverEnabled: true,

  availableYears: [],
  yearRange: null,

  yearSelection: initialYearSelection,

  status: 'idle',
  progress: null,
  analysisError: null,

  // Results
  results: null,

  // Computed (implemented as derived state)
  isDataReady: false,
  selectedYearsCount: 0,

  // ===== Data Loading Actions =====

  setDataCounts: (counts) => set((state) => ({
    dataCounts: counts,
    isDataReady: calculateIsDataReady(counts),
    status: calculateIsDataReady(counts) && state.availableYears.length > 0 ? 'ready' : 'idle',
  })),

  setDataLoading: (loading) => set({ isDataLoading: loading }),

  setDataError: (error) => set({ dataError: error }),

  setAreaCatalog: (areas) => set({ areaCatalog: areas }),

  // ===== Phase 5.6: Global Changeover Toggle =====

  setGlobalChangeoverEnabled: async (enabled) => {
    try {
      const response = await window.electronAPI.invoke<void>(
        CHANGEOVER_CHANNELS.SET_GLOBAL_ENABLED,
        enabled
      );
      if (response.success) {
        set({ globalChangeoverEnabled: enabled });
      }
    } catch (error) {
      console.error('Failed to set global changeover enabled:', error);
    }
  },

  loadGlobalChangeoverEnabled: async () => {
    try {
      const response = await window.electronAPI.invoke<boolean>(
        CHANGEOVER_CHANNELS.GET_GLOBAL_ENABLED
      );
      if (response.success && response.data !== undefined) {
        set({ globalChangeoverEnabled: response.data });
      }
    } catch (error) {
      console.error('Failed to load global changeover enabled:', error);
    }
  },

  // ===== Year Actions =====

  setAvailableYears: (years) => set((state) => {
    const sortedYears = [...years].sort((a, b) => a - b);
    const newSelection = { ...state.yearSelection };

    // Auto-set defaults based on available years
    if (sortedYears.length > 0) {
      if (newSelection.fromYear === null) {
        newSelection.fromYear = sortedYears[0] ?? null;
      }
      if (newSelection.toYear === null) {
        newSelection.toYear = sortedYears[sortedYears.length - 1] ?? null;
      }
      if (newSelection.singleYear === null) {
        newSelection.singleYear = sortedYears[0] ?? null;
      }
    }

    return {
      availableYears: sortedYears,
      yearSelection: newSelection,
      selectedYearsCount: calculateSelectedYearsCount(newSelection, sortedYears),
      status: state.isDataReady && sortedYears.length > 0 ? 'ready' : 'idle',
    };
  }),

  setYearRange: (range) => set({ yearRange: range }),

  // ===== Year Selection Actions =====

  setYearSelectionMode: (mode) => set((state) => {
    const newSelection = { ...state.yearSelection, mode };
    return {
      yearSelection: newSelection,
      selectedYearsCount: calculateSelectedYearsCount(newSelection, state.availableYears),
    };
  }),

  setFromYear: (year) => set((state) => {
    const newSelection = { ...state.yearSelection, fromYear: year };
    return {
      yearSelection: newSelection,
      selectedYearsCount: calculateSelectedYearsCount(newSelection, state.availableYears),
    };
  }),

  setToYear: (year) => set((state) => {
    const newSelection = { ...state.yearSelection, toYear: year };
    return {
      yearSelection: newSelection,
      selectedYearsCount: calculateSelectedYearsCount(newSelection, state.availableYears),
    };
  }),

  setSingleYear: (year) => set((state) => {
    const newSelection = { ...state.yearSelection, singleYear: year };
    return {
      yearSelection: newSelection,
      selectedYearsCount: calculateSelectedYearsCount(newSelection, state.availableYears),
    };
  }),

  // ===== Analysis Actions =====

  startAnalysis: () => set({
    status: 'running',
    progress: { currentYear: 0, currentIndex: 0, totalYears: 0 },
    analysisError: null,
  }),

  updateProgress: (year, index, total) => set({
    progress: { currentYear: year, currentIndex: index, totalYears: total },
  }),

  completeAnalysis: (results) => set({
    status: 'complete',
    progress: null,
    results,
  }),

  setAnalysisError: (error) => set({
    status: 'error',
    analysisError: error,
    progress: null,
  }),

  resetAnalysis: () => set({
    status: get().isDataReady ? 'ready' : 'idle',
    progress: null,
    analysisError: null,
    results: null,
  }),

  // ===== Get Selected Years =====
  getSelectedYears: () => {
    const { yearSelection, availableYears } = get();

    switch (yearSelection.mode) {
      case 'all':
        return availableYears;
      case 'single':
        return yearSelection.singleYear ? [yearSelection.singleYear] : [];
      case 'range': {
        if (!yearSelection.fromYear || !yearSelection.toYear) return [];
        const from = Math.min(yearSelection.fromYear, yearSelection.toYear);
        const to = Math.max(yearSelection.fromYear, yearSelection.toYear);
        return availableYears.filter(y => y >= from && y <= to);
      }
      default:
        return [];
    }
  },

  // ===== Run Optimization =====
  runOptimization: async () => {
    const { startAnalysis, completeAnalysis, setAnalysisError, getSelectedYears, updateProgress } = get();

    const selectedYears = getSelectedYears();
    if (selectedYears.length === 0) {
      setAnalysisError('No years selected');
      return;
    }

    startAnalysis();

    try {
      // Show initial progress
      updateProgress(selectedYears[0] ?? 0, 0, selectedYears.length);

      const request: RunOptimizationRequest = {
        selectedYears,
        mode: 'json',
      };

      const response = await window.electronAPI.invoke<OptimizationResult>(
        ANALYSIS_CHANNELS.RUN_OPTIMIZATION,
        request
      );

      if (response.success && response.data) {
        completeAnalysis(response.data);
      } else {
        setAnalysisError(response.error || 'Optimization failed');
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Unknown error');
    }
  },

  // ===== Refresh Action =====

  refreshData: async () => {
    const { setDataLoading, setDataError, setDataCounts, setAvailableYears, setYearRange, setAreaCatalog } = get();

    setDataLoading(true);
    setDataError(null);

    try {
      // Fetch all counts in parallel (including global changeover toggle)
      const [linesRes, modelsRes, volumesRes, compatsRes, yearsRes, rangeRes, areasRes, changeoverEnabledRes] = await Promise.all([
        window.electronAPI.invoke<unknown[]>('lines:get-all'),
        window.electronAPI.invoke<unknown[]>('models-v2:get-all'),
        window.electronAPI.invoke<unknown[]>('product-volumes:get-all'),
        window.electronAPI.invoke<unknown[]>('compatibility:get-all'),
        window.electronAPI.invoke<number[]>('product-volumes:get-available-years'),
        window.electronAPI.invoke<{ min: number; max: number } | null>('product-volumes:get-year-range'),
        window.electronAPI.invoke<AreaCatalogItem[]>(IPC_CHANNELS.CATALOG_AREAS_GET_ALL),
        window.electronAPI.invoke<boolean>(CHANGEOVER_CHANNELS.GET_GLOBAL_ENABLED),
      ]);

      // Extract counts
      const counts: DataCounts = {
        lines: linesRes.success && Array.isArray(linesRes.data) ? linesRes.data.length : 0,
        models: modelsRes.success && Array.isArray(modelsRes.data) ? modelsRes.data.length : 0,
        volumes: volumesRes.success && Array.isArray(volumesRes.data) ? volumesRes.data.length : 0,
        compatibilities: compatsRes.success && Array.isArray(compatsRes.data) ? compatsRes.data.length : 0,
      };

      setDataCounts(counts);

      // Set available years
      if (yearsRes.success && Array.isArray(yearsRes.data)) {
        setAvailableYears(yearsRes.data);
      }

      // Set year range
      if (rangeRes.success && rangeRes.data) {
        setYearRange(rangeRes.data);
      }

      // Set area catalog for ordering
      if (areasRes.success && Array.isArray(areasRes.data)) {
        setAreaCatalog(areasRes.data);
      }

      // Phase 5.6: Set global changeover enabled
      if (changeoverEnabledRes.success && changeoverEnabledRes.data !== undefined) {
        set({ globalChangeoverEnabled: changeoverEnabledRes.data });
      }
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setDataLoading(false);
    }
  },
}));
