// ============================================
// ROUTING STORE - Zustand
// State management for model routings (process flows)
// Phase 6.5: Enhanced with DAG support
// ============================================

import { create } from 'zustand';
import { ProductionLine, AreaCatalogItem, ModelRoutingConfig, ModelAreaRoutingStepInput, RoutingValidationResult } from '@shared/types';
import { ILineModelCompatibility } from '@domain/entities';
import { IPC_CHANNELS, COMPATIBILITY_CHANNELS, ROUTING_CHANNELS } from '@shared/constants';
import { useProjectStore } from '../../../store/useProjectStore';

// ===== Types =====

/**
 * Routing information for a single model
 * Shows which areas the model passes through and which lines in each area
 */
export interface ModelRouting {
  modelId: string;
  modelName: string;
  areas: string[];  // Ordered list of areas (e.g., ['SMT', 'ICT', 'Assembly'])
  linesByArea: Map<string, ProductionLine[]>;  // Area -> Lines that can process this model
}

/**
 * Enhanced routing with DAG information
 */
export interface ModelRoutingWithDAG extends ModelRouting {
  dagConfig: ModelRoutingConfig | null;
  startAreas: string[];   // Areas with no predecessors
  endAreas: string[];     // Areas with no successors
  hasParallelPaths: boolean;
}

interface RoutingState {
  // Data
  productionLines: ProductionLine[];
  compatibilities: ILineModelCompatibility[];
  areaCatalog: AreaCatalogItem[];

  // DAG Routing Cache
  routingConfigs: Map<string, ModelRoutingConfig | null>;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions - Data Loading
  loadData: () => Promise<void>;

  // Actions - DAG Routing
  loadRoutingConfig: (modelId: string) => Promise<ModelRoutingConfig | null>;
  saveRoutingConfig: (modelId: string, steps: ModelAreaRoutingStepInput[]) => Promise<void>;
  clearRouting: (modelId: string) => Promise<void>;
  validateRouting: (modelId: string) => Promise<RoutingValidationResult>;
  validateSteps: (steps: ModelAreaRoutingStepInput[]) => RoutingValidationResult;

  // Computed
  getRoutingForModel: (modelId: string, modelName: string) => ModelRouting;
  getRoutingWithDAG: (modelId: string, modelName: string) => ModelRoutingWithDAG;
  getAreaColor: (areaCode: string) => string;
  getAreaColors: () => Map<string, string>;
}

// ===== Helper: Mark Unsaved Changes =====

const markProjectUnsaved = () => {
  useProjectStore.getState().markUnsavedChanges();
};

// ===== Store =====

