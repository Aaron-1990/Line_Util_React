// ============================================
// DATA EXPORTER SERVICE
// Exports data from SQLite to JSON for Python optimization
// Phase 7: Multi-plant support - filter by plantId
// Phase 7.5: Unified canvas_objects (migration 017)
// ============================================

import Database from 'better-sqlite3';
import { SQLiteProductModelV2Repository } from '../../database/repositories/SQLiteProductModelV2Repository';
import { SQLiteProductVolumeRepository } from '../../database/repositories/SQLiteProductVolumeRepository';
import { SQLiteChangeoverRepository } from '../../database/repositories/SQLiteChangeoverRepository';
import { SQLitePlantRepository } from '../../database/repositories/SQLitePlantRepository';
import { OptimizationInputData } from '@shared/types';

// Type for process objects with properties (from unified structure)
interface ProcessObjectWithProps {
  id: string;
  name: string;
  area: string;
  lineType: 'shared' | 'dedicated';
  timeAvailableDaily: number;
  changeoverEnabled: boolean;
  changeoverExplicit: boolean;
}

// Type for compatibility data
interface CompatibilityData {
  canvasObjectId: string;
  modelId: string;
  cycleTime: number;
  efficiency: number;
  priority: number;
}

export class DataExporter {
  private db: Database.Database;
  private modelRepository: SQLiteProductModelV2Repository;
  private volumeRepository: SQLiteProductVolumeRepository;
  private changeoverRepository: SQLiteChangeoverRepository;
  private plantRepository: SQLitePlantRepository;

  constructor(db: Database.Database) {
    this.db = db;
    this.modelRepository = new SQLiteProductModelV2Repository(this.db);
    this.volumeRepository = new SQLiteProductVolumeRepository(this.db);
    this.changeoverRepository = new SQLiteChangeoverRepository(this.db);
    this.plantRepository = new SQLitePlantRepository(this.db);
  }

  // ============================================
  // UNIFIED CANVAS OBJECT QUERIES
  // Phase 7.5: Direct queries to canvas_objects + process_properties
  // ============================================

