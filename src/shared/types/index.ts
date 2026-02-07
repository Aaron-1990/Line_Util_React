// ============================================
// TIPOS DE DOMINIO - LINE OPTIMIZER
// ============================================

export type Area = 'ICT' | 'SMT' | 'WAVE' | 'ASSEMBLY' | 'TEST' | string;
export type ProcessType = 'Top' | 'Bottom' | 'HVDC' | 'HVAC' | 'GDB Subassy' | string;
export type LineType = 'shared' | 'dedicated';

// ============================================
// ENTIDADES CORE
// ============================================

export interface ProductionLine {
  id: string;
  name: string;
  area: Area;
  lineType: LineType;
  timeAvailableDaily: number;
  active: boolean;
  xPosition: number;
  yPosition: number;
  changeoverEnabled: boolean;  // Phase 5.6: Per-line changeover toggle
  changeoverExplicit: boolean; // Phase 5.6.1: True if user explicitly set toggle (override)
  plantId?: string;            // Phase 7: Plant this line belongs to
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
  plantId?: string;  // Phase 7: Plant this canvas area belongs to
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
  sequence: number;
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
  lineType?: string;  // Optional: 'shared' or 'dedicated'
  plant?: string;     // Phase 7: Optional plant code column
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
  lineType: LineType;
  row: number;
  plantCode?: string;  // Phase 7: Plant code from Excel
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

// ============================================
// MULTI-SHEET EXCEL IMPORT TYPES
// ============================================

/**
 * Column mapping for Models sheet (metadata columns only)
 * Year columns are detected dynamically
 */
export interface ModelColumnMapping {
  modelName: string;
  customer: string;
  program: string;
  family: string;
  active: string;
  // Legacy fields for single-year import (optional)
  annualVolume?: string;
  operationsDays?: string;
}

/**
 * Configuration for a detected year column pair
 * Each year has a volume column and an operations days column
 */
export interface YearColumnConfig {
  year: number;
  volumeColumnIndex: number;
  volumeColumnHeader: string;
  opsDaysColumnIndex: number;
  opsDaysColumnHeader: string;
}

/**
 * Column mapping for Compatibilities sheet
 */
export interface CompatibilityColumnMapping {
  lineName: string;
  modelName: string;
  cycleTime: string;
  efficiency: string;
  priority: string;
  plant?: string;     // Phase 7: Optional plant code column
}

/**
 * Validated model data (ready to import)
 * Volume data is now in ValidatedVolume (multi-year support)
 */
export interface ValidatedModel {
  name: string;
  customer: string;
  program: string;
  family: string;
  active: boolean;
  row: number;
  // Legacy fields for single-year import (optional)
  annualVolume?: number;
  operationsDays?: number;
}

/**
 * Validated volume data for a specific model-year pair
 */
export interface ValidatedVolume {
  modelName: string;
  year: number;
  volume: number;
  operationsDays: number;
  row: number;
  plantCode?: string;  // Phase 7: Plant code from Excel (for plant-specific volumes)
}

/**
 * Validated compatibility data (ready to import)
 */
export interface ValidatedCompatibility {
  lineName: string;
  modelName: string;
  cycleTime: number;
  efficiency: number;
  priority: number;
  row: number;
  plantCode?: string;  // Phase 7: Plant code from Excel
}

/**
 * Column mapping for Areas sheet
 */
export interface AreaColumnMapping {
  code: string;
  name?: string;
  sequence: string;
  color?: string;
  plant?: string;     // Phase 7: Optional plant code column
}

/**
 * Validated area data (ready to import)
 */
export interface ValidatedArea {
  code: string;
  name: string;
  sequence: number;
  color?: string;
  row: number;
  plantCode?: string;  // Phase 7: Plant code from Excel
}

/**
 * Validation result for Areas sheet
 */
export interface AreaValidationResult {
  validAreas: ValidatedArea[];
  errors: ValidationError[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  duplicates: string[];
}

// ============================================
// CHANGEOVER EXCEL IMPORT TYPES (Phase 5.3)
// ============================================

/**
 * Column mapping for Changeover sheet (family-to-family defaults)
 */
export interface ChangeoverColumnMapping {
  fromFamily: string;      // "From Family" column
  toFamily: string;        // "To Family" column
  changeoverMinutes: string; // "Changeover (min)" column
  plant?: string;          // Phase 7: Optional plant code column
}

/**
 * Validated changeover entry from Excel
 */
export interface ValidatedChangeover {
  fromFamily: string;
  toFamily: string;
  changeoverMinutes: number;
  row: number;
  plantCode?: string;  // Phase 7: Plant code from Excel
}

/**
 * Validation result for Changeover sheet
 */
export interface ChangeoverValidationResult {
  validChangeovers: ValidatedChangeover[];
  errors: ValidationError[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    uniqueFamilies: number;
  };
  duplicates: string[];  // "FamilyA -> FamilyB" format
}

/**
 * Sheet detection result - which sheets are available
 */
export interface DetectedSheets {
  areas?: {
    sheetName: string;
    rowCount: number;
    headers: string[];
  };
  lines?: {
    sheetName: string;
    rowCount: number;
    headers: string[];
  };
  models?: {
    sheetName: string;
    rowCount: number;
    headers: string[];
  };
  compatibilities?: {
    sheetName: string;
    rowCount: number;
    headers: string[];
  };
  changeover?: {
    sheetName: string;
    rowCount: number;
    headers: string[];
  };
}

/**
 * Parsed data from a single sheet
 */
export interface SheetParsedData<T> {
  rows: ExcelRow[];
  headers: string[];
  sheetName: string;
  mapping: T;
  rowCount: number;
}

/**
 * Parsed data from Models sheet with dynamic year columns
 */
export interface ModelSheetParsedData extends SheetParsedData<ModelColumnMapping> {
  detectedYears: YearColumnConfig[];
}

/**
 * Multi-sheet parsed data structure
 */
export interface MultiSheetParsedData {
  areas?: SheetParsedData<AreaColumnMapping>;
  lines?: SheetParsedData<ColumnMapping>;
  models?: ModelSheetParsedData;
  compatibilities?: SheetParsedData<CompatibilityColumnMapping>;
  changeover?: SheetParsedData<ChangeoverColumnMapping>;
  availableSheets: string[];
}

/**
 * Validation result for Models sheet
 */
export interface ModelValidationResult {
  validModels: ValidatedModel[];
  errors: ValidationError[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  duplicates: string[];
}

/**
 * Validation result for Compatibilities sheet
 */
export interface CompatibilityValidationResult {
  validCompatibilities: ValidatedCompatibility[];
  errors: ValidationError[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  duplicates: string[];
}

/**
 * Validation result for Volumes (extracted from Models sheet year columns)
 */
export interface VolumeValidationResult {
  validVolumes: ValidatedVolume[];
  errors: ValidationError[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    yearsDetected: number[];
    yearRange: { min: number; max: number } | null;
  };
}

/**
 * Phase 7.3: Plant validation status for auto-creation
 */
export interface PlantValidationStatus {
  code: string;
  exists: boolean;
  existingName?: string;  // If exists, the name in database
}

/**
 * Multi-sheet validation result (includes cross-sheet validation)
 */
export interface MultiSheetValidationResult {
  areas?: AreaValidationResult;
  lines?: ValidationResult;
  models?: ModelValidationResult;
  compatibilities?: CompatibilityValidationResult;
  volumes?: VolumeValidationResult;
  changeover?: ChangeoverValidationResult;
  crossSheetErrors: string[];
  isValid: boolean;
  // Phase 7.2: Detected plant codes from Excel (for validation against database)
  detectedPlantCodes?: string[];
  // Phase 7.3: Plant validation status for auto-creation UI
  plantValidation?: PlantValidationStatus[];
}

/**
 * Import result for a single entity type
 */
export interface EntityImportResult {
  created: number;
  updated: number;
  unchanged: number;  // Smart update: items that existed but had no changes
  errors: number;
}

/**
 * Multi-sheet import result
 */
export interface MultiSheetImportResult {
  plants?: EntityImportResult;  // Phase 7.3: Auto-created plants
  areas?: EntityImportResult;
  lines?: EntityImportResult;
  models?: EntityImportResult;
  compatibilities?: EntityImportResult;
  volumes?: EntityImportResult & {
    yearRange?: { min: number; max: number };
  };
  changeover?: EntityImportResult;
  totalTime: number;
  success: boolean;
}

// ============================================
// PYTHON OPTIMIZATION ANALYSIS TYPES (Phase 4)
// ============================================

/**
 * Input data structure for Python optimization algorithm
 * This is exported from SQLite and passed to main_5.py
 */
export interface OptimizationInputData {
  lines: {
    id: string;
    name: string;
    area: string;
    lineType: 'shared' | 'dedicated';  // shared can shift work, dedicated cannot
    timeAvailableDaily: number;  // seconds
  }[];
  models: {
    id: string;
    name: string;
    customer: string;
    program: string;
    family: string;
  }[];
  volumes: {
    modelId: string;
    modelName: string;
    year: number;
    volume: number;
    operationsDays: number;
  }[];
  compatibilities: {
    lineId: string;
    lineName: string;
    modelId: string;
    modelName: string;
    cycleTime: number;      // seconds per unit
    efficiency: number;     // percentage (0-100)
    priority: number;       // lower = higher priority
  }[];
  selectedYears: number[];
  // Phase 5: Changeover data
  changeover?: {
    globalDefaultMinutes: number;
    calculationMethod: 'probability_weighted' | 'simple_average' | 'worst_case';
    // Phase 5.6: Toggle states
    globalEnabled: boolean;  // Master toggle for changeover calculation
    lineToggles: { [lineId: string]: { enabled: boolean; explicit: boolean } };  // Per-line toggle with explicit flag
    familyDefaults: {
      fromFamily: string;
      toFamily: string;
      changeoverMinutes: number;
    }[];
    lineOverrides: {
      lineId: string;
      fromModelId: string;
      toModelId: string;
      changeoverMinutes: number;
    }[];
  };
}

/**
 * A single model assignment to a line
 */
export interface ModelAssignment {
  modelId: string;
  modelName: string;
  allocatedUnitsDaily: number;
  demandUnitsDaily: number;
  timeRequiredSeconds: number;
  cycleTime: number;
  efficiency: number;
  priority: number;
  fulfillmentPercent: number;  // How much of demand is fulfilled
}

/**
 * Utilization result for a single line
 */
export interface LineUtilizationResult {
  lineId: string;
  lineName: string;
  area: string;
  lineType: 'shared' | 'dedicated';  // For hierarchical display
  timeAvailableDaily: number;
  timeUsedDaily: number;
  utilizationPercent: number;
  assignments: ModelAssignment[];
  // Phase 5: Changeover impact (optional for backwards compatibility)
  changeover?: {
    timeUsedChangeover: number;        // seconds spent on changeovers
    estimatedChangeoverCount: number;  // number of changeovers per day
    expectedChangeoverTime: number;    // expected time per changeover (seconds)
    utilizationWithChangeover: number; // utilization % including changeover
    changeoverImpactPercent: number;   // percentage points lost to changeover
    methodUsed: string;                // calculation method used
  };
}

/**
 * Unfulfilled demand for a model in an area
 */
export interface UnfulfilledDemand {
  modelId: string;
  modelName: string;
  area: string;
  unfulfilledUnitsDaily: number;
  unfulfilledUnitsYearly: number;
  demandUnitsDaily: number;
  fulfillmentPercent: number;
}

/**
 * Summary for a single area
 */
export interface AreaSummary {
  area: string;
  totalDemandUnitsDaily: number;
  totalAllocatedUnitsDaily: number;
  totalUnfulfilledUnitsDaily: number;
  fulfillmentPercent: number;
  averageUtilization: number;
  linesAtCapacity: number;  // lines >= 95%
  totalLines: number;
  isSystemConstraint: boolean;
}

/**
 * Constrained line details for enhanced bottleneck visibility
 */
export interface ConstrainedLineDetail {
  lineId: string;
  lineName: string;
  lineType: 'shared' | 'dedicated';
  utilizationPercent: number;
  unfulfilledUnitsDaily: number;
  topUnfulfilledModels: {
    modelId: string;
    modelName: string;
    unfulfilledUnits: number;
    percentOfLineUnfulfilled: number;
  }[];
}

/**
 * System constraint (bottleneck) information
 * Enhanced to distinguish dedicated vs shared line bottlenecks
 */
export interface SystemConstraint {
  area: string;
  reason: 'unfulfilled_demand' | 'highest_utilization';
  utilizationPercent: number;
  unfulfilledUnitsDaily: number;
  // Enhanced fields for dedicated line visibility
  constraintType: 'dedicated_line_bottleneck' | 'shared_capacity_constraint' | 'mixed_constraint';
  constrainedLines: ConstrainedLineDetail[];
  constraintReason: string;  // Human-readable explanation
}

/**
 * Summary statistics for a year's optimization
 */
export interface YearSummary {
  totalLines: number;
  totalAreas: number;
  averageUtilization: number;
  overloadedLines: number;      // >100%
  balancedLines: number;        // 70-100%
  underutilizedLines: number;   // <70%
  unassignedModels: number;
  totalDemandUnits: number;
  totalAllocatedUnits: number;
  demandFulfillmentPercent: number;
  // New unfulfilled demand fields
  totalUnfulfilledUnitsDaily: number;
  totalUnfulfilledUnitsYearly: number;
  overallFulfillmentPercent: number;
  systemConstraintArea: string | null;
  operationsDays?: number;  // Days used for yearly calculations
}

/**
 * Optimization results for a single year
 */
export interface YearOptimizationResult {
  year: number;
  lines: LineUtilizationResult[];
  summary: YearSummary;
  // New fields for unfulfilled demand tracking
  unfulfilledDemand: UnfulfilledDemand[];
  areaSummary: AreaSummary[];
  systemConstraint: SystemConstraint | null;
}

/**
 * Complete optimization results (all years)
 */
export interface OptimizationResult {
  metadata: {
    version: string;
    timestamp: string;
    inputYears: number[];
    executionTimeMs: number;
  };
  yearResults: YearOptimizationResult[];
  overallSummary: {
    yearsProcessed: number;
    averageUtilizationAllYears: number;
    totalLinesAnalyzed: number;
  };
}

/**
 * Progress update during optimization
 */
export interface OptimizationProgress {
  status: 'starting' | 'processing' | 'complete' | 'error';
  currentYear?: number;
  currentYearIndex?: number;
  totalYears?: number;
  message?: string;
  percent?: number;
}

/**
 * Request to run optimization
 */
export interface RunOptimizationRequest {
  selectedYears: number[];
  mode?: 'json' | 'db';  // Output mode
  plantId?: string;      // Phase 7: Optional plant ID for multi-plant support
}

// ============================================
// CHANGEOVER MATRIX TYPES (Phase 5)
// ============================================

// Re-export all changeover types from dedicated module
export * from './changeover';

// Re-export all routing types from dedicated module (Phase 6.5)
export * from './routing';

// Re-export all plant types from dedicated module (Phase 7)
export * from './plant';

// Re-export all shape catalog types from dedicated module (Phase 7.5)
export * from './shape-catalog';

// Re-export all canvas object types from dedicated module (Phase 7.5)
export * from './canvas-object';

// Re-export all canvas tool types from dedicated module (Phase 7.5)
export * from './canvas-tool';

// Re-export all validation types from dedicated module (Optimization Results Validation)
export * from './validation';

// Re-export all project types from dedicated module (Phase 8.0: Project Files Foundation)
export * from './project';
