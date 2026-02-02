// ============================================
// PLANT TYPES (Phase 7: Multi-Plant Support)
// ============================================

/**
 * Plant entity - top-level organizational unit
 */
export interface Plant {
  id: string;
  code: string;                    // Short code: "REY", "SLP", "ITX"
  name: string;                    // Full name: "Reynosa, Tamaulipas"
  region?: string;                 // Geographic region: "LATAM", "NA", "EMEA", "APAC"
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;        // ISO 3166-1 alpha-2: "MX", "US"
  timezone: string;                // IANA timezone
  currencyCode: string;
  defaultOperationsDays: number;
  defaultShiftsPerDay: number;
  defaultHoursPerShift: number;
  color?: string;                  // Hex color for UI: "#3B82F6"
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new plant
 */
export interface CreatePlantInput {
  code: string;
  name: string;
  region?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  timezone?: string;
  currencyCode?: string;
  defaultOperationsDays?: number;
  defaultShiftsPerDay?: number;
  defaultHoursPerShift?: number;
  color?: string;
  notes?: string;
}

/**
 * Input for updating an existing plant
 */
export interface UpdatePlantInput extends Partial<CreatePlantInput> {
  isDefault?: boolean;
  isActive?: boolean;
}

/**
 * Model ownership type
 * - exclusive: Model produced at only one plant
 * - shared: Model actively produced at multiple plants
 * - transferred: Model moved from launch plant to different primary
 */
export type OwnershipType = 'exclusive' | 'shared' | 'transferred';

/**
 * Extended product model with plant ownership fields
 */
export interface ProductModelWithPlant {
  id: string;
  name: string;
  customer: string;
  program: string;
  family: string;
  active: boolean;
  // Plant ownership fields (Phase 7)
  launchPlantId?: string;          // Historical: which plant first launched this model
  primaryPlantId?: string;         // Current: who manages ECNs, process docs
  ownershipType: OwnershipType;
  // Derived fields (from joins/aggregations)
  launchPlantCode?: string;
  launchPlantName?: string;
  primaryPlantCode?: string;
  primaryPlantName?: string;
  activePlantCount?: number;       // Number of plants currently producing this model
  totalGlobalVolume?: number;      // Sum of volumes across all plants
}

/**
 * Model-plant assignment for lifecycle tracking (Phase 7.2+)
 */
export interface ModelPlantAssignment {
  id: string;
  modelId: string;
  plantId: string;
  assignmentType: 'primary' | 'secondary' | 'overflow' | 'backup';
  status: 'proposed' | 'ramp_up' | 'active' | 'phasing_out' | 'inactive';
  assignmentStartDate?: string;
  productionStartDate?: string;
  phaseOutDate?: string;
  transferredFromPlantId?: string;
  transferReason?: 'capacity' | 'cost' | 'customer_request' | 'closure';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plant-specific volume allocation
 */
export interface PlantProductVolume {
  id: string;
  plantId: string;
  modelId: string;
  year: number;
  volume: number;
  operationsDays: number;
  source: 'manual' | 'excel_import' | 'corporate' | 'migration';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Derived fields
  dailyDemand?: number;
  plantCode?: string;
  plantName?: string;
  modelName?: string;
}

/**
 * Plant-specific routing (process flow)
 */
export interface PlantModelRouting {
  id: string;
  plantId: string;
  modelId: string;
  areaCode: string;
  sequence: number;
  isRequired: boolean;
  expectedYield: number;
  volumeFraction: number;
  predecessors?: string[];         // Array of predecessor area codes
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// GLOBAL ANALYSIS TYPES
// ============================================

/**
 * Summary for a single plant's utilization
 */
export interface PlantUtilizationSummary {
  plantId: string;
  plantCode: string;
  plantName: string;
  region?: string;
  lineCount: number;
  modelCount: number;
  areaCount: number;
  averageUtilization: number;
  maxUtilization: number;
  constraintArea?: string;
  headroomPercent: number;         // 100 - maxUtilization
  unfulfilledDemand: number;
}

/**
 * Alert for global analysis dashboard
 */
export interface GlobalAlert {
  type: 'critical' | 'warning' | 'info';
  plantId: string;
  plantCode: string;
  message: string;
  metric?: number;
  area?: string;
}

/**
 * Summary across all plants (global dashboard)
 */
export interface GlobalAnalysisSummary {
  totalPlants: number;
  totalLines: number;
  totalModels: number;
  networkAverageUtilization: number;
  totalUnfulfilledDemand: number;
  plantSummaries: PlantUtilizationSummary[];
  alerts: GlobalAlert[];
  analysisYear: number;
  generatedAt: Date;
}

/**
 * Cross-plant comparison data
 */
export interface PlantComparisonData {
  year: number;
  plants: {
    plantId: string;
    plantCode: string;
    plantName: string;
    utilization: number;
    lineCount: number;
    modelCount: number;
    constraintArea?: string;
  }[];
}

// ============================================
// IPC CHANNEL TYPES
// ============================================

/**
 * Response for plant list endpoint
 */
export interface PlantListResponse {
  plants: Plant[];
  defaultPlantId?: string;
}

/**
 * Request to set current plant context
 */
export interface SetCurrentPlantRequest {
  plantId: string;
}

/**
 * Request to run analysis for specific plant
 */
export interface PlantAnalysisRequest {
  plantId: string;
  selectedYears: number[];
}

/**
 * Request to run global analysis (all plants)
 */
export interface GlobalAnalysisRequest {
  selectedYears: number[];
  plantIds?: string[];             // Optional: specific plants (default: all active)
}
