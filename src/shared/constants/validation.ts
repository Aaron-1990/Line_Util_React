// ============================================
// VALIDATION CONSTANTS
// Phase: Optimization Results Validation
// Framework: Híbrido v2.0
// Designer: Aaron Zapata
// Date: 2026-02-06
// ============================================

import { ValidationThresholds } from '../types/validation';

/**
 * Default validation thresholds
 *
 * Based on manufacturing best practices and TPS (Toyota Production System) tolerances
 *
 * Rationale:
 * - ok (±1%): Standard tolerance for production planning
 * - over (>1%): Capacity available, informational only
 * - under (5-15%): Minor variance, requires monitoring
 * - alert (15-30%): Significant variance, action planning needed
 * - critical (>30%): Major capacity gap, immediate intervention required
 */
export const DEFAULT_VALIDATION_THRESHOLDS: ValidationThresholds = {
  ok: { min: 0.99, max: 1.01 },        // ±1%
  over: { min: 1.01 },                 // >1% above
  under: { min: 0.85, max: 0.95 },     // 5-15% below
  alert: { min: 0.70, max: 0.85 },     // 15-30% below
  critical: { max: 0.70 }              // >30% below
};

/**
 * Human-readable labels for validation status
 *
 * Uses emoji for quick visual identification
 */
export const VALIDATION_STATUS_LABELS: Record<string, string> = {
  ok: '✅ OK',
  over: '⬆️ OVER',
  under: '⚠️ UNDER',
  alert: '🔴 ALERT',
  critical: '🚨 CRITICAL'
};

/**
 * Color codes for validation status
 *
 * Uses Tailwind color palette for consistency
 */
export const VALIDATION_STATUS_COLORS: Record<string, string> = {
  ok: '#10b981',      // green-500
  over: '#3b82f6',    // blue-500 (informational, not error)
  under: '#f59e0b',   // amber-500 (warning)
  alert: '#ef4444',   // red-500 (error)
  critical: '#991b1b' // red-900 (critical)
};

/**
 * Row labels for validation section
 *
 * These appear in the leftmost column of the validation rows
 */
export const VALIDATION_ROW_LABELS = {
  DISTRIBUTED: 'Σ DISTRIBUIDO',
  VOLUME: 'VOLUMEN (BD)',
  COVERAGE: 'COBERTURA',
  STATUS: 'ESTADO'
} as const;
