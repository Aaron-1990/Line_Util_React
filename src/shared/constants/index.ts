// ============================================
// CONSTANTES DE LA APLICACION
// ============================================

// ============================================
// CONFIGURACION DE NEGOCIO (VERDADERAS CONSTANTES)
// ============================================

export const UTILIZATION_THRESHOLDS = {
  LOW: 70,
  HIGH: 90,
} as const;

export const TIME_CONFIG = {
  SECONDS_PER_DAY: 82800,
  HOURS_PER_DAY: 23,
  SECONDS_PER_HOUR: 3600,
} as const;

// ============================================
// AREAS Y PROCESOS DE EJEMPLO (DEFAULT CATALOG)
// Nota: En produccion estas vendran de la base de datos (area_catalog)
// Estos son solo valores iniciales para primera instalacion
// ============================================

export const DEFAULT_PRODUCTION_AREAS = [
  { code: 'ICT', name: 'ICT', color: '#60a5fa' },
  { code: 'SMT', name: 'SMT', color: '#34d399' },
  { code: 'WAVE', name: 'Wave Solder', color: '#fbbf24' },
  { code: 'ASSEMBLY', name: 'Manual Assembly', color: '#f472b6' },
  { code: 'TEST', name: 'Testing', color: '#a78bfa' },
] as const;

export const DEFAULT_PROCESS_TYPES = ['Top', 'Bottom', 'HVDC', 'HVAC', 'GDB Subassy'] as const;

// ============================================
// CANALES IPC (ELECTRON)
// ============================================

export const IPC_CHANNELS = {
  // Production Lines
  LINES_GET_ALL: 'lines:get-all',
  LINES_GET_BY_ID: 'lines:get-by-id',
  LINES_CREATE: 'lines:create',
  LINES_UPDATE: 'lines:update',
  LINES_DELETE: 'lines:delete',
  LINES_UPDATE_POSITION: 'lines:update-position',
  LINES_UPDATE_CHANGEOVER_ENABLED: 'lines:update-changeover-enabled',  // Phase 5.6
  LINES_RESET_ALL_CHANGEOVER: 'lines:reset-all-changeover',  // Phase 5.6.2
  LINES_SET_ALL_CHANGEOVER: 'lines:set-all-changeover',  // Phase 5.6.2

  // Models
  MODELS_GET_ALL: 'models:get-all',
  MODELS_GET_BY_ID: 'models:get-by-id',
  MODELS_CREATE: 'models:create',
  MODELS_UPDATE: 'models:update',
  MODELS_DELETE: 'models:delete',

  // Model Processes
  PROCESSES_GET_BY_MODEL: 'processes:get-by-model',
  PROCESSES_CREATE: 'processes:create',
  PROCESSES_UPDATE: 'processes:update',
  PROCESSES_DELETE: 'processes:delete',

  // Volumes
  VOLUMES_GET_ALL: 'volumes:get-all',
  VOLUMES_GET_BY_YEAR: 'volumes:get-by-year',
  VOLUMES_CREATE: 'volumes:create',
  VOLUMES_UPDATE: 'volumes:update',
  VOLUMES_DELETE: 'volumes:delete',

  // Line-Model Assignments
  ASSIGNMENTS_GET_BY_LINE: 'assignments:get-by-line',
  ASSIGNMENTS_GET_BY_MODEL: 'assignments:get-by-model',
  ASSIGNMENTS_CREATE: 'assignments:create',
  ASSIGNMENTS_DELETE: 'assignments:delete',

  // Canvas Areas
  AREAS_GET_ALL: 'areas:get-all',
  AREAS_CREATE: 'areas:create',
  AREAS_UPDATE: 'areas:update',
  AREAS_DELETE: 'areas:delete',

  // Area Catalog (NEW - para gestion de catalogo)
  CATALOG_AREAS_GET_ALL: 'catalog:areas:get-all',
  CATALOG_AREAS_CREATE: 'catalog:areas:create',
  CATALOG_AREAS_UPDATE: 'catalog:areas:update',
  CATALOG_AREAS_DELETE: 'catalog:areas:delete',

  // Analysis
  ANALYSIS_RUN: 'analysis:run',
  ANALYSIS_GET_HISTORY: 'analysis:get-history',
  ANALYSIS_GET_BY_ID: 'analysis:get-by-id',

  // Excel Import/Export
  EXCEL_IMPORT: 'excel:import',
  EXCEL_EXPORT: 'excel:export',
  EXCEL_SELECT_FILE: 'excel:select-file',
  EXCEL_PARSE_FILE: 'excel:parse-file',
  EXCEL_VALIDATE_DATA: 'excel:validate-data',
  EXCEL_CHECK_EXISTING: 'excel:check-existing',

  // Python Bridge
  PYTHON_RUN_DISTRIBUTION: 'python:run-distribution',
  PYTHON_CHECK_STATUS: 'python:check-status',
} as const;

