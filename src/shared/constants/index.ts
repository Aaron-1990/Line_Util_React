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
