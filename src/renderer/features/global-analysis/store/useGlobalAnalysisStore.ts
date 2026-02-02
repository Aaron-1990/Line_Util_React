// ============================================
// GLOBAL ANALYSIS STORE - Zustand
// State management for cross-plant analysis
// Phase 7: Multi-Plant Support - Sprint 5
// ============================================

import { create } from 'zustand';
import { ANALYSIS_CHANNELS } from '@shared/constants';
import { usePlantStore } from '../../plants';
import { GlobalAlert } from '@shared/types';

// ===== Types =====

interface PlantAnalysisResult {
  plantId: string;
  plantCode: string;
  plantName: string;
  region?: string;
  color?: string;
  lineCount: number;
  modelCount: number;
  averageUtilization: number;
  maxUtilization: number;
  constraintArea?: string;
  headroomPercent: number;
  unfulfilledDemand: number;
  executionTimeMs: number;
}

interface GlobalAnalysisState {
  // Selected year for analysis
  selectedYear: number;
  availableYears: number[];

  // Results
  plantResults: PlantAnalysisResult[];
  alerts: GlobalAlert[];

  // UI State
  isRunning: boolean;
  progress: { current: number; total: number };
  error: string | null;
  lastRunAt: Date | null;

  // Actions
  setSelectedYear: (year: number) => void;
  setAvailableYears: (years: number[]) => void;
  runAllPlants: () => Promise<void>;
  clearResults: () => void;
  clearError: () => void;

  // Computed
  getNetworkSummary: () => {
    totalPlants: number;
    totalLines: number;
    networkAvgUtilization: number;
    totalUnfulfilled: number;
  };
}

// ===== Store =====

export const useGlobalAnalysisStore = create<GlobalAnalysisState>((set, get) => ({
  // Initial State
  selectedYear: new Date().getFullYear(),
  availableYears: [],

  plantResults: [],
  alerts: [],

  isRunning: false,
  progress: { current: 0, total: 0 },
  error: null,
  lastRunAt: null,

  // ===== Actions =====

  setSelectedYear: (year) => set({ selectedYear: year }),

  setAvailableYears: (years) => {
    set({ availableYears: years });
    // If current selected year not in available, use first available
    const { selectedYear } = get();
    if (years.length > 0 && !years.includes(selectedYear)) {
      set({ selectedYear: years[0] });
    }
  },

  runAllPlants: async () => {
    const { selectedYear } = get();
    const activePlants = usePlantStore.getState().getActivePlants();

    if (activePlants.length === 0) {
      set({ error: 'No active plants to analyze' });
      return;
    }

    set({
      isRunning: true,
      progress: { current: 0, total: activePlants.length },
      error: null,
      plantResults: [],
      alerts: [],
    });

    const results: PlantAnalysisResult[] = [];
    const newAlerts: GlobalAlert[] = [];

    try {
      for (const [index, plant] of activePlants.entries()) {
        set({ progress: { current: index + 1, total: activePlants.length } });

        // Run analysis for this plant
        const response = await window.electronAPI.invoke<{
          yearResults: Array<{
            year: number;
            lineResults: Array<{
              lineId: string;
              lineName: string;
              area: string;
              utilizationPercent: number;
              totalAllocated: number;
              dailyCapacity: number;
              unfulfilledDemand: number;
            }>;
            areaResults: Array<{
              area: string;
              utilizationPercent: number;
              isConstrained: boolean;
            }>;
            summary: {
              totalDemand: number;
              totalAllocated: number;
              totalUnfulfilled: number;
              avgUtilization: number;
              maxUtilization: number;
              constrainedAreas: string[];
            };
          }>;
          executionTimeMs: number;
        }>(ANALYSIS_CHANNELS.RUN_OPTIMIZATION, {
          selectedYears: [selectedYear],
          plantId: plant.id,
        });

        if (response.success && response.data) {
          const yearResult = response.data.yearResults.find(y => y.year === selectedYear);
          if (yearResult) {
            const constraintArea = yearResult.areaResults.find(a => a.isConstrained)?.area;
            const maxUtil = yearResult.summary.maxUtilization;

            results.push({
              plantId: plant.id,
              plantCode: plant.code,
              plantName: plant.name,
              region: plant.region,
              color: plant.color,
              lineCount: yearResult.lineResults.length,
              modelCount: new Set(yearResult.lineResults.map(l => l.lineName)).size,
              averageUtilization: yearResult.summary.avgUtilization,
              maxUtilization: maxUtil,
              constraintArea,
              headroomPercent: Math.max(0, 100 - maxUtil),
              unfulfilledDemand: yearResult.summary.totalUnfulfilled,
              executionTimeMs: response.data.executionTimeMs,
            });

            // Generate alerts
            if (maxUtil >= 90) {
              newAlerts.push({
                type: 'critical',
                plantId: plant.id,
                plantCode: plant.code,
                message: `${plant.code} at ${maxUtil.toFixed(0)}% utilization`,
                metric: maxUtil,
                area: constraintArea,
              });
            } else if (maxUtil >= 80) {
              newAlerts.push({
                type: 'warning',
                plantId: plant.id,
                plantCode: plant.code,
                message: `${plant.code} approaching capacity (${maxUtil.toFixed(0)}%)`,
                metric: maxUtil,
                area: constraintArea,
              });
            } else if (maxUtil < 60) {
              newAlerts.push({
                type: 'info',
                plantId: plant.id,
                plantCode: plant.code,
                message: `${plant.code} has ${(100 - maxUtil).toFixed(0)}% headroom`,
                metric: 100 - maxUtil,
              });
            }
          }
        } else {
          console.error(`[GlobalAnalysis] Failed to analyze plant ${plant.code}:`, response.error);
        }
      }

      // Sort results by utilization (highest first)
      results.sort((a, b) => b.maxUtilization - a.maxUtilization);

      // Sort alerts by severity
      const alertOrder = { critical: 0, warning: 1, info: 2 };
      newAlerts.sort((a, b) => alertOrder[a.type] - alertOrder[b.type]);

      set({
        plantResults: results,
        alerts: newAlerts,
        isRunning: false,
        lastRunAt: new Date(),
      });
    } catch (error) {
      console.error('[GlobalAnalysis] Error running analysis:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to run global analysis',
        isRunning: false,
      });
    }
  },

  clearResults: () => set({
    plantResults: [],
    alerts: [],
    lastRunAt: null,
  }),

  clearError: () => set({ error: null }),

  // ===== Computed =====

  getNetworkSummary: () => {
    const { plantResults } = get();
    if (plantResults.length === 0) {
      return { totalPlants: 0, totalLines: 0, networkAvgUtilization: 0, totalUnfulfilled: 0 };
    }

    const totalLines = plantResults.reduce((sum, p) => sum + p.lineCount, 0);
    const totalUnfulfilled = plantResults.reduce((sum, p) => sum + p.unfulfilledDemand, 0);

    // Weight average by line count
    const weightedSum = plantResults.reduce((sum, p) => sum + p.averageUtilization * p.lineCount, 0);
    const networkAvgUtilization = totalLines > 0 ? weightedSum / totalLines : 0;

    return {
      totalPlants: plantResults.length,
      totalLines,
      networkAvgUtilization,
      totalUnfulfilled,
    };
  },
}));