// ============================================
// RUTAS DE NAVEGACION
// ============================================

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  CANVAS: '/canvas',
  LINES: '/lines',
  MODELS: '/models',
  VOLUMES: '/volumes',
  ANALYSIS: '/analysis',
  SETTINGS: '/settings',
  CATALOG: '/catalog', // NEW - para gestion de catalogos
} as const;

// ============================================
// CONFIGURACION DE BASE DE DATOS
// ============================================

export const DB_CONFIG = {
  FILE_NAME: 'line-optimizer.db',
  VERSION: 1,
} as const;

// ============================================
// CONFIGURACION DEL CANVAS
// ============================================

export const CANVAS_CONFIG = {
  DEFAULT_ZOOM: 1,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2,
  GRID_SIZE: 20,
  SNAP_TO_GRID: true,
  NODE_WIDTH: 200,
  NODE_HEIGHT: 80,
  AREA_MIN_WIDTH: 300,
  AREA_MIN_HEIGHT: 200,
} as const;

// ============================================
// CONFIGURACION DE SINCRONIZACION
// ============================================

export const SYNC_CONFIG = {
  DEBOUNCE_MS: 500,
  AUTO_SAVE: true,
} as const;

// ============================================
// MENSAJES DE LA APLICACION
// ============================================

export const MESSAGES = {
  SUCCESS: {
    LINE_CREATED: 'Linea creada exitosamente',
    LINE_UPDATED: 'Linea actualizada exitosamente',
    LINE_DELETED: 'Linea eliminada exitosamente',
    MODEL_CREATED: 'Modelo creado exitosamente',
    MODEL_UPDATED: 'Modelo actualizado exitosamente',
    ANALYSIS_COMPLETE: 'Analisis completado exitosamente',
    EXCEL_IMPORTED: 'Datos importados desde Excel',
    EXCEL_EXPORTED: 'Datos exportados a Excel',
    AREA_CREATED: 'Area creada exitosamente',
    AREA_UPDATED: 'Area actualizada exitosamente',
  },
  ERROR: {
    LINE_NOT_FOUND: 'Linea no encontrada',
    MODEL_NOT_FOUND: 'Modelo no encontrado',
    INVALID_DATA: 'Datos invalidos',
    DB_ERROR: 'Error de base de datos',
    PYTHON_ERROR: 'Error al ejecutar analisis',
    EXCEL_ERROR: 'Error al procesar archivo Excel',
    AREA_IN_USE: 'No se puede eliminar: area en uso',
  },
  VALIDATION: {
    REQUIRED_FIELD: 'Este campo es requerido',
    INVALID_NUMBER: 'Debe ser un numero valido',
    INVALID_RANGE: 'Valor fuera de rango',
    DUPLICATE_NAME: 'Ya existe un elemento con ese nombre',
    DUPLICATE_CODE: 'Ya existe un area con ese codigo',
  },
} as const;

// Excel Import/Export (agregado en FASE 3)
export const EXCEL_CHANNELS = {
  SELECT_FILE: 'excel:select-file',
  PARSE_FILE: 'excel:parse-file',
  GET_SHEET_NAMES: 'excel:get-sheet-names',
  VALIDATE_DATA: 'excel:validate-data',
  IMPORT: 'excel:import',
  EXPORT: 'excel:export',
  // Multi-sheet import (Phase 3.4)
  DETECT_SHEETS: 'excel:detect-sheets',
  PARSE_MULTI_SHEET: 'excel:parse-multi-sheet',
  VALIDATE_MULTI_SHEET: 'excel:validate-multi-sheet',
  IMPORT_MULTI_SHEET: 'excel:import-multi-sheet',
} as const;

// Models V2 (for multi-sheet import)
export const MODELS_V2_CHANNELS = {
  GET_ALL: 'models-v2:get-all',
  GET_BY_NAME: 'models-v2:get-by-name',
  CREATE: 'models-v2:create',
  UPDATE: 'models-v2:update',
  DELETE: 'models-v2:delete',
  GET_ALL_NAMES: 'models-v2:get-all-names',
} as const;

// Line-Model Compatibilities
export const COMPATIBILITY_CHANNELS = {
  GET_ALL: 'compatibility:get-all',
  GET_BY_LINE: 'compatibility:get-by-line',
  GET_BY_MODEL: 'compatibility:get-by-model',
  CREATE: 'compatibility:create',
  UPDATE: 'compatibility:update',
  DELETE: 'compatibility:delete',
} as const;

// Product Volumes (multi-year)
export const PRODUCT_VOLUME_CHANNELS = {
  GET_ALL: 'product-volumes:get-all',
  GET_BY_YEAR: 'product-volumes:get-by-year',
  GET_BY_MODEL: 'product-volumes:get-by-model',
  GET_AVAILABLE_YEARS: 'product-volumes:get-available-years',
  GET_YEAR_RANGE: 'product-volumes:get-year-range',
  GET_YEAR_SUMMARY: 'product-volumes:get-year-summary',
  CREATE: 'product-volumes:create',
  UPDATE: 'product-volumes:update',
  DELETE: 'product-volumes:delete',
} as const;

