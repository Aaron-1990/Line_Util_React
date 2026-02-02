// ============================================
// IPC HANDLER: Multi-Sheet Excel Import
// Handles parsing, validation, and import of multi-sheet Excel files
// ============================================

import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { EXCEL_CHANNELS } from '@shared/constants';
import {
  ApiResponse,
  MultiSheetParsedData,
  MultiSheetValidationResult,
  MultiSheetImportResult,
  DetectedSheets,
} from '@shared/types';
import { MultiSheetImporter } from '../../services/excel/MultiSheetImporter';
import { MultiSheetValidator } from '../../services/excel/MultiSheetValidator';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductionLineRepository } from '../../database/repositories/SQLiteProductionLineRepository';
import { SQLiteProductModelV2Repository } from '../../database/repositories/SQLiteProductModelV2Repository';
import { SQLiteLineModelCompatibilityRepository } from '../../database/repositories/SQLiteLineModelCompatibilityRepository';
import { SQLiteProductVolumeRepository } from '../../database/repositories/SQLiteProductVolumeRepository';
import { SQLiteChangeoverRepository } from '../../database/repositories/SQLiteChangeoverRepository';
import { SQLitePlantRepository } from '../../database/repositories/SQLitePlantRepository';
import { ProductionLine, ProductModelV2, LineModelCompatibility, ProductVolume } from '@domain/entities';

