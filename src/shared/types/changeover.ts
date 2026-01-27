// ============================================
// CHANGEOVER TIME MANAGEMENT TYPES
// Phase 5: Model Changeover Matrix
// ============================================

// ============================================
// CALCULATION METHOD TYPES
// ============================================

/**
 * Available changeover calculation methods
 * Strategy Pattern - each method is a separate implementation
 */
export type ChangeoverMethodId =
  | 'probability_weighted'  // Method 1: Probability-weighted heuristic (implemented)
  | 'tsp_optimal'          // Method 2: TSP optimal sequence (future)
  | 'worst_case'           // Method 3: Worst-case conservative (future)
  | 'simple_average';      // Method 4: Simple average fallback (implemented)

/**
 * Metadata about a changeover calculation method (for UI display)
 */
export interface ChangeoverMethodMetadata {
  id: ChangeoverMethodId;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  bestFor: string;
  implemented: boolean;
  requiresHistoricalData: boolean;
}

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * User preference for changeover settings
 */
export interface ChangeoverPreference {
  id: string;
  key: string;
  value: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Family-to-family default changeover time
 * Used when no line-specific override exists
 */
export interface FamilyChangeoverDefault {
  id: string;
  fromFamily: string;
  toFamily: string;
  changeoverMinutes: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Line-specific changeover time override
 * Sparse storage - only stores exceptions to family defaults
 */
export interface LineChangeoverOverride {
  id: string;
  lineId: string;
  fromModelId: string;
  toModelId: string;
  changeoverMinutes: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved changeover time with source information
 */
export interface ResolvedChangeoverTime {
  fromModelId: string;
  fromModelName: string;
  fromFamily: string;
  toModelId: string;
  toModelName: string;
  toFamily: string;
  changeoverMinutes: number;
  source: 'same_model' | 'line_override' | 'family_default' | 'global_default';
}

// ============================================
// UI / MATRIX DISPLAY TYPES
// ============================================

/**
 * Model info for matrix display
 */
export interface MatrixModel {
  id: string;
  name: string;
  family: string;
}

/**
 * Family group for collapsed view
 */
export interface MatrixFamily {
  name: string;
  models: MatrixModel[];
  modelCount: number;
}

/**
 * Cell data in the changeover matrix
 */
export interface ChangeoverMatrixCell {
  fromModelId: string;
  toModelId: string;
  changeoverMinutes: number;
  source: 'same_model' | 'line_override' | 'family_default' | 'global_default';
  isDefault: boolean;
  exceedsBenchmark: boolean; // > 10 min (SMED warning)
}

/**
 * Complete changeover matrix for a line
 */
export interface ChangeoverMatrix {
  lineId: string;
  lineName: string;
  area: string;
  models: MatrixModel[];
  families: MatrixFamily[];
  cells: ChangeoverMatrixCell[][];  // 2D array [fromIndex][toIndex]
  globalDefault: number;
  smedBenchmark: number; // Default: 10 minutes
  stats: {
    totalCells: number;
    filledCells: number;
    defaultCells: number;
    overrideCells: number;
    exceedsBenchmarkCount: number;
  };
}

// ============================================
// CALCULATION INPUT/OUTPUT TYPES
// ============================================

/**
 * Model assignment info for changeover calculation
 */
export interface ChangeoverModelInput {
  modelId: string;
  modelName: string;
  family: string;
  allocatedUnitsDaily: number;
  demandUnitsDaily: number;
}

/**
 * Transition analysis for SMED prioritization
 */
export interface TransitionAnalysis {
  fromModelId: string;
  fromModelName: string;
  toModelId: string;
  toModelName: string;
  changeoverMinutes: number;
  probability: number;         // P[from] × P[to]
  weightedContribution: number; // probability × changeoverMinutes
  percentOfTotal: number;      // contribution / sum of all contributions
}

/**
 * Result of changeover calculation for a single line
 */
export interface ChangeoverCalculationResult {
  lineId: string;
  lineName: string;
  area: string;
  methodUsed: ChangeoverMethodId;

  // Time breakdown
  timeUsedProduction: number;      // Seconds for actual production
  timeUsedChangeover: number;      // Seconds for changeovers
  totalTimeUsed: number;           // Production + Changeover
  timeAvailable: number;           // Total available time

