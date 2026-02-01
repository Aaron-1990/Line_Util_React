// ============================================
// ROUTING TYPES - DAG-Based Model Area Routing
// Phase 6.5: Support for parallel process flows
// ============================================

/**
 * Dependency type for predecessor relationships
 * Currently only finish_to_start (standard manufacturing flow)
 * Future: could support start_to_start, finish_to_finish, etc.
 */
export type DependencyType = 'finish_to_start';

/**
 * Single routing step for a model's process flow
 * Represents one area in the model's DAG
 */
export interface ModelAreaRoutingStep {
  id: string;
  modelId: string;
  areaCode: string;
  sequence: number;               // Display order hint (not dependency order)
  isRequired: boolean;            // Can this step be skipped?
  expectedYield: number;          // Yield at this stage (0.0-1.0)
  volumeFraction: number;         // For split paths (0.0-1.0)
  predecessors: string[];         // Area codes that must complete before this one
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating/updating a routing step
 */
export interface ModelAreaRoutingStepInput {
  areaCode: string;
  sequence?: number;
  isRequired?: boolean;
  expectedYield?: number;
  volumeFraction?: number;
  predecessors?: string[];
}

/**
 * Complete routing configuration for a model
 * Represents the full DAG of process flow
 */
export interface ModelRoutingConfig {
  modelId: string;
  steps: ModelAreaRoutingStep[];
}

/**
 * Result of DAG validation (cycle/orphan detection)
 */
export interface RoutingValidationResult {
  isValid: boolean;
  hasCycle: boolean;
  cycleNodes?: string[];          // Area codes involved in cycle
  hasOrphans: boolean;
  orphanNodes?: string[];         // Area codes unreachable from any start
  startNodes: string[];           // Areas with no predecessors (entry points)
  endNodes: string[];             // Areas with no successors (exit points)
}

/**
 * Predecessor relationship stored in database
 */
export interface ModelAreaPredecessor {
  id: string;
  modelId: string;
  areaCode: string;
  predecessorAreaCode: string;
  dependencyType: DependencyType;
  createdAt: Date;
}

/**
 * Database row type for model_area_routing
 */
export interface ModelAreaRoutingRow {
  id: string;
  model_id: string;
  area_code: string;
  sequence: number;
  is_required: number;
  expected_yield: number;
  volume_fraction: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for model_area_predecessors
 */
export interface ModelAreaPredecessorRow {
  id: string;
  model_id: string;
  area_code: string;
  predecessor_area_code: string;
  dependency_type: string;
  created_at: string;
}
