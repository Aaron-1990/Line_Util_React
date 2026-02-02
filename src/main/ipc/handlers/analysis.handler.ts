// ============================================
// IPC HANDLER: Optimization Analysis
// Handles data export and Python optimization execution
// ============================================

import { ipcMain } from 'electron';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';
import { ANALYSIS_CHANNELS } from '@shared/constants';
import {
  ApiResponse,
  OptimizationInputData,
  OptimizationResult,
  RunOptimizationRequest,
} from '@shared/types';
import { DataExporter } from '../../services/analysis/DataExporter';
import { PythonBridge } from '../../services/python/PythonBridge';
import { openOrUpdateTimelineWindow } from './window.handler';
import DatabaseConnection from '../../database/connection';

export function registerAnalysisHandlers(): void {
  const dataExporter = new DataExporter();
  let pythonBridge: PythonBridge | null = null;

  // ===== EXPORT DATA FOR OPTIMIZATION =====
  ipcMain.handle(
    ANALYSIS_CHANNELS.EXPORT_DATA,
    async (_event, selectedYears: number[]): Promise<ApiResponse<OptimizationInputData>> => {
      try {
        console.log('[Analysis Handler] Exporting data for years:', selectedYears);

        if (!selectedYears || !Array.isArray(selectedYears) || selectedYears.length === 0) {
          return {
            success: false,
            error: 'No years selected for analysis',
          };
        }

        const data = await dataExporter.exportForOptimization(selectedYears);

        console.log('[Analysis Handler] Export complete:', {
          lines: data.lines.length,
          models: data.models.length,
          volumes: data.volumes.length,
          compatibilities: data.compatibilities.length,
        });

        return {
          success: true,
          data,
        };
      } catch (error) {
        console.error('[Analysis Handler] Export error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== RUN OPTIMIZATION =====
  ipcMain.handle(
    ANALYSIS_CHANNELS.RUN_OPTIMIZATION,
    async (_event, request: RunOptimizationRequest): Promise<ApiResponse<OptimizationResult>> => {
      try {
        console.log('[Analysis Handler] Running optimization for years:', request.selectedYears, 'plant:', request.plantId || 'default');

        if (!request.selectedYears || request.selectedYears.length === 0) {
          return {
            success: false,
            error: 'No years selected for analysis',
          };
        }

        // 1. Export data (Phase 7: pass plantId for multi-plant support)
        const inputData = await dataExporter.exportForOptimization(request.selectedYears, request.plantId);

        // 2. Write data to temp file
        const tempDir = app.getPath('temp');
        const inputPath = join(tempDir, 'optimization_input.json');
        const outputPath = join(tempDir, 'optimization_output.json');

        await writeFile(inputPath, JSON.stringify(inputData, null, 2), 'utf-8');
        console.log('[Analysis Handler] Input data written to:', inputPath);

        // 3. Run Python optimization
        pythonBridge = new PythonBridge();
        const result = await pythonBridge.runOptimization(inputPath, outputPath);

        console.log('[Analysis Handler] Optimization complete');

        // 4. Auto-open Timeline window with results
        try {
          // Get area catalog for sequence ordering
          const db = DatabaseConnection.getInstance();
          const areas = db.prepare('SELECT code, sequence FROM area_catalog WHERE active = 1 ORDER BY sequence').all() as { code: string; sequence: number }[];

          const areaSequences = areas.map(area => ({
            code: area.code,
            sequence: area.sequence,
          }));

          await openOrUpdateTimelineWindow({
            results: result,
            areaSequences,
          });
          console.log('[Analysis Handler] Timeline window opened/updated with results');
        } catch (windowError) {
          // Don't fail the optimization if window opening fails
          console.error('[Analysis Handler] Failed to open timeline window:', windowError);
        }

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('[Analysis Handler] Optimization error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CANCEL OPTIMIZATION =====
  ipcMain.handle(
    ANALYSIS_CHANNELS.CANCEL_OPTIMIZATION,
    async (): Promise<ApiResponse<void>> => {
      try {
        if (pythonBridge) {
          pythonBridge.cancel();
          pythonBridge = null;
        }
        return { success: true };
      } catch (error) {
        console.error('[Analysis Handler] Cancel error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET RESULTS =====
  ipcMain.handle(
    ANALYSIS_CHANNELS.GET_RESULTS,
    async (): Promise<ApiResponse<OptimizationResult | null>> => {
      try {
        // TODO: Implement results storage and retrieval
        // For now, return null (no cached results)
        return {
          success: true,
          data: null,
        };
      } catch (error) {
        console.error('[Analysis Handler] Get results error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET RESULTS BY YEAR =====
  ipcMain.handle(
    ANALYSIS_CHANNELS.GET_RESULTS_BY_YEAR,
    async (_event, year: number): Promise<ApiResponse<OptimizationResult | null>> => {
      try {
        // TODO: Implement results storage and retrieval by year
        console.log('[Analysis Handler] Getting results for year:', year);
        return {
          success: true,
          data: null,
        };
      } catch (error) {
        console.error('[Analysis Handler] Get results by year error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Analysis Handler] Registered analysis handlers');
}