export function registerMultiSheetExcelHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const lineRepository = new SQLiteProductionLineRepository(db);
  const modelRepository = new SQLiteProductModelV2Repository(db);
  const compatibilityRepository = new SQLiteLineModelCompatibilityRepository(db);
  const volumeRepository = new SQLiteProductVolumeRepository(db);
  const changeoverRepository = new SQLiteChangeoverRepository(db);
  const plantRepository = new SQLitePlantRepository(db);

  // ===== DETECT SHEETS =====
  ipcMain.handle(
    EXCEL_CHANNELS.DETECT_SHEETS,
    async (_event, filePath: string): Promise<ApiResponse<DetectedSheets>> => {
      try {
        console.log('[Multi-Sheet Handler] Detecting sheets in:', filePath);

        if (!filePath || typeof filePath !== 'string') {
          return {
            success: false,
            error: 'Invalid file path',
          };
        }

        const detected = MultiSheetImporter.detectSheets(filePath);

        console.log('[Multi-Sheet Handler] Detected sheets:', {
          areas: detected.areas?.sheetName,
          lines: detected.lines?.sheetName,
          models: detected.models?.sheetName,
          compatibilities: detected.compatibilities?.sheetName,
          changeover: detected.changeover?.sheetName,
        });

        return {
          success: true,
          data: detected,
        };
      } catch (error) {
        console.error('[Multi-Sheet Handler] Detect sheets error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== PARSE MULTI-SHEET =====
  ipcMain.handle(
    EXCEL_CHANNELS.PARSE_MULTI_SHEET,
    async (_event, filePath: string): Promise<ApiResponse<MultiSheetParsedData>> => {
      try {
        console.log('[Multi-Sheet Handler] Parsing multi-sheet file:', filePath);

        if (!filePath || typeof filePath !== 'string') {
          return {
            success: false,
            error: 'Invalid file path',
          };
        }

        const parsed = MultiSheetImporter.parseFile(filePath);

        console.log('[Multi-Sheet Handler] Parse complete:', {
          areas: parsed.areas?.rowCount || 0,
          areasMapping: parsed.areas?.mapping || 'NONE',
          lines: parsed.lines?.rowCount || 0,
          models: parsed.models?.rowCount || 0,
          compatibilities: parsed.compatibilities?.rowCount || 0,
          changeover: parsed.changeover?.rowCount || 0,
          availableSheets: parsed.availableSheets,
        });

        return {
          success: true,
          data: parsed,
        };
      } catch (error) {
        console.error('[Multi-Sheet Handler] Parse error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== VALIDATE MULTI-SHEET =====
  ipcMain.handle(
    EXCEL_CHANNELS.VALIDATE_MULTI_SHEET,
    async (_event, data: MultiSheetParsedData): Promise<ApiResponse<MultiSheetValidationResult>> => {
      try {
        console.log('[Multi-Sheet Handler] Validating multi-sheet data');

        if (!data || typeof data !== 'object') {
          return {
            success: false,
            error: 'Invalid data format',
          };
        }

        // Get existing lines and models from database
        const existingLines = await lineRepository.findAll();
        const existingLineNames = existingLines.map(l => l.name);

        const existingModels = await modelRepository.findAll();
        const existingModelNames = existingModels.map(m => m.name);

        const validationResult = await MultiSheetValidator.validateMultiSheet(
          data,
          existingLineNames,
          existingModelNames
        );

        // Phase 7.3: Check which plant codes exist vs need to be created
        if (validationResult.detectedPlantCodes && validationResult.detectedPlantCodes.length > 0) {
          const allPlants = await plantRepository.findAll();
          const plantCodeMap = new Map<string, string>();
          for (const plant of allPlants) {
            plantCodeMap.set(plant.code.toUpperCase(), plant.name);
            plantCodeMap.set(plant.name.toUpperCase(), plant.name);
          }

          validationResult.plantValidation = validationResult.detectedPlantCodes.map(code => {
            const existingName = plantCodeMap.get(code.toUpperCase());
            return {
              code,
              exists: !!existingName,
              existingName,
            };
          });

          console.log('[Multi-Sheet Handler] Plant validation:', validationResult.plantValidation);
        }

        console.log('[Multi-Sheet Handler] Validation complete:', {
          areasValid: validationResult.areas?.stats.valid || 0,
          linesValid: validationResult.lines?.stats.valid || 0,
          modelsValid: validationResult.models?.stats.valid || 0,
          compatibilitiesValid: validationResult.compatibilities?.stats.valid || 0,
          changeoverValid: validationResult.changeover?.stats.valid || 0,
          crossSheetErrors: validationResult.crossSheetErrors.length,
          isValid: validationResult.isValid,
          plantsDetected: validationResult.plantValidation?.length || 0,
        });
        if (validationResult.areas) {
          console.log('[Multi-Sheet Handler] Areas validation:', validationResult.areas.stats);
        }

        return {
          success: true,
          data: validationResult,
        };
      } catch (error) {
        console.error('[Multi-Sheet Handler] Validation error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== IMPORT MULTI-SHEET =====
  ipcMain.handle(
    EXCEL_CHANNELS.IMPORT_MULTI_SHEET,
    async (
      _event,
      validationResult: MultiSheetValidationResult,
      mode: 'create' | 'update' | 'merge' = 'merge'
    ): Promise<ApiResponse<MultiSheetImportResult>> => {
      const startTime = Date.now();

      try {
        console.log('[Multi-Sheet Handler] Starting multi-sheet import');
        console.log('[Multi-Sheet Handler] Import mode:', mode);

        // Check for cross-sheet errors
        if (validationResult.crossSheetErrors.length > 0) {
          return {
            success: false,
            error: `Cannot import: ${validationResult.crossSheetErrors.length} cross-sheet validation error(s)`,
          };
        }

        const result: MultiSheetImportResult = {
          totalTime: 0,
          success: true,
        };

        // Start transaction
        db.prepare('BEGIN TRANSACTION').run();

        // Phase 7: Get default plant for assigning to new lines
        const defaultPlant = await plantRepository.getDefault();
        const defaultPlantId = defaultPlant?.id ?? 'plant-default';
        console.log('[Multi-Sheet Handler] Default plant for import:', defaultPlantId);

        // Phase 7.2: Build plant code to ID lookup map for Excel Plant column support
        const allPlants = await plantRepository.findAll();
        const plantCodeToId = new Map<string, string>();
        for (const plant of allPlants) {
          plantCodeToId.set(plant.code.toUpperCase(), plant.id);
          // Also map by name for flexibility
          plantCodeToId.set(plant.name.toUpperCase(), plant.id);
        }
        console.log('[Multi-Sheet Handler] Plant code lookup map:', Array.from(plantCodeToId.keys()));

        // Phase 7.3: Auto-create plants from Excel before importing other data
        if (validationResult.plantValidation && validationResult.plantValidation.length > 0) {
          const plantsToCreate = validationResult.plantValidation.filter(p => !p.exists);

          if (plantsToCreate.length > 0) {
            console.log('[Multi-Sheet Handler] Auto-creating plants:', plantsToCreate.map(p => p.code));

            let created = 0;
            let errors = 0;

            for (const plantInfo of plantsToCreate) {
              try {
                // Create plant with code as both code and name
                const plantId = randomUUID();
                db.prepare(
                  'INSERT INTO plants (id, code, name, is_default, is_active) VALUES (?, ?, ?, 0, 1)'
                ).run(plantId, plantInfo.code, plantInfo.code);

                // Update lookup map with new plant
                plantCodeToId.set(plantInfo.code.toUpperCase(), plantId);

                console.log(`[Multi-Sheet Handler] Created plant: ${plantInfo.code} (${plantId})`);
                created++;
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error creating plant ${plantInfo.code}:`, error);
                errors++;
              }
            }

            result.plants = { created, updated: 0, errors };
            console.log('[Multi-Sheet Handler] Plants created:', result.plants);
          }
        }

        // Helper function to resolve plant ID from code
        const resolvePlantId = (plantCode: string | undefined): string => {
          if (!plantCode) return defaultPlantId;
          const resolved = plantCodeToId.get(plantCode.toUpperCase());
          if (!resolved) {
            console.warn(`[Multi-Sheet Handler] Unknown plant code "${plantCode}", using default plant`);
            return defaultPlantId;
          }
          return resolved;
        };

        try {
          // 0. Import Areas (if present) - must be first to set up process flow order
          console.log('[Multi-Sheet Handler] Areas in validation result:', validationResult.areas?.validAreas?.length ?? 'NONE');
          if (validationResult.areas && validationResult.areas.validAreas.length > 0) {
            console.log('[Multi-Sheet Handler] Importing areas:', validationResult.areas.validAreas.length);
            console.log('[Multi-Sheet Handler] Areas to import:', validationResult.areas.validAreas.map(a => `${a.code}(seq:${a.sequence})`).join(', '));

            let created = 0;
            let updated = 0;
            let errors = 0;

            const defaultColors = [
              '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa',
              '#f87171', '#38bdf8', '#4ade80', '#facc15', '#e879f9',
            ];
            let colorIndex = 0;

            for (const validArea of validationResult.areas.validAreas) {
              try {
                // Check if area exists (case-insensitive)
                const existingArea = db.prepare(
                  'SELECT id, code FROM area_catalog WHERE UPPER(code) = UPPER(?)'
                ).get(validArea.code) as { id: string; code: string } | undefined;

                if (existingArea) {
                  // Update existing area (keep original code case)
                  if (mode === 'create') {
                    continue; // Skip in create mode
                  }
                  db.prepare(
                    'UPDATE area_catalog SET name = ?, sequence = ?, color = COALESCE(?, color) WHERE id = ?'
                  ).run(validArea.name, validArea.sequence, validArea.color || null, existingArea.id);
                  updated++;
                } else {
                  // Create new area
                  if (mode === 'update') {
                    continue; // Skip in update mode
                  }
                  const color = validArea.color || defaultColors[colorIndex % defaultColors.length] || '#9ca3af';
                  colorIndex++;

                  const areaId = randomUUID();
                  db.prepare(
                    'INSERT INTO area_catalog (id, code, name, color, sequence, active) VALUES (?, ?, ?, ?, ?, 1)'
                  ).run(areaId, validArea.code, validArea.name, color, validArea.sequence);
                  created++;
                }
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error importing area ${validArea.code}:`, error);
                errors++;
              }
            }

            result.areas = { created, updated, errors };
            console.log('[Multi-Sheet Handler] Areas imported:', result.areas);
          }

          // 0b. Auto-create missing areas (from Lines sheet, if no Areas sheet)
          if (validationResult.lines && validationResult.lines.validLines.length > 0) {
            const uniqueAreas = new Set(validationResult.lines.validLines.map(l => l.area));
            const defaultColors = [
              '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa',
              '#f87171', '#38bdf8', '#4ade80', '#facc15', '#e879f9',
              '#fb923c', '#2dd4bf', '#818cf8', '#f43f5e', '#84cc16',
            ];
            let colorIndex = 0;

            for (const areaCode of uniqueAreas) {
              // Check if area exists (case-insensitive)
              const existingArea = db.prepare(
                'SELECT id, code FROM area_catalog WHERE UPPER(code) = UPPER(?)'
              ).get(areaCode) as { id: string; code: string } | undefined;

              if (!existingArea) {
                // Create new area with default color and UUID
                const color = defaultColors[colorIndex % defaultColors.length] ?? '#9ca3af';
                colorIndex++;

                const areaId = randomUUID();
                db.prepare(
                  'INSERT INTO area_catalog (id, code, name, color, active) VALUES (?, ?, ?, ?, 1)'
                ).run(areaId, areaCode, areaCode, color);

                console.log(`[Multi-Sheet Handler] Auto-created area: ${areaCode} with color ${color}`);
              }
            }
          }

          // 1. Import Lines (if present)
          if (validationResult.lines && validationResult.lines.validLines.length > 0) {
            console.log('[Multi-Sheet Handler] Importing lines:', validationResult.lines.validLines.length);

            let created = 0;
            let updated = 0;
            let errors = 0;

            // Build area code lookup map (case-insensitive -> actual code in DB)
            const areaCodeMap = new Map<string, string>();
            const allAreas = db.prepare('SELECT code FROM area_catalog WHERE active = 1').all() as { code: string }[];
            allAreas.forEach(a => areaCodeMap.set(a.code.toUpperCase(), a.code));

            for (const validLine of validationResult.lines.validLines) {
              try {
                // Get the correct area code from DB (case-insensitive match)
                const areaCode = areaCodeMap.get(validLine.area.toUpperCase()) || validLine.area;

                const existingLine = await lineRepository.findByName(validLine.name);
                const exists = existingLine !== null;

                if (mode === 'create' && exists) {
                  continue; // Skip existing in create mode
                }

                if (mode === 'update' && !exists) {
                  continue; // Skip new in update mode
                }

                if (exists && existingLine) {
                  // Update existing
                  existingLine.update({
                    area: areaCode,
                    lineType: validLine.lineType,
                    timeAvailableDaily: validLine.timeAvailableDaily,
                  });
                  await lineRepository.save(existingLine);
                  updated++;
                } else {
                  // Create new
                  const existingLines = await lineRepository.findAll();
                  const xPosition = 100 + (existingLines.length * 250) % 1000;
                  const yPosition = 100 + Math.floor((existingLines.length * 250) / 1000) * 200;

                  // Phase 7.2: Use plant code from Excel if present, otherwise default
                  const plantId = resolvePlantId(validLine.plantCode);

                  const line = ProductionLine.create({
                    name: validLine.name,
                    area: areaCode,
                    lineType: validLine.lineType,
                    timeAvailableDaily: validLine.timeAvailableDaily,
                    xPosition,
                    yPosition,
                    plantId,  // Phase 7.2: Use resolved plant from Excel
                  });
                  await lineRepository.save(line);
                  created++;
                }
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error importing line ${validLine.name}:`, error);
                errors++;
              }
            }

            result.lines = { created, updated, errors };
            console.log('[Multi-Sheet Handler] Lines imported:', result.lines);
          }

          // 2. Import Models (if present)
          if (validationResult.models && validationResult.models.validModels.length > 0) {
            console.log('[Multi-Sheet Handler] Importing models:', validationResult.models.validModels.length);

            let created = 0;
            let updated = 0;
            let errors = 0;

            for (const validModel of validationResult.models.validModels) {
              try {
                const existingModel = await modelRepository.findByName(validModel.name);
                const exists = existingModel !== null;

                if (mode === 'create' && exists) {
                  continue;
                }

                if (mode === 'update' && !exists) {
                  continue;
                }

                if (exists) {
                  // Update existing
                  await modelRepository.update(validModel.name, {
                    customer: validModel.customer,
                    program: validModel.program,
                    family: validModel.family,
                    annualVolume: validModel.annualVolume ?? 0,
                    operationsDays: validModel.operationsDays ?? 240,
                    active: validModel.active,
                  });
                  updated++;
                } else {
                  // Create new
                  const model = ProductModelV2.create({
                    name: validModel.name,
                    customer: validModel.customer,
                    program: validModel.program,
                    family: validModel.family,
                    annualVolume: validModel.annualVolume ?? 0,
                    operationsDays: validModel.operationsDays ?? 240,
                    active: validModel.active,
                  });
                  await modelRepository.create(model);
                  created++;
                }
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error importing model ${validModel.name}:`, error);
                errors++;
              }
            }

            result.models = { created, updated, errors };
            console.log('[Multi-Sheet Handler] Models imported:', result.models);
          }

          // 3. Import Volumes (if present - from year columns in Models sheet)
          if (validationResult.volumes && validationResult.volumes.validVolumes.length > 0) {
            console.log('[Multi-Sheet Handler] Importing volumes:', validationResult.volumes.validVolumes.length);

            let created = 0;
            let updated = 0;
            let errors = 0;

            // Build lookup map for model names -> IDs
            const allModels = await modelRepository.findAll();
            const modelNameToId = new Map(allModels.map(m => [m.name.toLowerCase(), m.id]));

            for (const validVolume of validationResult.volumes.validVolumes) {
              try {
                const modelId = modelNameToId.get(validVolume.modelName.toLowerCase());

                if (!modelId) {
                  console.error(`[Multi-Sheet Handler] Model not found for volume: ${validVolume.modelName}`);
                  errors++;
                  continue;
                }

                const existingVolume = await volumeRepository.findByModelAndYear(modelId, validVolume.year);
                const exists = existingVolume !== null;

                if (mode === 'create' && exists) {
                  continue;
                }

                if (mode === 'update' && !exists) {
                  continue;
                }

                if (exists && existingVolume) {
                  // Update existing
                  await volumeRepository.update(existingVolume.id, {
                    volume: validVolume.volume,
                    operationsDays: validVolume.operationsDays,
                  });
                  updated++;
                } else {
                  // Create new
                  const volume = ProductVolume.create({
                    modelId,
                    year: validVolume.year,
                    volume: validVolume.volume,
                    operationsDays: validVolume.operationsDays,
                  });
                  await volumeRepository.create(volume);
                  created++;
                }
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error importing volume ${validVolume.modelName}/${validVolume.year}:`, error);
                errors++;
              }
            }

            // Get year range for result
            const yearRange = validationResult.volumes.stats.yearRange;

            result.volumes = { created, updated, errors, yearRange: yearRange ?? undefined };
            console.log('[Multi-Sheet Handler] Volumes imported:', result.volumes);
          }

          // 4. Import Compatibilities (if present)
          // Note: Excel uses names (user-friendly), but we store IDs (referential integrity)
          if (validationResult.compatibilities && validationResult.compatibilities.validCompatibilities.length > 0) {
            console.log('[Multi-Sheet Handler] Importing compatibilities:', validationResult.compatibilities.validCompatibilities.length);

            let created = 0;
            let updated = 0;
            let errors = 0;

            // Build lookup maps for line and model names -> IDs
            const allLines = await lineRepository.findAll();
            const lineNameToId = new Map(allLines.map(l => [l.name.toLowerCase(), l.id]));

            const allModels = await modelRepository.findAll();
            const modelNameToId = new Map(allModels.map(m => [m.name.toLowerCase(), m.id]));

            for (const validCompat of validationResult.compatibilities.validCompatibilities) {
              try {
                // Look up IDs by name
                const lineId = lineNameToId.get(validCompat.lineName.toLowerCase());
                const modelId = modelNameToId.get(validCompat.modelName.toLowerCase());

                if (!lineId) {
                  console.error(`[Multi-Sheet Handler] Line not found: ${validCompat.lineName}`);
                  errors++;
                  continue;
                }

                if (!modelId) {
                  console.error(`[Multi-Sheet Handler] Model not found: ${validCompat.modelName}`);
                  errors++;
                  continue;
                }

                const existingCompat = await compatibilityRepository.findByLineAndModel(lineId, modelId);
                const exists = existingCompat !== null;

                if (mode === 'create' && exists) {
                  continue;
                }

                if (mode === 'update' && !exists) {
                  continue;
                }

                if (exists && existingCompat) {
                  // Update existing
                  await compatibilityRepository.update(existingCompat.id, {
                    cycleTime: validCompat.cycleTime,
                    efficiency: validCompat.efficiency,
                    priority: validCompat.priority,
                  });
                  updated++;
                } else {
                  // Create new - use IDs instead of names
                  const compat = LineModelCompatibility.create({
                    lineId,
                    modelId,
                    cycleTime: validCompat.cycleTime,
                    efficiency: validCompat.efficiency,
                    priority: validCompat.priority,
                  });
                  await compatibilityRepository.create(compat);
                  created++;
                }
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error importing compatibility ${validCompat.lineName}-${validCompat.modelName}:`, error);
                errors++;
              }
            }

            result.compatibilities = { created, updated, errors };
            console.log('[Multi-Sheet Handler] Compatibilities imported:', result.compatibilities);
          }

          // 5. Import Changeover family defaults (if present)
          if (validationResult.changeover && validationResult.changeover.validChangeovers.length > 0) {
            console.log('[Multi-Sheet Handler] Importing changeover defaults:', validationResult.changeover.validChangeovers.length);

            let created = 0;
            let updated = 0;
            let errors = 0;

            for (const validChangeover of validationResult.changeover.validChangeovers) {
              try {
                // Check if this family pair already has a default
                const existingDefault = await changeoverRepository.getFamilyDefault(
                  validChangeover.fromFamily,
                  validChangeover.toFamily
                );
                const exists = existingDefault !== null;

                if (mode === 'create' && exists) {
                  continue;
                }

                if (mode === 'update' && !exists) {
                  continue;
                }

                // Set family default (this handles both create and update)
                await changeoverRepository.setFamilyDefault(
                  validChangeover.fromFamily,
                  validChangeover.toFamily,
                  validChangeover.changeoverMinutes
                );

                if (exists) {
                  updated++;
                } else {
                  created++;
                }
              } catch (error) {
                console.error(`[Multi-Sheet Handler] Error importing changeover ${validChangeover.fromFamily}->${validChangeover.toFamily}:`, error);
                errors++;
              }
            }

            result.changeover = { created, updated, errors };
            console.log('[Multi-Sheet Handler] Changeover defaults imported:', result.changeover);
          }

          // Commit transaction
          db.prepare('COMMIT').run();

          result.totalTime = Date.now() - startTime;
          result.success = true;

          console.log('[Multi-Sheet Handler] Import complete in', result.totalTime, 'ms');

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          // Rollback on error
          db.prepare('ROLLBACK').run();
          throw error;
        }
      } catch (error) {
        console.error('[Multi-Sheet Handler] Import error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