export const useRoutingStore = create<RoutingState>((set, get) => ({
  // Initial State
  productionLines: [],
  compatibilities: [],
  areaCatalog: [],
  routingConfigs: new Map(),

  isLoading: false,
  isSaving: false,
  error: null,

  // ===== Data Loading =====

  loadData: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load all data in parallel
      const [linesResponse, compatibilitiesResponse, areasResponse] = await Promise.all([
        window.electronAPI.invoke<ProductionLine[]>(IPC_CHANNELS.LINES_GET_ALL),
        window.electronAPI.invoke<ILineModelCompatibility[]>(COMPATIBILITY_CHANNELS.GET_ALL),
        window.electronAPI.invoke<AreaCatalogItem[]>(IPC_CHANNELS.CATALOG_AREAS_GET_ALL),
      ]);

      if (linesResponse.success && compatibilitiesResponse.success && areasResponse.success) {
        set({
          productionLines: linesResponse.data || [],
          compatibilities: compatibilitiesResponse.data || [],
          areaCatalog: areasResponse.data || [],
          isLoading: false,
        });
      } else {
        set({
          error: linesResponse.error || compatibilitiesResponse.error || areasResponse.error || 'Failed to load data',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isLoading: false,
      });
    }
  },

  // ===== DAG Routing Actions =====

  loadRoutingConfig: async (modelId: string): Promise<ModelRoutingConfig | null> => {
    try {
      const response = await window.electronAPI.invoke<ModelRoutingConfig | null>(
        ROUTING_CHANNELS.GET_BY_MODEL,
        modelId
      );

      if (response.success) {
        // Cache the config
        set((state) => ({
          routingConfigs: new Map(state.routingConfigs).set(modelId, response.data || null),
        }));
        return response.data || null;
      } else {
        console.error('Failed to load routing config:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error loading routing config:', error);
      return null;
    }
  },

  saveRoutingConfig: async (modelId: string, steps: ModelAreaRoutingStepInput[]): Promise<void> => {
    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        ROUTING_CHANNELS.SET_ROUTING,
        modelId,
        steps
      );

      if (response.success) {
        // Invalidate cache - reload to get updated data
        await get().loadRoutingConfig(modelId);
        set({ isSaving: false });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ isSaving: false, error: response.error || 'Failed to save routing' });
        throw new Error(response.error || 'Failed to save routing');
      }
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save routing',
      });
      throw error;
    }
  },

  clearRouting: async (modelId: string): Promise<void> => {
    set({ isSaving: true, error: null });

    try {
      const response = await window.electronAPI.invoke<void>(
        ROUTING_CHANNELS.DELETE_ROUTING,
        modelId
      );

      if (response.success) {
        // Remove from cache
        set((state) => {
          const newConfigs = new Map(state.routingConfigs);
          newConfigs.delete(modelId);
          return { routingConfigs: newConfigs, isSaving: false };
        });
        markProjectUnsaved(); // Track unsaved changes
      } else {
        set({ isSaving: false, error: response.error || 'Failed to clear routing' });
        throw new Error(response.error || 'Failed to clear routing');
      }
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to clear routing',
      });
      throw error;
    }
  },

  validateRouting: async (modelId: string): Promise<RoutingValidationResult> => {
    try {
      const response = await window.electronAPI.invoke<RoutingValidationResult>(
        ROUTING_CHANNELS.VALIDATE_DAG,
        modelId
      );

      if (response.success && response.data) {
        return response.data;
      }

      return {
        isValid: true,
        hasCycle: false,
        hasOrphans: false,
        startNodes: [],
        endNodes: [],
      };
    } catch (error) {
      console.error('Error validating routing:', error);
      return {
        isValid: true,
        hasCycle: false,
        hasOrphans: false,
        startNodes: [],
        endNodes: [],
      };
    }
  },

  validateSteps: (steps: ModelAreaRoutingStepInput[]): RoutingValidationResult => {
    // Client-side validation using same algorithm as server
    if (steps.length === 0) {
      return {
        isValid: true,
        hasCycle: false,
        hasOrphans: false,
        startNodes: [],
        endNodes: [],
      };
    }

    const areaCodes = new Set(steps.map(s => s.areaCode));

    // Build adjacency list and in-degree map
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const code of areaCodes) {
      adjacency.set(code, []);
      inDegree.set(code, 0);
    }

    for (const step of steps) {
      if (step.predecessors) {
        for (const pred of step.predecessors) {
          if (areaCodes.has(pred)) {
            adjacency.get(pred)!.push(step.areaCode);
            inDegree.set(step.areaCode, inDegree.get(step.areaCode)! + 1);
          }
        }
      }
    }

    // Find start nodes
    const startNodes: string[] = [];
    for (const [code, degree] of inDegree) {
      if (degree === 0) {
        startNodes.push(code);
      }
    }

    // Find end nodes
    const endNodes: string[] = [];
    for (const [code, successors] of adjacency) {
      if (successors.length === 0) {
        endNodes.push(code);
      }
    }

    // Kahn's algorithm for cycle detection
    const queue = [...startNodes];
    const sortedOrder: string[] = [];
    const inDegreeCopy = new Map(inDegree);

    while (queue.length > 0) {
      const node = queue.shift()!;
      sortedOrder.push(node);

      for (const successor of adjacency.get(node)!) {
        const newDegree = inDegreeCopy.get(successor)! - 1;
        inDegreeCopy.set(successor, newDegree);
        if (newDegree === 0) {
          queue.push(successor);
        }
      }
    }

    const hasCycle = sortedOrder.length < areaCodes.size;
    const cycleNodes = hasCycle
      ? [...areaCodes].filter(code => !sortedOrder.includes(code))
      : undefined;

    // Detect orphans
    const reachable = new Set<string>();
    const visitQueue = [...startNodes];

    while (visitQueue.length > 0) {
      const node = visitQueue.shift()!;
      if (reachable.has(node)) continue;
      reachable.add(node);

      for (const successor of adjacency.get(node)!) {
        if (!reachable.has(successor)) {
          visitQueue.push(successor);
        }
      }
    }

    const orphanNodes = [...areaCodes].filter(code => !reachable.has(code));
    const hasOrphans = orphanNodes.length > 0;

    return {
      isValid: !hasCycle && !hasOrphans,
      hasCycle,
      cycleNodes,
      hasOrphans,
      orphanNodes: hasOrphans ? orphanNodes : undefined,
      startNodes,
      endNodes,
    };
  },

  // ===== Computed =====

  getRoutingForModel: (modelId: string, modelName: string): ModelRouting => {
    const { productionLines, compatibilities } = get();

    // Find all compatibilities for this model
    const modelCompatibilities = compatibilities.filter(c => c.modelId === modelId);

    // Get unique areas from lines that are compatible with this model
    const linesByArea = new Map<string, ProductionLine[]>();
    const areaSet = new Set<string>();

    for (const compat of modelCompatibilities) {
      const line = productionLines.find(l => l.id === compat.lineId);
      if (line) {
        areaSet.add(line.area);

        if (!linesByArea.has(line.area)) {
          linesByArea.set(line.area, []);
        }
        linesByArea.get(line.area)!.push(line);
      }
    }

    // Convert set to sorted array
    const areas = Array.from(areaSet).sort();

    return {
      modelId,
      modelName,
      areas,
      linesByArea,
    };
  },

  getRoutingWithDAG: (modelId: string, modelName: string): ModelRoutingWithDAG => {
    const basicRouting = get().getRoutingForModel(modelId, modelName);
    const dagConfig = get().routingConfigs.get(modelId) || null;

    // Determine start and end areas from DAG
    let startAreas: string[] = [];
    let endAreas: string[] = [];
    let hasParallelPaths = false;

    if (dagConfig && dagConfig.steps.length > 0) {
      // Build successor map to find end nodes
      const successorCount = new Map<string, number>();
      for (const step of dagConfig.steps) {
        successorCount.set(step.areaCode, 0);
      }

      for (const step of dagConfig.steps) {
        for (const pred of step.predecessors) {
          successorCount.set(pred, (successorCount.get(pred) || 0) + 1);
        }
      }

      startAreas = dagConfig.steps
        .filter(s => s.predecessors.length === 0)
        .map(s => s.areaCode);

      endAreas = dagConfig.steps
        .filter(s => successorCount.get(s.areaCode) === 0)
        .map(s => s.areaCode);

      // Detect parallel paths: multiple areas with same predecessors
      const predSignatures = new Map<string, string[]>();
      for (const step of dagConfig.steps) {
        const sig = step.predecessors.sort().join(',');
        if (!predSignatures.has(sig)) {
          predSignatures.set(sig, []);
        }
        predSignatures.get(sig)!.push(step.areaCode);
      }

      hasParallelPaths = [...predSignatures.values()].some(areas => areas.length > 1);
    } else {
      // No DAG config - use basic routing (all areas are independent)
      startAreas = basicRouting.areas;
      endAreas = basicRouting.areas;
    }

    return {
      ...basicRouting,
      dagConfig,
      startAreas,
      endAreas,
      hasParallelPaths,
    };
  },

  getAreaColor: (areaCode: string): string => {
    const { areaCatalog } = get();
    const area = areaCatalog.find(a => a.code === areaCode);
    return area?.color || '#6b7280'; // Default gray
  },

  getAreaColors: (): Map<string, string> => {
    const { areaCatalog } = get();
    const colorMap = new Map<string, string>();

    for (const area of areaCatalog) {
      colorMap.set(area.code, area.color);
    }

    return colorMap;
  },
}));
