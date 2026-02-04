// ============================================
// IPC HANDLER: Canvas Object Compatibilities
// CRUD operations for canvas object model assignments
// Phase 7.5: Unified Object Properties
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { CANVAS_OBJECT_COMPATIBILITY_CHANNELS } from '@shared/constants';
import DatabaseConnection from '../../database/connection';
import { SQLiteCanvasObjectCompatibilityRepository } from '../../database/repositories/SQLiteCanvasObjectCompatibilityRepository';
import type {
  CanvasObjectCompatibility,
  CanvasObjectCompatibilityWithModel,
  CreateCanvasObjectCompatibilityInput,
  UpdateCanvasObjectCompatibilityInput,
} from '@shared/types/canvas-object';

export function registerCanvasObjectCompatibilityHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repo = new SQLiteCanvasObjectCompatibilityRepository(db);

  // ============================================
  // GET COMPATIBILITIES BY CANVAS OBJECT
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_COMPATIBILITY_CHANNELS.GET_BY_OBJECT,
    async (_event, canvasObjectId: string): Promise<ApiResponse<CanvasObjectCompatibilityWithModel[]>> => {
      try {
        console.log('[Canvas Object Compatibility Handler] Getting compatibilities for object:', canvasObjectId);

        if (!canvasObjectId || typeof canvasObjectId !== 'string') {
          return { success: false, error: 'Invalid canvas object ID' };
        }

        const compatibilities = await repo.findByCanvasObject(canvasObjectId);
        return { success: true, data: compatibilities };
      } catch (error) {
        console.error('[Canvas Object Compatibility Handler] Get by object error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET COMPATIBILITIES BY MODEL
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_COMPATIBILITY_CHANNELS.GET_BY_MODEL,
    async (_event, modelId: string): Promise<ApiResponse<CanvasObjectCompatibility[]>> => {
      try {
        console.log('[Canvas Object Compatibility Handler] Getting compatibilities for model:', modelId);

        if (!modelId || typeof modelId !== 'string') {
          return { success: false, error: 'Invalid model ID' };
        }

        const compatibilities = await repo.findByModel(modelId);
        return { success: true, data: compatibilities };
      } catch (error) {
        console.error('[Canvas Object Compatibility Handler] Get by model error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CREATE COMPATIBILITY
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_COMPATIBILITY_CHANNELS.CREATE,
    async (_event, params: CreateCanvasObjectCompatibilityInput): Promise<ApiResponse<CanvasObjectCompatibility>> => {
      try {
        console.log('[Canvas Object Compatibility Handler] Creating compatibility:', params.canvasObjectId, '<->', params.modelId);

        // Validate required fields
        if (!params.canvasObjectId || typeof params.canvasObjectId !== 'string') {
          return { success: false, error: 'Canvas object ID is required' };
        }

        if (!params.modelId || typeof params.modelId !== 'string') {
          return { success: false, error: 'Model ID is required' };
        }

        // Check if compatibility already exists
        const exists = await repo.existsByCanvasObjectAndModel(params.canvasObjectId, params.modelId);
        if (exists) {
          return { success: false, error: 'Compatibility already exists for this object-model pair' };
        }

        // Validate cycle time
        if (typeof params.cycleTime !== 'number' || params.cycleTime <= 0) {
          return { success: false, error: 'Cycle time must be > 0' };
        }

        // Validate efficiency
        if (typeof params.efficiency !== 'number' || params.efficiency <= 0 || params.efficiency > 100) {
          return { success: false, error: 'Efficiency must be between 1 and 100' };
        }

        // Validate priority
        if (typeof params.priority !== 'number' || params.priority < 1) {
          return { success: false, error: 'Priority must be >= 1' };
        }

        const created = await repo.create(params);
        return { success: true, data: created };
      } catch (error) {
        console.error('[Canvas Object Compatibility Handler] Create error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE COMPATIBILITY
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_COMPATIBILITY_CHANNELS.UPDATE,
    async (_event, params: { id: string } & UpdateCanvasObjectCompatibilityInput): Promise<ApiResponse<CanvasObjectCompatibility>> => {
      try {
        console.log('[Canvas Object Compatibility Handler] Updating compatibility:', params.id);

        if (!params.id || typeof params.id !== 'string') {
          return { success: false, error: 'Compatibility ID is required' };
        }

        // Validate fields if provided
        if (params.cycleTime !== undefined) {
          if (typeof params.cycleTime !== 'number' || params.cycleTime <= 0) {
            return { success: false, error: 'Cycle time must be > 0' };
          }
        }

        if (params.efficiency !== undefined) {
          if (typeof params.efficiency !== 'number' || params.efficiency <= 0 || params.efficiency > 100) {
            return { success: false, error: 'Efficiency must be between 1 and 100' };
          }
        }

        if (params.priority !== undefined) {
          if (typeof params.priority !== 'number' || params.priority < 1) {
            return { success: false, error: 'Priority must be >= 1' };
          }
        }

        const updated = await repo.update(params.id, {
          cycleTime: params.cycleTime,
          efficiency: params.efficiency,
          priority: params.priority,
        });

        return { success: true, data: updated };
      } catch (error) {
        console.error('[Canvas Object Compatibility Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE COMPATIBILITY
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_COMPATIBILITY_CHANNELS.DELETE,
    async (_event, id: string): Promise<ApiResponse<boolean>> => {
      try {
        console.log('[Canvas Object Compatibility Handler] Deleting compatibility:', id);

        if (!id || typeof id !== 'string') {
          return { success: false, error: 'Compatibility ID is required' };
        }

        await repo.delete(id);
        return { success: true, data: true };
      } catch (error) {
        console.error('[Canvas Object Compatibility Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Canvas Object Compatibility Handler] Registered all handlers');
}
