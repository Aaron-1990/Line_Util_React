// ============================================
// IPC HANDLER: Product Volumes
// Handles queries for multi-year volume data
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { PRODUCT_VOLUME_CHANNELS } from '@shared/constants';
import { IProductVolume, ProductVolume } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductVolumeRepository } from '../../database/repositories/SQLiteProductVolumeRepository';

export function registerVolumeHandlers(): void {
  // ===== GET VOLUMES BY YEAR =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.GET_BY_YEAR,
    async (_event, year: number): Promise<ApiResponse<IProductVolume[]>> => {
      try {
        console.log('[Volume Handler] Getting volumes for year:', year);
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

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
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

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
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

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
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

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
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

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
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

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

  // ===== CREATE VOLUME =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.CREATE,
    async (_event, params: {
      modelId: string;
      year: number;
      volume: number;
      operationsDays: number;
    }): Promise<ApiResponse<IProductVolume>> => {
      try {
        console.log('[Volume Handler] Creating volume for model:', params.modelId, 'year:', params.year);
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

        // Validate required fields
        if (!params.modelId || params.modelId.trim().length === 0) {
          return {
            success: false,
            error: 'Model ID is required',
          };
        }

        if (!params.year || params.year < 2000 || params.year > 2100) {
          return {
            success: false,
            error: 'Year must be between 2000 and 2100',
          };
        }

        // Check if volume already exists for this model-year
        const exists = await volumeRepository.existsByModelAndYear(params.modelId, params.year);
        if (exists) {
          return {
            success: false,
            error: `Volume for model "${params.modelId}" in year ${params.year} already exists`,
          };
        }

        // Create volume entity
        const volume = ProductVolume.create({
          modelId: params.modelId,
          year: params.year,
          volume: params.volume,
          operationsDays: params.operationsDays,
        });

        // Save to database
        await volumeRepository.create(volume);

        // Fetch created volume to confirm
        const createdVolume = await volumeRepository.findByModelAndYear(params.modelId, params.year);
        if (!createdVolume) {
          return {
            success: false,
            error: 'Failed to fetch created volume',
          };
        }

        return {
          success: true,
          data: createdVolume.toJSON(),
        };
      } catch (error) {
        console.error('[Volume Handler] Create error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== UPDATE VOLUME =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.UPDATE,
    async (_event, params: {
      id: string;
      volume?: number;
      operationsDays?: number;
    }): Promise<ApiResponse<IProductVolume>> => {
      try {
        const { id, ...fields } = params;
        console.log('[Volume Handler] Updating volume:', id);
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

        if (!id || typeof id !== 'string') {
          return {
            success: false,
            error: 'Invalid volume ID',
          };
        }

        // Check if volume exists
        const existingVolume = await volumeRepository.findById(id);
        if (!existingVolume) {
          return {
            success: false,
            error: `Volume with ID "${id}" not found`,
          };
        }

        // Update volume
        await volumeRepository.update(id, fields);

        // Fetch updated volume
        const updatedVolume = await volumeRepository.findById(id);
        if (!updatedVolume) {
          return {
            success: false,
            error: 'Failed to fetch updated volume',
          };
        }

        return {
          success: true,
          data: updatedVolume.toJSON(),
        };
      } catch (error) {
        console.error('[Volume Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== DELETE VOLUME =====
  ipcMain.handle(
    PRODUCT_VOLUME_CHANNELS.DELETE,
    async (_event, id: string): Promise<ApiResponse<boolean>> => {
      try {
        console.log('[Volume Handler] Deleting volume:', id);
        const volumeRepository = new SQLiteProductVolumeRepository(DatabaseConnection.getInstance());

        if (!id || typeof id !== 'string') {
          return {
            success: false,
            error: 'Invalid volume ID',
          };
        }

        // Check if volume exists
        const existingVolume = await volumeRepository.findById(id);
        if (!existingVolume) {
          return {
            success: false,
            error: `Volume with ID "${id}" not found`,
          };
        }

        // Delete volume
        await volumeRepository.delete(id);

        return {
          success: true,
          data: true,
        };
      } catch (error) {
        console.error('[Volume Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
