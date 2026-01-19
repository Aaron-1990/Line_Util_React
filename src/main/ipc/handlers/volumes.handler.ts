// ============================================
// IPC HANDLER: Product Volumes
// Handles queries for multi-year volume data
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { IProductVolume } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductVolumeRepository } from '../../database/repositories/SQLiteProductVolumeRepository';

// Channel names for ProductVolume operations (multi-year volumes)
// Uses 'product-volumes:' prefix to differentiate from legacy 'volumes:' channels
export const PRODUCT_VOLUME_CHANNELS = {
  GET_BY_YEAR: 'product-volumes:get-by-year',
  GET_BY_MODEL: 'product-volumes:get-by-model',
  GET_AVAILABLE_YEARS: 'product-volumes:get-available-years',
  GET_YEAR_RANGE: 'product-volumes:get-year-range',
  GET_YEAR_SUMMARY: 'product-volumes:get-year-summary',
  GET_ALL: 'product-volumes:get-all',
} as const;

export function registerVolumeHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const volumeRepository = new SQLiteProductVolumeRepository(db);

  // ===== GET VOLUMES BY YEAR =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_BY_YEAR,
    async (_event, year: number): Promise<ApiResponse<IProductVolume[]>> => {
      try {
        console.log('[Volume Handler] Getting volumes for year:', year);

        if (typeof year !== 'number' || year < 2000 || year > 2100) {
          return {
            success: false,
            error: 'Invalid year. Must be between 2000 and 2100.',
          };
        }

        const volumes = await volumeRepository.findByYear(year);

        return {
          success: true,
          data: volumes.map(v => v.toJSON()),
        };
      } catch (error) {
        console.error('[Volume Handler] Get by year error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET VOLUMES BY MODEL =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_BY_MODEL,
    async (_event, modelId: string): Promise<ApiResponse<IProductVolume[]>> => {
      try {
        console.log('[Volume Handler] Getting volumes for model:', modelId);

        if (!modelId || typeof modelId !== 'string') {
          return {
            success: false,
            error: 'Invalid model ID',
          };
        }

        const volumes = await volumeRepository.findByModel(modelId);

        return {
          success: true,
          data: volumes.map(v => v.toJSON()),
        };
      } catch (error) {
        console.error('[Volume Handler] Get by model error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET AVAILABLE YEARS =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_AVAILABLE_YEARS,
    async (): Promise<ApiResponse<number[]>> => {
      try {
        console.log('[Volume Handler] Getting available years');

        const years = await volumeRepository.getAvailableYears();

        return {
          success: true,
          data: years,
        };
      } catch (error) {
        console.error('[Volume Handler] Get available years error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET YEAR RANGE =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_YEAR_RANGE,
    async (): Promise<ApiResponse<{ min: number; max: number } | null>> => {
      try {
        console.log('[Volume Handler] Getting year range');

        const range = await volumeRepository.getYearRange();

        return {
          success: true,
          data: range,
        };
      } catch (error) {
        console.error('[Volume Handler] Get year range error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET YEAR SUMMARY =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_YEAR_SUMMARY,
    async (): Promise<ApiResponse<Array<{
      year: number;
      modelCount: number;
      totalVolume: number;
      avgOperationsDays: number;
    }>>> => {
      try {
        console.log('[Volume Handler] Getting year summary');

        const summary = await volumeRepository.getYearSummary();

        return {
          success: true,
          data: summary,
        };
      } catch (error) {
        console.error('[Volume Handler] Get year summary error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET ALL VOLUMES =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<IProductVolume[]>> => {
      try {
        console.log('[Volume Handler] Getting all volumes');

        const volumes = await volumeRepository.findAll();

        return {
          success: true,
          data: volumes.map(v => v.toJSON()),
        };
      } catch (error) {
        console.error('[Volume Handler] Get all error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
