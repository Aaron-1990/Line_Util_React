// ============================================
// IPC HANDLER: Multi-Sheet Excel Import
// Handles parsing, validation, and import of multi-sheet Excel files
// ============================================

import { ipcMain } from 'electron';
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
import { ProductionLine, ProductModelV2, LineModelCompatibility } from '@domain/entities';

export function registerMultiSheetExcelHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const lineRepository = new SQLiteProductionLineRepository(db);
  const modelRepository = new SQLiteProductModelV2Repository(db);
  const compatibilityRepository = new SQLiteLineModelCompatibilityRepository(db);

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
          lines: detected.lines?.sheetName,
          models: detected.models?.sheetName,
          compatibilities: detected.compatibilities?.sheetName,
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
          lines: parsed.lines?.rowCount || 0,
          models: parsed.models?.rowCount || 0,
          compatibilities: parsed.compatibilities?.rowCount || 0,
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

        console.log('[Multi-Sheet Handler] Validation complete:', {
          linesValid: validationResult.lines?.stats.valid || 0,
          modelsValid: validationResult.models?.stats.valid || 0,
          compatibilitiesValid: validationResult.compatibilities?.stats.valid || 0,
          crossSheetErrors: validationResult.crossSheetErrors.length,
          isValid: validationResult.isValid,
        });

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

        try {
          // 1. Import Lines (if present)
          if (validationResult.lines && validationResult.lines.validLines.length > 0) {
            console.log('[Multi-Sheet Handler] Importing lines:', validationResult.lines.validLines.length);

            let created = 0;
            let updated = 0;
            let errors = 0;

            for (const validLine of validationResult.lines.validLines) {
              try {
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
                    area: validLine.area,
                    timeAvailableDaily: validLine.timeAvailableDaily,
                  });
                  await lineRepository.save(existingLine);
                  updated++;
                } else {
                  // Create new
                  const existingLines = await lineRepository.findAll();
                  const xPosition = 100 + (existingLines.length * 250) % 1000;
                  const yPosition = 100 + Math.floor((existingLines.length * 250) / 1000) * 200;

                  const line = ProductionLine.create({
                    name: validLine.name,
                    area: validLine.area,
                    timeAvailableDaily: validLine.timeAvailableDaily,
                    xPosition,
                    yPosition,
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
                    annualVolume: validModel.annualVolume,
                    operationsDays: validModel.operationsDays,
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
                    annualVolume: validModel.annualVolume,
                    operationsDays: validModel.operationsDays,
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

          // 3. Import Compatibilities (if present)
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
