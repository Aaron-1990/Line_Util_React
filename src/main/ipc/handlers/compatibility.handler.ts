// ============================================
// IPC HANDLER: Line-Model Compatibilities
// Handles CRUD operations for line-model compatibility records
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { COMPATIBILITY_CHANNELS } from '@shared/constants';
import { ILineModelCompatibility } from '@domain/entities';
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
}
