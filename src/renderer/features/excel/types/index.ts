// ============================================
// EXCEL FEATURE - SHARED TYPES
// ============================================

export interface ExcelImportRow {
  rowNumber: number;
  name?: string;
  area?: string;
  timeAvailableHours?: number;
  efficiencyPercent?: number;
}

export interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  importedLines?: string[];
}

export interface ExcelParseResult {
  rows: ExcelImportRow[];
  errors: ValidationError[];
}

export interface ColumnMapping {
  name: string | null;
  area: string | null;
  timeAvailableHours: string | null;
  efficiencyPercent: string | null;
}

export interface ExportOptions {
  includeInactive?: boolean;
  filterByArea?: string;
  format?: 'xlsx' | 'csv';
}

export type ImportStep = 
  | 'select-file' 
  | 'preview' 
  | 'mapping' 
  | 'validate' 
  | 'import' 
  | 'complete';
