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
// EXCEL IMPORT/EXPORT
// ============================================

export interface ExcelImportData {
  lines: ProductionLine[];
  models: ProductModel[];
  processes: ModelProcess[];
  volumes: ProductionVolume[];
  assignments: LineModelAssignment[];
}

export interface ExcelExportOptions {
  includeResults: boolean;
  includeCharts: boolean;
  includeRawData: boolean;
  fileName: string;
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