// Optimization Analysis (Phase 4)
export const ANALYSIS_CHANNELS = {
  EXPORT_DATA: 'analysis:export-data',
  RUN_OPTIMIZATION: 'analysis:run-optimization',
  GET_RESULTS: 'analysis:get-results',
  GET_RESULTS_BY_YEAR: 'analysis:get-results-by-year',
  CANCEL_OPTIMIZATION: 'analysis:cancel-optimization',
} as const;

// Window Management (Phase 4.2)
export const WINDOW_CHANNELS = {
  OPEN_TIMELINE_WINDOW: 'window:open-timeline',
  GET_TIMELINE_DATA: 'window:get-timeline-data',
  CLOSE_TIMELINE_WINDOW: 'window:close-timeline',
  IS_TIMELINE_OPEN: 'window:is-timeline-open',
} as const;

// Timeline Window Events (Phase 4.2)
// These are events sent from main to renderer (not invoke channels)
export const TIMELINE_EVENTS = {
  DATA_UPDATED: 'timeline:data-updated',
  WINDOW_CLOSED: 'timeline:window-closed',
} as const;

// Model Area Routing (Phase 6.5)
export const ROUTING_CHANNELS = {
  GET_BY_MODEL: 'routing:get-by-model',
  SET_ROUTING: 'routing:set-routing',
  SET_PREDECESSORS: 'routing:set-predecessors',
  DELETE_ROUTING: 'routing:delete-routing',
  VALIDATE_DAG: 'routing:validate-dag',
  GET_TOPOLOGICAL_ORDER: 'routing:get-topological-order',
  HAS_ROUTING: 'routing:has-routing',
} as const;

// Changeover Matrix (Phase 5)
export const CHANGEOVER_CHANNELS = {
  // Global Settings
  GET_GLOBAL_DEFAULT: 'changeover:get-global-default',
  SET_GLOBAL_DEFAULT: 'changeover:set-global-default',
  GET_SMED_BENCHMARK: 'changeover:get-smed-benchmark',
  SET_SMED_BENCHMARK: 'changeover:set-smed-benchmark',

  // Phase 5.6: Toggle Controls
  GET_GLOBAL_ENABLED: 'changeover:get-global-enabled',
  SET_GLOBAL_ENABLED: 'changeover:set-global-enabled',

  // Family Defaults
  GET_ALL_FAMILY_DEFAULTS: 'changeover:get-all-family-defaults',
  GET_FAMILY_DEFAULT: 'changeover:get-family-default',
  SET_FAMILY_DEFAULT: 'changeover:set-family-default',
  DELETE_FAMILY_DEFAULT: 'changeover:delete-family-default',
  BULK_SET_FAMILY_DEFAULTS: 'changeover:bulk-set-family-defaults',

  // Line Overrides
  GET_LINE_OVERRIDES: 'changeover:get-line-overrides',
  GET_LINE_OVERRIDE: 'changeover:get-line-override',
  SET_LINE_OVERRIDE: 'changeover:set-line-override',
  DELETE_LINE_OVERRIDE: 'changeover:delete-line-override',
  DELETE_ALL_LINE_OVERRIDES: 'changeover:delete-all-line-overrides',
  BULK_SET_LINE_OVERRIDES: 'changeover:bulk-set-line-overrides',

  // Resolved Times
  GET_RESOLVED_TIMES: 'changeover:get-resolved-times',
  GET_RESOLVED_TIME: 'changeover:get-resolved-time',

  // Matrix
  GET_MATRIX: 'changeover:get-matrix',
  COPY_MATRIX: 'changeover:copy-matrix',

  // Calculation Method
  GET_CALCULATION_METHOD: 'changeover:get-calculation-method',
  SET_CALCULATION_METHOD: 'changeover:set-calculation-method',

  // Utilities
  GET_ALL_FAMILIES: 'changeover:get-all-families',
  GET_LINES_WITH_DATA: 'changeover:get-lines-with-data',
} as const;

// Plants (Phase 7: Multi-Plant Support)
export const PLANT_CHANNELS = {
  GET_ALL: 'plants:get-all',
  GET_BY_ID: 'plants:get-by-id',
  GET_DEFAULT: 'plants:get-default',
  CREATE: 'plants:create',
  UPDATE: 'plants:update',
  DELETE: 'plants:delete',
  SET_DEFAULT: 'plants:set-default',
} as const;

// Global Analysis (Phase 7: Multi-Plant Support)
export const GLOBAL_ANALYSIS_CHANNELS = {
  GET_SUMMARY: 'global-analysis:get-summary',
  RUN_ALL_PLANTS: 'global-analysis:run-all-plants',
  GET_PLANT_COMPARISON: 'global-analysis:get-comparison',
  EXPORT_REPORT: 'global-analysis:export-report',
} as const;
