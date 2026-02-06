// ============================================
// OPTIMIZATION RESULTS VALIDATION TYPES
// Phase: Optimization Results Validation
// Framework: Híbrido v2.0
// Designer: Aaron Zapata
// Date: 2026-02-06
// ============================================

/**
 * Validation status based on coverage percentage thresholds
 *
 * Coverage = (distributed / volume) × 100
 *
 * Status definitions:
 * - ok: ±1% of volume (99-101%)
 * - over: >1% above volume (>101%) - informational, not error
 * - under: 5-15% below volume (85-95%) - warning
 * - alert: 15-30% below volume (70-85%) - needs attention
 * - critical: >30% below volume (<70%) - immediate action required
 */
export type ValidationStatus =
  | 'ok'       // ±1% of volume
  | 'over'     // >1% above volume (info, not error)
  | 'under'    // 5-15% below volume (warning)
  | 'alert'    // 15-30% below volume (needs attention)
  | 'critical'; // >30% below volume (immediate action)

/**
 * Validation thresholds for determining status
 * Based on coverage ratio (distributed / volume)
 *
 * Example:
 * - 0.99 = 99% coverage
 * - 1.01 = 101% coverage
 */
export interface ValidationThresholds {
  ok: { min: number; max: number };      // ±1% of volume
  over: { min: number };                 // >1% above volume
  under: { min: number; max: number };   // 5-15% below volume
  alert: { min: number; max: number };   // 15-30% below volume
  critical: { max: number };             // >30% below volume
}

/**
 * Validation data for a single model within an area
 *
 * This represents one row in the validation section of the results table
 */
export interface ModelValidationRow {
  modelId: string;
  modelName: string;
  distributedUnits: number;      // Sum of allocated units across all lines in area
  volumeUnitsAnnual: number;     // From product_volumes table
  coveragePercent: number;       // (distributed / volume) × 100
  status: ValidationStatus;      // Based on thresholds
  deltaUnits: number;            // distributed - volume (can be negative)
}

/**
 * Validation summary for an entire area
 *
 * Groups all model validations for a specific area-year combination
 */
export interface AreaValidationSummary {
  area: string;
  year: number;
  models: ModelValidationRow[];  // Validation rows for each model in area
  totalDistributed: number;      // Sum of all distributed units
  totalVolume: number;           // Sum of all volumes
  totalDelta: number;            // totalDistributed - totalVolume
  overallCoverage: number;       // (totalDistributed / totalVolume) × 100
}
