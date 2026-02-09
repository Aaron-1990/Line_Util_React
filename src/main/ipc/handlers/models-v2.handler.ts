// ============================================
// IPC HANDLER: Product Models V2
// Handles CRUD operations for product models (multi-sheet import version)
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { MODELS_V2_CHANNELS } from '@shared/constants';
import { IProductModelV2, ProductModelV2 } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductModelV2Repository } from '../../database/repositories/SQLiteProductModelV2Repository';

export function registerModelsV2Handlers(): void {
  // ===== GET ALL MODELS =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<IProductModelV2[]>> => {
      try {
        console.log('[Models V2 Handler] Getting all models');
        const modelRepository = new SQLiteProductModelV2Repository(DatabaseConnection.getInstance());

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

        const modelRepository = new SQLiteProductModelV2Repository(DatabaseConnection.getInstance());
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
        const modelRepository = new SQLiteProductModelV2Repository(DatabaseConnection.getInstance());

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

  // ===== CREATE MODEL =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.CREATE,
    async (_event, params: {
      name: string;
      customer?: string;
      program?: string;
      family?: string;
      annualVolume?: number;
      operationsDays?: number;
    }): Promise<ApiResponse<IProductModelV2>> => {
      try {
        console.log('[Models V2 Handler] Creating model:', params.name);
        const modelRepository = new SQLiteProductModelV2Repository(DatabaseConnection.getInstance());

        // Validate required fields
        if (!params.name || params.name.trim().length === 0) {
          return {
            success: false,
            error: 'Model name is required',
          };
        }

        // Check if model already exists (active or inactive)
        const existingModel = await modelRepository.findByName(params.name);

        if (existingModel) {
          if (existingModel.active) {
            // Model exists and is active - cannot create
            return {
              success: false,
              error: `Model "${params.name}" already exists`,
            };
          } else {
            // Model exists but is inactive - reactivate it with new data
            await modelRepository.update(params.name, {
              customer: params.customer?.trim() || '',
              program: params.program?.trim() || '',
              family: params.family?.trim() || '',
              annualVolume: params.annualVolume ?? 0,
              operationsDays: params.operationsDays ?? 250,
              active: true, // Reactivate
            });
          }
        } else {
          // Model doesn't exist - create new one
          const model = ProductModelV2.create({
            name: params.name.trim(),
            customer: params.customer?.trim() || '',
            program: params.program?.trim() || '',
            family: params.family?.trim() || '',
            annualVolume: params.annualVolume ?? 0,
            operationsDays: params.operationsDays ?? 250,
          });

          // Save to database
          await modelRepository.create(model);
        }

        // Fetch created model to confirm
        const createdModel = await modelRepository.findByName(params.name);
        if (!createdModel) {
          return {
            success: false,
            error: 'Failed to fetch created model',
          };
        }

        return {
          success: true,
          data: createdModel.toJSON(),
        };
      } catch (error) {
        console.error('[Models V2 Handler] Create error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== UPDATE MODEL =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.UPDATE,
    async (_event, params: {
      name: string;
      updates: Partial<{
        customer: string;
        program: string;
        family: string;
        annualVolume: number;
        operationsDays: number;
      }>;
    }): Promise<ApiResponse<IProductModelV2>> => {
      try {
        const { name, updates } = params;
        console.log('[Models V2 Handler] Updating model:', name);
        const modelRepository = new SQLiteProductModelV2Repository(DatabaseConnection.getInstance());

        if (!name || typeof name !== 'string') {
          return {
            success: false,
            error: 'Invalid model name',
          };
        }

        // Check if model exists
        const existingModel = await modelRepository.findByName(name);
        if (!existingModel) {
          return {
            success: false,
            error: `Model "${name}" not found`,
          };
        }

        // Update model
        await modelRepository.update(name, updates);

        // Fetch updated model
        const updatedModel = await modelRepository.findByName(name);
        if (!updatedModel) {
          return {
            success: false,
            error: 'Failed to fetch updated model',
          };
        }

        return {
          success: true,
          data: updatedModel.toJSON(),
        };
      } catch (error) {
        console.error('[Models V2 Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== DELETE MODEL =====
  ipcMain.handle(
    MODELS_V2_CHANNELS.DELETE,
    async (_event, name: string): Promise<ApiResponse<boolean>> => {
      try {
        console.log('[Models V2 Handler] Deleting model:', name);
        const modelRepository = new SQLiteProductModelV2Repository(DatabaseConnection.getInstance());

        if (!name || typeof name !== 'string') {
          return {
            success: false,
            error: 'Invalid model name',
          };
        }

        // Check if model exists
        const exists = await modelRepository.existsByName(name);
        if (!exists) {
          return {
            success: false,
            error: `Model "${name}" not found`,
          };
        }

        // Soft delete (sets active = 0)
        await modelRepository.delete(name);

        return {
          success: true,
          data: true,
        };
      } catch (error) {
        console.error('[Models V2 Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
