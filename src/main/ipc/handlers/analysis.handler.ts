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
        console.log('[Analysis Handler] Running optimization for years:', request.selectedYears);

        if (!request.selectedYears || request.selectedYears.length === 0) {
          return {
            success: false,
            error: 'No years selected for analysis',
          };
        }

        // 1. Export data
        const inputData = await dataExporter.exportForOptimization(request.selectedYears);

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
