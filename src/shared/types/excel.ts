// ============================================
// EXCEL IMPORT/EXPORT TYPES
// Tipos compartidos para features de Excel
// ============================================

// ============================================
// IMPORT MODES
// ============================================

/**
 * Import Mode determina comportamiento con lineas existentes
 * 
 * - CREATE: Solo crear nuevas (skip duplicados)
 * - UPDATE: Solo actualizar existentes (skip no-existentes)
 * - MERGE: Update si existe, create si no (recomendado)
 */
export type ImportMode = 'create' | 'update' | 'merge';

// ============================================
// EXCEL ROW (Raw data)
// ============================================

export interface ExcelRow {
  [key: string]: unknown;
  __rowNum__?: number;
}

// ============================================
// VALIDATION
// ============================================

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidatedLine {
  name: string;
  area: string;
  timeAvailableDaily: number;
  efficiency: number;
  row?: number; // Row number del Excel
}

export interface ValidationResult {
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  validLines: ValidatedLine[];
  errors: ValidationError[];
  duplicates: string[];
  existingNames?: string[]; // Nombres que ya existen en DB
}

// ============================================
// IMPORT OPTIONS & RESULTS
// ============================================

export interface ExcelImportOptions {
  mode: ImportMode;
  validateDuplicates: boolean;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SkippedLine {
  line: ValidatedLine;
  reason: 'duplicate' | 'not-found' | 'error';
  details?: string;
}

// ============================================
// COLUMN MAPPING
// ============================================

export interface ColumnMapping {
  name: string;
  area: string;
  timeAvailableHours: string;
  efficiencyPercent: string;
}

// ============================================
// FILE SELECTION
// ============================================

export interface SelectedFile {
  path: string;
  name: string;
}