  /**
   * Get all active process objects for a plant with their properties
   */
  private getProcessObjectsForPlant(plantId: string): ProcessObjectWithProps[] {
    const rows = this.db.prepare(`
      SELECT
        co.id,
        co.name,
        pp.area,
        pp.line_type,
        pp.time_available_daily,
        pp.changeover_enabled,
        COALESCE(pp.changeover_explicit, 0) as changeover_explicit
      FROM canvas_objects co
      JOIN process_properties pp ON co.id = pp.canvas_object_id
      WHERE co.plant_id = ?
        AND co.object_type = 'process'
        AND co.active = 1
      ORDER BY pp.area, co.name
    `).all(plantId) as Array<{
      id: string;
      name: string;
      area: string;
      line_type: string;
      time_available_daily: number;
      changeover_enabled: number;
      changeover_explicit: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      area: row.area,
      lineType: (row.line_type || 'shared') as 'shared' | 'dedicated',
      timeAvailableDaily: row.time_available_daily,
      changeoverEnabled: Boolean(row.changeover_enabled),
      changeoverExplicit: Boolean(row.changeover_explicit),
    }));
  }

  /**
   * Get all active process objects (all plants)
   */
  private getAllProcessObjects(): ProcessObjectWithProps[] {
    const rows = this.db.prepare(`
      SELECT
        co.id,
        co.name,
        pp.area,
        pp.line_type,
        pp.time_available_daily,
        pp.changeover_enabled,
        COALESCE(pp.changeover_explicit, 0) as changeover_explicit
      FROM canvas_objects co
      JOIN process_properties pp ON co.id = pp.canvas_object_id
      WHERE co.object_type = 'process'
        AND co.active = 1
      ORDER BY pp.area, co.name
    `).all() as Array<{
      id: string;
      name: string;
      area: string;
      line_type: string;
      time_available_daily: number;
      changeover_enabled: number;
      changeover_explicit: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      area: row.area,
      lineType: (row.line_type || 'shared') as 'shared' | 'dedicated',
      timeAvailableDaily: row.time_available_daily,
      changeoverEnabled: Boolean(row.changeover_enabled),
      changeoverExplicit: Boolean(row.changeover_explicit),
    }));
  }

  /**
   * Get all compatibilities for process objects
   */
  private getCompatibilitiesForObjects(objectIds: string[]): CompatibilityData[] {
    if (objectIds.length === 0) return [];

    const placeholders = objectIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT
        canvas_object_id,
        model_id,
        cycle_time,
        efficiency,
        priority
      FROM canvas_object_compatibilities
      WHERE canvas_object_id IN (${placeholders})
    `).all(...objectIds) as Array<{
      canvas_object_id: string;
      model_id: string;
      cycle_time: number;
      efficiency: number;
      priority: number;
    }>;

    return rows.map(row => ({
      canvasObjectId: row.canvas_object_id,
      modelId: row.model_id,
      cycleTime: row.cycle_time,
      efficiency: row.efficiency,
      priority: row.priority,
    }));
  }

  /**
   * Get changeover toggles from process_properties (unified structure)
   */
  private getChangeoverTogglesForPlant(plantId: string): Map<string, { enabled: boolean; explicit: boolean }> {
    const rows = this.db.prepare(`
      SELECT
        co.id,
        pp.changeover_enabled,
        COALESCE(pp.changeover_explicit, 0) as changeover_explicit
      FROM canvas_objects co
      JOIN process_properties pp ON co.id = pp.canvas_object_id
      WHERE co.plant_id = ?
        AND co.object_type = 'process'
        AND co.active = 1
    `).all(plantId) as Array<{
      id: string;
      changeover_enabled: number;
      changeover_explicit: number;
    }>;

    const toggles = new Map<string, { enabled: boolean; explicit: boolean }>();
    for (const row of rows) {
      toggles.set(row.id, {
        enabled: Boolean(row.changeover_enabled),
        explicit: Boolean(row.changeover_explicit),
      });
    }
    return toggles;
  }

  /**
   * Get changeover toggles for all objects (no plant filter)
   */
  private getChangeoverTogglesForAllObjects(): Map<string, { enabled: boolean; explicit: boolean }> {
    const rows = this.db.prepare(`
      SELECT
        co.id,
        pp.changeover_enabled,
        COALESCE(pp.changeover_explicit, 0) as changeover_explicit
      FROM canvas_objects co
      JOIN process_properties pp ON co.id = pp.canvas_object_id
      WHERE co.object_type = 'process'
        AND co.active = 1
    `).all() as Array<{
      id: string;
      changeover_enabled: number;
      changeover_explicit: number;
    }>;

    const toggles = new Map<string, { enabled: boolean; explicit: boolean }>();
    for (const row of rows) {
      toggles.set(row.id, {
        enabled: Boolean(row.changeover_enabled),
        explicit: Boolean(row.changeover_explicit),
      });
    }
    return toggles;
  }

  /**
   * Export all data needed for optimization
   * @param selectedYears - Array of years to include in volumes
   * @param plantId - Optional plant ID to filter by (Phase 7)
   * @returns OptimizationInputData ready for Python consumption
   */
  async exportForOptimization(selectedYears: number[], plantId?: string): Promise<OptimizationInputData> {
    // Phase 7: Resolve plant context
    let resolvedPlantId = plantId;
    let plantCode = 'DEFAULT';
    let plantName = 'Default Plant';

    if (!resolvedPlantId) {
      // Use default plant if no plantId provided (backward compatibility)
      const defaultPlant = await this.plantRepository.getDefault();
      if (defaultPlant) {
        resolvedPlantId = defaultPlant.id;
        plantCode = defaultPlant.code;
        plantName = defaultPlant.name;
      }
    } else {
      // Get plant metadata for the specified plant
      const plant = await this.plantRepository.findById(resolvedPlantId);
      if (plant) {
        plantCode = plant.code;
        plantName = plant.name;
      }
    }

    console.log(`[DataExporter] Exporting data for plant ${plantCode} (${plantName}), years:`, selectedYears);

    // 1. Get all ACTIVE process objects for this plant (Phase 7.5: unified canvas_objects)
    let processObjects = resolvedPlantId
      ? this.getProcessObjectsForPlant(resolvedPlantId)
      : this.getAllProcessObjects();

    // Phase 7 Backward Compatibility: If no process objects found for plant, fall back to all
    if (processObjects.length === 0 && resolvedPlantId) {
      console.log(`[DataExporter] No process objects found for plant ${plantCode}, falling back to all`);
      processObjects = this.getAllProcessObjects();
    }

    // Map to the expected output format (lines array for Python optimizer)
    const linesData = processObjects.map(obj => ({
      id: obj.id,
      name: obj.name,
      area: obj.area,
      lineType: obj.lineType,  // shared or dedicated
      timeAvailableDaily: obj.timeAvailableDaily,
    }));
    console.log(`[DataExporter] Exported ${linesData.length} process objects for plant ${plantCode}`);

    // 2. Get all models
    const models = await this.modelRepository.findAll();
    const modelsData = models.map(model => ({
      id: model.id,
      name: model.name,
      customer: model.customer,
      program: model.program,
      family: model.family,
    }));
    console.log(`[DataExporter] Exported ${modelsData.length} models`);

    // Build model lookup map for name resolution
    const modelIdToName = new Map(models.map(m => [m.id, m.name]));

    // 3. Get volumes filtered by selected years
    const allVolumes = await this.volumeRepository.findAll();
    const filteredVolumes = allVolumes.filter(v => selectedYears.includes(v.year));
    const volumesData = filteredVolumes.map(volume => ({
      modelId: volume.modelId,
      modelName: modelIdToName.get(volume.modelId) || 'Unknown',
      year: volume.year,
      volume: volume.volume,
      operationsDays: volume.operationsDays,
    }));
    console.log(`[DataExporter] Exported ${volumesData.length} volumes for years ${selectedYears.join(', ')}`);

    // 4. Get all compatibilities (Phase 7.5: unified canvas_object_compatibilities)
    const objectIdToName = new Map(processObjects.map(obj => [obj.id, obj.name]));
    const objectIds = processObjects.map(obj => obj.id);
    const compatibilities = this.getCompatibilitiesForObjects(objectIds);

    // Map to expected output format (lineId for Python optimizer backward compatibility)
    const compatibilitiesData = compatibilities.map(compat => ({
      lineId: compat.canvasObjectId,  // Python optimizer expects 'lineId'
      lineName: objectIdToName.get(compat.canvasObjectId) || 'Unknown',
      modelId: compat.modelId,
      modelName: modelIdToName.get(compat.modelId) || 'Unknown',
      cycleTime: compat.cycleTime,
      efficiency: compat.efficiency,
      priority: compat.priority,
    }));
    console.log(`[DataExporter] Exported ${compatibilitiesData.length} compatibilities`);

    // 5. Get changeover data (Phase 7.5: unified structure)
    const [globalDefault, familyDefaults, lineOverrides, methodConfig, globalEnabled] = await Promise.all([
      this.changeoverRepository.getGlobalDefault(),
      this.changeoverRepository.getAllFamilyDefaults(),
      this.getLineOverridesForAllLines(objectIds),
      this.changeoverRepository.getCalculationMethod('global'),
      this.changeoverRepository.getGlobalEnabled(),
    ]);

    // Phase 7.5: Get changeover toggles directly from process_properties
    const togglesMap = resolvedPlantId
      ? this.getChangeoverTogglesForPlant(resolvedPlantId)
      : this.getChangeoverTogglesForAllObjects();

    // Convert Map to the expected format
    const lineToggles: Record<string, { enabled: boolean; explicit: boolean }> = {};
    togglesMap.forEach((value, key) => {
      lineToggles[key] = value;
    });

    const changeoverData = {
      globalDefaultMinutes: globalDefault,
      calculationMethod: methodConfig.methodId as 'probability_weighted' | 'simple_average' | 'worst_case',
      // Phase 5.6: Toggle states
      globalEnabled: globalEnabled,
      lineToggles: lineToggles,
      familyDefaults: familyDefaults.map(fd => ({
        fromFamily: fd.fromFamily,
        toFamily: fd.toFamily,
        changeoverMinutes: fd.changeoverMinutes,
      })),
      lineOverrides: lineOverrides,
    };
    console.log(`[DataExporter] Exported changeover data: ${familyDefaults.length} family defaults, ${lineOverrides.length} line overrides, globalEnabled=${globalEnabled}`);

    const result: OptimizationInputData = {
      lines: linesData,
      models: modelsData,
      volumes: volumesData,
      compatibilities: compatibilitiesData,
      selectedYears,
      changeover: changeoverData,
    };

    return result;
  }

  /**
   * Get all line/process overrides for multiple objects
   * Note: Parameter renamed from lineIds for clarity, but the underlying
   * changeover repository still uses 'lineId' for backward compatibility
   */
  private async getLineOverridesForAllLines(objectIds: string[]): Promise<{
    lineId: string;
    fromModelId: string;
    toModelId: string;
    changeoverMinutes: number;
  }[]> {
    const allOverrides: {
      lineId: string;
      fromModelId: string;
      toModelId: string;
      changeoverMinutes: number;
    }[] = [];

    for (const objectId of objectIds) {
      const overrides = await this.changeoverRepository.getLineOverrides(objectId);
      for (const override of overrides) {
        allOverrides.push({
          lineId: override.lineId,
          fromModelId: override.fromModelId,
          toModelId: override.toModelId,
          changeoverMinutes: override.changeoverMinutes,
        });
      }
    }

    return allOverrides;
  }

  /**
   * Get available years from volumes
   */
  async getAvailableYears(): Promise<number[]> {
    const years = await this.volumeRepository.getAvailableYears();
    return years;
  }

  /**
   * Get year range from volumes
   */
  async getYearRange(): Promise<{ min: number; max: number } | null> {
    const range = await this.volumeRepository.getYearRange();
    return range;
  }

  /**
   * Get data counts for validation (Phase 7.5: unified structure)
   */
  async getDataCounts(): Promise<{
    lines: number;
    models: number;
    volumes: number;
    compatibilities: number;
  }> {
    // Count process objects (lines)
    const linesCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM canvas_objects
      WHERE object_type = 'process' AND active = 1
    `).get() as { count: number };

    // Count models
    const models = await this.modelRepository.findAll();

    // Count volumes
    const volumes = await this.volumeRepository.findAll();

    // Count compatibilities
    const compatCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM canvas_object_compatibilities
    `).get() as { count: number };

    return {
      lines: linesCount.count,
      models: models.length,
      volumes: volumes.length,
      compatibilities: compatCount.count,
    };
  }
}
