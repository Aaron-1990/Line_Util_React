// ============================================
// TIPOS DE DOMINIO - LINE OPTIMIZER
// ============================================

export type Area = 'ICT' | 'SMT' | 'WAVE' | 'ASSEMBLY' | 'TEST' | string;
export type ProcessType = 'Top' | 'Bottom' | 'HVDC' | 'HVAC' | 'GDB Subassy' | string;

// ============================================
// ENTIDADES CORE
// ============================================

export interface ProductionLine {
  id: string;
  name: string;
  area: Area;
  timeAvailableDaily: number;
  efficiency: number;
  active: boolean;
  xPosition: number;
  yPosition: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelProcess {
  id: string;
  modelId: string;
  name: ProcessType;
  cycleTime: number;
  quantityPerProduct: number;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductModel {
  id: string;
  family: string;
  name: string;
  bu: string;
  area: Area;
  priority: number;
  efficiency: number;
  compatibleLines: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineModelAssignment {
  id: string;
  lineId: string;
  modelId: string;
  createdAt: Date;
}

export interface ProductionVolume {
  id: string;
  family: string;
  daysOfOperation: number;
  year: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasArea {
  id: string;
  name: string;
  areaCode: Area;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ANALYSIS & RESULTS
// ============================================

export interface AssignedModel {
  modelId: string;
  familyName: string;
  annualPieces: number;
  annualSeconds: number;
  dailyPieces: number;
}

export interface DistributionResult {
  lineId: string;
  lineName: string;
  area: Area;
  timeUsed: number;
  timeAvailable: number;
  utilizationPercent: number;
  assignedModels: AssignedModel[];
}

export interface DistributionSummary {
  totalLines: number;
  underutilizedLines: number;
  balancedLines: number;
  overutilizedLines: number;
  averageUtilization: number;
}

export interface DistributionAnalysis {
  id: string;
  year: number;
  results: DistributionResult[];
  summary: DistributionSummary;
  createdAt: Date;
}

export interface DistributionAnalysisInput {
  year: number;
  plantId?: string;
}

// ============================================
// API & STATE
// ============================================

export type AppStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CanvasConfig {
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  snapToGrid: boolean;
}

// ============================================
// CATALOG MANAGEMENT
// ============================================

export interface AreaCatalogItem {
  id: string;
  code: string;
  name: string;
  color: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// EXCEL IMPORT/EXPORT - TIPOS COMPLETOS
// ============================================

/**
 * Modo de importacion
 * - create: Solo crear nuevas lineas, skip duplicados
 * - update: Solo actualizar existentes, skip nuevas
 * - merge: Actualizar si existe, crear si no (default)
 */
export type ImportMode = 'create' | 'update' | 'merge';

/**
 * Fila individual parseada de Excel
 */
export interface ExcelRow {
  __rowNum__?: number;
  [key: string]: unknown;
}

/**
 * Mapeo de columnas Excel a campos del sistema
 */
export interface ColumnMapping {
  name: string;
  area: string;
  timeAvailableHours: string;
  efficiencyPercent: string;
}

/**
 * Resultado del parseo de archivo Excel
 */
export interface ParsedExcelData {
  rows: ExcelRow[];
  headers: string[];
  sheetName: string;
  suggestedMapping: {
    name: string | null;
    area: string | null;
    timeAvailableHours: string | null;
    efficiencyPercent: string | null;
  };
}

/**
 * Error de validacion en una fila
 */
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: unknown;
}

/**
 * Linea validada lista para importar
 */
export interface ValidatedLine {
  name: string;
  area: string;
  timeAvailableDaily: number;
  efficiency: number;
  row: number;
}

/**
 * Resultado de validacion de batch
 */
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
}

/**
 * Opciones de importacion
 */
export interface ExcelImportOptions {
  mode: ImportMode;
  validateDuplicates: boolean;
}

/**
 * Linea que fue skipped durante import
 */
export interface SkippedLine {
  row: number;
  name: string;
  reason: 'duplicate' | 'not_found' | 'validation_error';
  message: string;
}

/**
 * Resultado de importacion
 */
export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    name: string;
    error: string;
  }>;
  skippedLines: SkippedLine[];
}

/**
 * Archivo seleccionado para import
 */
export interface SelectedFile {
  file: File;
  name: string;
  size: number;
}

/**
 * Opciones de export Excel
 */
export interface ExcelExportOptions {
  includeResults: boolean;
  includeCharts: boolean;
  includeRawData: boolean;
  fileName: string;
}

/**
 * Data completa de import Excel (todos los tipos de entidades)
 */
export interface ExcelImportData {
  lines: ProductionLine[];
  models: ProductModel[];
  processes: ModelProcess[];
  volumes: ProductionVolume[];
  assignments: LineModelAssignment[];
}
