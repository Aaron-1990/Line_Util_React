// ============================================
// IPC HANDLER: Product Models
// Expone operaciones de modelos al Renderer Process
// ============================================

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ApiResponse, ProductModel as IProductModel } from '@shared/types';
import { ProductModel } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductModelRepository } from '../../database/repositories';

export function registerProductModelsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.MODELS_GET_ALL,
    async (): Promise<ApiResponse<IProductModel[]>> => {
      try {
        const repository = new SQLiteProductModelRepository(DatabaseConnection.getInstance());
        const models = await repository.findAll();
        return {
          success: true,
          data: models.map(model => model.toJSON()),
        };
      } catch (error) {
        console.error('Error getting all models:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MODELS_GET_BY_ID,
    async (_event, id: string): Promise<ApiResponse<IProductModel | null>> => {
      try {
        const repository = new SQLiteProductModelRepository(DatabaseConnection.getInstance());
        const model = await repository.findById(id);
        return {
          success: true,
          data: model ? model.toJSON() : null,
        };
      } catch (error) {
        console.error('Error getting model by id:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MODELS_CREATE,
    async (_event, data: Partial<IProductModel>): Promise<ApiResponse<IProductModel>> => {
      try {
        const repository = new SQLiteProductModelRepository(DatabaseConnection.getInstance());

        if (!data.family || !data.name || !data.bu || !data.area || data.priority === undefined || !data.efficiency) {
          return {
            success: false,
            error: 'Missing required fields',
          };
        }

        const exists = await repository.existsByName(data.family, data.name);
        if (exists) {
          return {
            success: false,
            error: 'A model with this family and name already exists',
          };
        }

        const model = ProductModel.create({
          family: data.family,
          name: data.name,
          bu: data.bu,
          area: data.area,
          priority: data.priority,
          efficiency: data.efficiency,
          compatibleLines: data.compatibleLines,
        });

        await repository.save(model);

        return {
          success: true,
          data: model.toJSON(),
          message: 'Model created successfully',
        };
      } catch (error) {
        console.error('Error creating model:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MODELS_UPDATE,
    async (
      _event,
      id: string,
      updates: Partial<IProductModel>
    ): Promise<ApiResponse<IProductModel>> => {
      try {
        const repository = new SQLiteProductModelRepository(DatabaseConnection.getInstance());

        const model = await repository.findById(id);
        if (!model) {
          return {
            success: false,
            error: 'Model not found',
          };
        }

        if (updates.family && updates.name) {
          const exists = await repository.existsByName(updates.family, updates.name, id);
          if (exists) {
            return {
              success: false,
              error: 'A model with this family and name already exists',
            };
          }
        }

        model.update({
          family: updates.family,
          name: updates.name,
          bu: updates.bu,
          area: updates.area,
          priority: updates.priority,
          efficiency: updates.efficiency,
        });

        if (updates.compatibleLines) {
          model.setCompatibleLines(updates.compatibleLines);
        }

        await repository.save(model);

        return {
          success: true,
          data: model.toJSON(),
          message: 'Model updated successfully',
        };
      } catch (error) {
        console.error('Error updating model:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MODELS_DELETE,
    async (_event, id: string): Promise<ApiResponse<void>> => {
      try {
        const repository = new SQLiteProductModelRepository(DatabaseConnection.getInstance());

        const model = await repository.findById(id);
        if (!model) {
          return {
            success: false,
            error: 'Model not found',
          };
        }

        await repository.delete(id);

        return {
          success: true,
          message: 'Model deleted successfully',
        };
      } catch (error) {
        console.error('Error deleting model:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
