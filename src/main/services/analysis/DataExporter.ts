// ============================================
// DATA EXPORTER SERVICE
// Exports data from SQLite to JSON for Python optimization
// ============================================

import DatabaseConnection from '../../database/connection';
import { SQLiteProductionLineRepository } from '../../database/repositories/SQLiteProductionLineRepository';
import { SQLiteProductModelV2Repository } from '../../database/repositories/SQLiteProductModelV2Repository';
import { SQLiteProductVolumeRepository } from '../../database/repositories/SQLiteProductVolumeRepository';
import { SQLiteLineModelCompatibilityRepository } from '../../database/repositories/SQLiteLineModelCompatibilityRepository';
import { SQLiteChangeoverRepository } from '../../database/repositories/SQLiteChangeoverRepository';
import { OptimizationInputData } from '@shared/types';

export class DataExporter {
  private lineRepository: SQLiteProductionLineRepository;
  private modelRepository: SQLiteProductModelV2Repository;
  private volumeRepository: SQLiteProductVolumeRepository;
  private compatibilityRepository: SQLiteLineModelCompatibilityRepository;
  private changeoverRepository: SQLiteChangeoverRepository;

  constructor() {
    const db = DatabaseConnection.getInstance();
    this.lineRepository = new SQLiteProductionLineRepository(db);
    this.modelRepository = new SQLiteProductModelV2Repository(db);
    this.volumeRepository = new SQLiteProductVolumeRepository(db);
    this.compatibilityRepository = new SQLiteLineModelCompatibilityRepository(db);
    this.changeoverRepository = new SQLiteChangeoverRepository(db);
  }

  /**
   * Export all data needed for optimization
   * @param selectedYears - Array of years to include in volumes
   * @returns OptimizationInputData ready for Python consumption
   */
  async exportForOptimization(selectedYears: number[]): Promise<OptimizationInputData> {
    console.log('[DataExporter] Exporting data for years:', selectedYears);

    // 1. Get all production lines
    const lines = await this.lineRepository.findAll();
    const linesData = lines.map(line => ({
      id: line.id,
      name: line.name,
      area: line.area,
      lineType: line.lineType,  // shared or dedicated
      timeAvailableDaily: line.timeAvailableDaily,
    }));
    console.log(`[DataExporter] Exported ${linesData.length} lines`);

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

    // 4. Get all compatibilities
    const lineIdToName = new Map(lines.map(l => [l.id, l.name]));
    const compatibilities = await this.compatibilityRepository.findAll();
    const compatibilitiesData = compatibilities.map(compat => ({
      lineId: compat.lineId,
      lineName: lineIdToName.get(compat.lineId) || 'Unknown',
      modelId: compat.modelId,
      modelName: modelIdToName.get(compat.modelId) || 'Unknown',
      cycleTime: compat.cycleTime,
      efficiency: compat.efficiency,
      priority: compat.priority,
    }));
    console.log(`[DataExporter] Exported ${compatibilitiesData.length} compatibilities`);

    // 5. Get changeover data
    const [globalDefault, familyDefaults, lineOverrides, methodConfig, globalEnabled, lineToggles] = await Promise.all([
      this.changeoverRepository.getGlobalDefault(),
      this.changeoverRepository.getAllFamilyDefaults(),
      this.getLineOverridesForAllLines(lines.map(l => l.id)),
      this.changeoverRepository.getCalculationMethod('global'),
      this.changeoverRepository.getGlobalEnabled(),
      this.lineRepository.getChangeoverToggles(),
    ]);

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
   * Get all line overrides for multiple lines
   */
  private async getLineOverridesForAllLines(lineIds: string[]): Promise<{
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

    for (const lineId of lineIds) {
      const overrides = await this.changeoverRepository.getLineOverrides(lineId);
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
   * Get data counts for validation
   */
  async getDataCounts(): Promise<{
    lines: number;
    models: number;
    volumes: number;
    compatibilities: number;
  }> {
    const lines = await this.lineRepository.findAll();
    const models = await this.modelRepository.findAll();
    const volumes = await this.volumeRepository.findAll();
    const compatibilities = await this.compatibilityRepository.findAll();

    return {
      lines: lines.length,
      models: models.length,
      volumes: volumes.length,
      compatibilities: compatibilities.length,
    };
  }
}
