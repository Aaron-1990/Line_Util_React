// ============================================
// IPC HANDLER: Line-Model Compatibilities
// Handles CRUD operations for line-model compatibility records
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { COMPATIBILITY_CHANNELS } from '@shared/constants';
import { ILineModelCompatibility, LineModelCompatibility } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteLineModelCompatibilityRepository } from '../../database/repositories/SQLiteLineModelCompatibilityRepository';

export function registerCompatibilityHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const compatibilityRepository = new SQLiteLineModelCompatibilityRepository(db);

  // ===== GET ALL COMPATIBILITIES =====
  ipcMain.handle(
    COMPATIBILITY_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<ILineModelCompatibility[]>> => {
      try {
        console.log('[Compatibility Handler] Getting all compatibilities');

        const compatibilities = await compatibilityRepository.findAll();

        return {
          success: true,
          data: compatibilities.map(c => c.toJSON()),
        };
      } catch (error) {
        console.error('[Compatibility Handler] Get all error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET COMPATIBILITIES BY LINE =====
  ipcMain.handle(
    COMPATIBILITY_CHANNELS.GET_BY_LINE,
    async (_event, lineId: string): Promise<ApiResponse<ILineModelCompatibility[]>> => {
      try {
        console.log('[Compatibility Handler] Getting compatibilities for line:', lineId);

        if (!lineId || typeof lineId !== 'string') {
          return {
            success: false,
            error: 'Invalid line ID',
          };
        }

        const compatibilities = await compatibilityRepository.findByLine(lineId);

        return {
          success: true,
          data: compatibilities.map(c => c.toJSON()),
        };
      } catch (error) {
        console.error('[Compatibility Handler] Get by line error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET COMPATIBILITIES BY MODEL =====
  ipcMain.handle(
    COMPATIBILITY_CHANNELS.GET_BY_MODEL,
    async (_event, modelId: string): Promise<ApiResponse<ILineModelCompatibility[]>> => {
      try {
        console.log('[Compatibility Handler] Getting compatibilities for model:', modelId);

        if (!modelId || typeof modelId !== 'string') {
          return {
            success: false,
            error: 'Invalid model ID',
          };
        }

        const compatibilities = await compatibilityRepository.findByModel(modelId);

        return {
          success: true,
          data: compatibilities.map(c => c.toJSON()),
        };
      } catch (error) {
        console.error('[Compatibility Handler] Get by model error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CREATE COMPATIBILITY =====
  ipcMain.handle(
    COMPATIBILITY_CHANNELS.CREATE,
    async (_event, params: {
      lineId: string;
      modelId: string;
      cycleTime: number;
      efficiency: number;
      priority: number;
    }): Promise<ApiResponse<ILineModelCompatibility>> => {
      try {
        console.log('[Compatibility Handler] Creating compatibility:', params.lineId, '<->', params.modelId);

        // Validate required fields
        if (!params.lineId || typeof params.lineId !== 'string') {
          return {
            success: false,
            error: 'Line ID is required',
          };
        }

        if (!params.modelId || typeof params.modelId !== 'string') {
          return {
            success: false,
            error: 'Model ID is required',
          };
        }

        // Check if compatibility already exists
        const exists = await compatibilityRepository.existsByLineAndModel(params.lineId, params.modelId);
        if (exists) {
          return {
            success: false,
            error: 'Compatibility already exists for this line-model pair',
          };
        }

        // Validate cycle time
        if (typeof params.cycleTime !== 'number' || params.cycleTime <= 0) {
          return {
            success: false,
            error: 'Cycle time must be > 0',
          };
        }

        // Validate efficiency
        if (typeof params.efficiency !== 'number' || params.efficiency <= 0 || params.efficiency > 100) {
          return {
            success: false,
            error: 'Efficiency must be between 1 and 100',
          };
        }

        // Validate priority
        if (typeof params.priority !== 'number' || params.priority < 1) {
          return {
            success: false,
            error: 'Priority must be >= 1',
          };
        }

        // Create compatibility entity using factory
        const compatibility = LineModelCompatibility.create({
          lineId: params.lineId,
          modelId: params.modelId,
          cycleTime: params.cycleTime,
          efficiency: params.efficiency,
          priority: params.priority,
        });

        // Save to database
        await compatibilityRepository.create(compatibility);

        // Fetch created compatibility to confirm
        const created = await compatibilityRepository.findByLineAndModel(params.lineId, params.modelId);
        if (!created) {
          return {
            success: false,
            error: 'Failed to fetch created compatibility',
          };
        }

        return {
          success: true,
          data: created.toJSON(),
        };
      } catch (error) {
        console.error('[Compatibility Handler] Create error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== UPDATE COMPATIBILITY =====
  ipcMain.handle(
    COMPATIBILITY_CHANNELS.UPDATE,
    async (_event, params: {
      id: string;
      cycleTime?: number;
      efficiency?: number;
      priority?: number;
    }): Promise<ApiResponse<ILineModelCompatibility>> => {
      try {
        console.log('[Compatibility Handler] Updating compatibility:', params.id);

        // Validate ID
        if (!params.id || typeof params.id !== 'string') {
          return {
            success: false,
            error: 'Compatibility ID is required',
          };
        }

        // Check if compatibility exists
        const existing = await compatibilityRepository.findById(params.id);
        if (!existing) {
          return {
            success: false,
            error: 'Compatibility not found',
          };
        }

        // Validate fields if provided
        if (params.cycleTime !== undefined) {
          if (typeof params.cycleTime !== 'number' || params.cycleTime <= 0) {
            return {
              success: false,
              error: 'Cycle time must be > 0',
            };
          }
        }

        if (params.efficiency !== undefined) {
          if (typeof params.efficiency !== 'number' || params.efficiency <= 0 || params.efficiency > 100) {
            return {
              success: false,
              error: 'Efficiency must be between 1 and 100',
            };
          }
        }

        if (params.priority !== undefined) {
          if (typeof params.priority !== 'number' || params.priority < 1) {
            return {
              success: false,
              error: 'Priority must be >= 1',
            };
          }
        }

        // Update compatibility
        await compatibilityRepository.update(params.id, {
          cycleTime: params.cycleTime,
          efficiency: params.efficiency,
          priority: params.priority,
        });

        // Fetch updated compatibility
        const updated = await compatibilityRepository.findById(params.id);
        if (!updated) {
          return {
            success: false,
            error: 'Failed to fetch updated compatibility',
          };
        }

        return {
          success: true,
          data: updated.toJSON(),
        };
      } catch (error) {
        console.error('[Compatibility Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== DELETE COMPATIBILITY =====
  ipcMain.handle(
    COMPATIBILITY_CHANNELS.DELETE,
    async (_event, id: string): Promise<ApiResponse<boolean>> => {
      try {
        console.log('[Compatibility Handler] Deleting compatibility:', id);

        // Validate ID
        if (!id || typeof id !== 'string') {
          return {
            success: false,
            error: 'Compatibility ID is required',
          };
        }

        // Check if compatibility exists
        const existing = await compatibilityRepository.findById(id);
        if (!existing) {
          return {
            success: false,
            error: 'Compatibility not found',
          };
        }

        // Delete compatibility
        await compatibilityRepository.delete(id);

        return {
          success: true,
          data: true,
        };
      } catch (error) {
        console.error('[Compatibility Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