  // Utilization metrics
  utilizationProductionOnly: number;    // % without changeover
  utilizationWithChangeover: number;    // % including changeover
  changeoverImpactPercent: number;      // Percentage points lost to changeover

  // Changeover details
  estimatedChangeoverCount: number;     // Number of changeovers per day
  expectedChangeoverTime: number;       // Expected time per changeover (probability-weighted)
  worstCaseChangeoverTime: number;      // Maximum changeover in matrix

  // SMED Analysis
  topCostlyTransitions: TransitionAnalysis[];
  hhi: number;                          // Herfindahl-Hirschman Index (concentration)

  // Warnings
  warnings: string[];
}

/**
 * Aggregate changeover results for all lines in a year
 */
export interface YearChangeoverSummary {
  year: number;
  methodUsed: ChangeoverMethodId;
  lineResults: ChangeoverCalculationResult[];

  // Aggregate statistics
  totalTimeUsedChangeover: number;
  averageChangeoverImpact: number;      // Average % points lost across all lines
  linesAffectedByChangeover: number;    // Lines where changeover > 0

  // System-level impact
  systemUtilizationWithoutChangeover: number;
  systemUtilizationWithChangeover: number;
}

// ============================================
// EXCEL IMPORT TYPES
// ============================================

/**
 * Column mapping for Changeover Defaults sheet
 */
export interface ChangeoverDefaultsColumnMapping {
  fromFamily: string;
  toFamily: string;
  changeoverMinutes: string;
  notes?: string;
}

/**
 * Column mapping for Changeover Overrides sheet
 */
export interface ChangeoverOverridesColumnMapping {
  lineName: string;
  fromModel: string;
  toModel: string;
  changeoverMinutes: string;
  notes?: string;
}

/**
 * Validated changeover default (ready to import)
 */
export interface ValidatedChangeoverDefault {
  fromFamily: string;
  toFamily: string;
  changeoverMinutes: number;
  notes?: string;
  row: number;
}

/**
 * Validated changeover override (ready to import)
 */
export interface ValidatedChangeoverOverride {
  lineName: string;
  fromModel: string;
  toModel: string;
  changeoverMinutes: number;
  notes?: string;
  row: number;
}

/**
 * Validation result for Changeover Defaults sheet
 */
export interface ChangeoverDefaultsValidationResult {
  validDefaults: ValidatedChangeoverDefault[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value: unknown;
  }>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  duplicates: string[];
}

/**
 * Validation result for Changeover Overrides sheet
 */
export interface ChangeoverOverridesValidationResult {
  validOverrides: ValidatedChangeoverOverride[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value: unknown;
  }>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  duplicates: string[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request to get changeover matrix for a line
 */
export interface GetChangeoverMatrixRequest {
  lineId: string;
}

/**
 * Request to update a single changeover time
 */
export interface UpdateChangeoverTimeRequest {
  lineId: string;
  fromModelId: string;
  toModelId: string;
  changeoverMinutes: number;
  notes?: string;
}

/**
 * Request to set family default
 */
export interface SetFamilyDefaultRequest {
  fromFamily: string;
  toFamily: string;
  changeoverMinutes: number;
  notes?: string;
}

/**
 * Request to copy changeover matrix from one line to another
 */
export interface CopyChangeoverMatrixRequest {
  sourceLineId: string;
  targetLineId: string;
}

/**
 * Request to calculate changeover impact
 */
export interface CalculateChangeoverRequest {
  lineId: string;
  assignedModels: ChangeoverModelInput[];
  methodId?: ChangeoverMethodId;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default values for changeover settings
 */
export const CHANGEOVER_DEFAULTS = {
  GLOBAL_DEFAULT_MINUTES: 30,
  SMED_BENCHMARK_MINUTES: 10,
  MIN_CHANGEOVER_MINUTES: 0,
  MAX_CHANGEOVER_MINUTES: 480, // 8 hours (sanity check)
} as const;

/**
 * Validation messages
 */
export const CHANGEOVER_MESSAGES = {
  DIAGONAL_MUST_BE_ZERO: 'Same model changeover must be 0 minutes',
  NO_NEGATIVE_VALUES: 'Changeover time cannot be negative',
  EXCEEDS_MAX: 'Changeover time exceeds maximum (8 hours)',
  EXCEEDS_BENCHMARK: 'Changeover time exceeds SMED benchmark (10 min)',
  ASYMMETRIC_WARNING: 'Large asymmetry detected between A→B and B→A',
} as const;
