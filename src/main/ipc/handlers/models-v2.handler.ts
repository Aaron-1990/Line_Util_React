// ============================================
// IPC HANDLER: Product Models V2
// Handles CRUD operations for product models (multi-sheet import version)
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { MODELS_V2_CHANNELS } from '@shared/constants';
import { IProductModelV2 } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductModelV2Repository } from '../../database/repositories/SQLiteProductModelV2Repository';

export function registerModelsV2Handlers(): void {
  const db = DatabaseConnection.getInstance();
  const modelRepository = new SQLiteProductModelV2Repository(db);

  // ===== GET ALL MODELS =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<IProductModelV2[]>> => {
      try {
        console.log('[Models V2 Handler] Getting all models');

        const models = await modelRepository.findAll();

        return {
          success: true,
          data: models.map(m => m.toJSON()),
        };
      } catch (error) {
        console.error('[Models V2 Handler] Get all error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET MODEL BY NAME =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.GET_BY_NAME,
    async (_event, name: string): Promise<ApiResponse<IProductModelV2 | null>> => {
      try {
        console.log('[Models V2 Handler] Getting model by name:', name);

        if (!name || typeof name !== 'string') {
          return {
            success: false,
            error: 'Invalid model name',
          };
        }

        const model = await modelRepository.findByName(name);

        return {
          success: true,
          data: model ? model.toJSON() : null,
        };
      } catch (error) {
        console.error('[Models V2 Handler] Get by name error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET ALL MODEL NAMES =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.GET_ALL_NAMES,
    async (): Promise<ApiResponse<string[]>> => {
      try {
        console.log('[Models V2 Handler] Getting all model names');

        const models = await modelRepository.findAll();
        const names = models.map(m => m.name);

        return {
          success: true,
          data: names,
        };
      } catch (error) {
        console.error('[Models V2 Handler] Get all names error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
