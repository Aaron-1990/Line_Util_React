// ============================================
// IPC HANDLER: Excel Import/Export
// Expone operaciones de Excel al Renderer Process
// ============================================

import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { 
  ApiResponse,
  ExcelRow,
  ParsedExcelData,
  ColumnMapping,
  ValidationResult,
} from '@shared/types';
import { ExcelImporter } from '../../services/excel/ExcelImporter';
import { ExcelValidator } from '../../services/excel/ExcelValidator';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductionLineRepository } from '../../database/repositories';
import { ProductionLine } from '@domain/entities';

interface ImportResult {
  imported: string[];
  skipped: string[];
  errors: Array<{
    row: number;
    name: string;
    error: string;
  }>;
}

export function registerExcelHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const lineRepository = new SQLiteProductionLineRepository(db);

  // ===== SELECT FILE =====
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_SELECT_FILE,
    async (): Promise<ApiResponse<{ path: string; name: string }>> => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [
            { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return {
            success: false,
            error: 'No file selected',
          };
        }

        const filePath = result.filePaths[0];
        
        if (!filePath) {
          return {
            success: false,
            error: 'Invalid file path',
          };
        }
        
        const fileName = filePath.split('/').pop() || 'Unknown';

        return {
          success: true,
          data: {
            path: filePath,
            name: fileName,
          },
        };
      } catch (error) {
        console.error('Error selecting file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== PARSE FILE =====
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_PARSE_FILE,
    async (_event, filePath: string): Promise<ApiResponse<ParsedExcelData>> => {
      try {
        console.log('[Excel Handler] Parsing file:', filePath);

        if (!filePath || typeof filePath !== 'string') {
          return {
            success: false,
            error: 'Invalid file path',
          };
        }

        const parseResult = ExcelImporter.parseFile(filePath);

        const suggestedMapping = ExcelImporter.detectColumns(parseResult.headers) || {
          name: null,
          area: null,
          timeAvailableHours: null,
          efficiencyPercent: null,
        };

        const result: ParsedExcelData = {
          rows: parseResult.rows as ExcelRow[],
          headers: parseResult.headers,
          sheetName: parseResult.sheetName,
          suggestedMapping,
        };

        console.log('[Excel Handler] Parse complete:', {
          rowCount: result.rows.length,
          headers: result.headers,
          suggestedMapping: result.suggestedMapping,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('[Excel Handler] Parse error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== VALIDATE DATA =====
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_VALIDATE_DATA,
    async (
      _event,
      data: ParsedExcelData,
      mapping: ColumnMapping
    ): Promise<ApiResponse<ValidationResult>> => {
      console.log('[Excel Handler] Validating data');
      console.log('[Excel Handler] Rows count:', data.rows.length);

      try {
        if (!data || typeof data !== 'object') {
          return {
            success: false,
            error: 'Invalid data format: expected object',
          };
        }

        if (!Array.isArray(data.rows)) {
          console.error('[Excel Handler] data.rows is not array');
          return {
            success: false,
            error: 'Invalid data format: rows must be an array',
          };
        }

        const result = ExcelValidator.validateBatch(data.rows as ExcelRow[], mapping);

        console.log('[Excel Handler] Validation complete:', {
          total: result.stats.total,
          valid: result.stats.valid,
          invalid: result.stats.invalid,
          duplicates: result.stats.duplicates,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('[Excel Handler] Validation error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== IMPORT DATA =====
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_IMPORT,
    async (
      _event,
      filePath: string,
      mapping: ColumnMapping
    ): Promise<ApiResponse<ImportResult>> => {
      try {
        console.log('[Excel Handler] Starting import from:', filePath);
        console.log('[Excel Handler] Using mapping:', mapping);

        const parseResult = ExcelImporter.parseFile(filePath);
        const validationResult = ExcelValidator.validateBatch(parseResult.rows as ExcelRow[], mapping);

        console.log('[Excel Handler] Validation result:', {
          validLines: validationResult.validLines.length,
          errors: validationResult.errors.length,
        });

        const importResult: ImportResult = {
          imported: [],
          skipped: [],
          errors: [],
        };

        // Importar lineas validas
        for (const validLine of validationResult.validLines) {
          try {
            // Verificar si ya existe (por nombre)
            const exists = await lineRepository.existsByName(validLine.name);
            if (exists) {
              importResult.skipped.push(validLine.name);
              console.log(`[Excel Handler] Skipping duplicate: ${validLine.name}`);
              continue;
            }

            // Calcular posicion inicial
            const existingLines = await lineRepository.findAll();
            const xPosition = 100 + (existingLines.length * 250) % 1000;
            const yPosition = 100 + Math.floor((existingLines.length * 250) / 1000) * 200;

            // Crear entity
            const line = ProductionLine.create({
              name: validLine.name,
              area: validLine.area,
              timeAvailableDaily: validLine.timeAvailableDaily,
              efficiency: validLine.efficiency,
              xPosition,
              yPosition,
            });

            // Guardar en DB
            await lineRepository.save(line);
            importResult.imported.push(validLine.name);
            console.log(`[Excel Handler] Imported: ${validLine.name}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            importResult.errors.push({
              row: validLine.row,
              name: validLine.name,
              error: errorMsg,
            });
            console.error(`[Excel Handler] Error importing ${validLine.name}:`, error);
          }
        }

        console.log('[Excel Handler] Import complete:', {
          imported: importResult.imported.length,
          skipped: importResult.skipped.length,
          errors: importResult.errors.length,
        });

        return {
          success: true,
          data: importResult,
        };
      } catch (error) {
        console.error('[Excel Handler] Import error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== EXPORT DATA =====
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_EXPORT,
    async (_event, _data: unknown): Promise<ApiResponse<{ path: string }>> => {
      try {
        return {
          success: false,
          error: 'Export not yet implemented',
        };
      } catch (error) {
        console.error('Error exporting to Excel:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
