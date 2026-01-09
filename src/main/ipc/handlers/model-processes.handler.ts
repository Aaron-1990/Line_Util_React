// ============================================
// IPC HANDLER: Model Processes
// Expone operaciones de procesos de modelos al Renderer Process
// ============================================

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ApiResponse, ModelProcess as IModelProcess } from '@shared/types';
import { ModelProcess } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteModelProcessRepository } from '../../database/repositories';

export function registerModelProcessesHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repository = new SQLiteModelProcessRepository(db);

  ipcMain.handle(
    IPC_CHANNELS.PROCESSES_GET_BY_MODEL,
    async (_event, modelId: string): Promise<ApiResponse<IModelProcess[]>> => {
      try {
        const processes = await repository.findByModelId(modelId);
        return {
          success: true,
          data: processes.map(process => process.toJSON()),
        };
      } catch (error) {
        console.error('Error getting processes by model:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROCESSES_CREATE,
    async (_event, data: Partial<IModelProcess>): Promise<ApiResponse<IModelProcess>> => {
      try {
        if (!data.modelId || !data.name || !data.cycleTime || !data.quantityPerProduct || data.sequence === undefined) {
          return {
            success: false,
            error: 'Missing required fields',
          };
        }

        const process = ModelProcess.create({
          modelId: data.modelId,
          name: data.name,
          cycleTime: data.cycleTime,
          quantityPerProduct: data.quantityPerProduct,
          sequence: data.sequence,
        });

        await repository.save(process);

        return {
          success: true,
          data: process.toJSON(),
          message: 'Process created successfully',
        };
      } catch (error) {
        console.error('Error creating process:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROCESSES_UPDATE,
    async (
      _event,
      id: string,
      updates: Partial<IModelProcess>
    ): Promise<ApiResponse<IModelProcess>> => {
      try {
        const process = await repository.findById(id);
        if (!process) {
          return {
            success: false,
            error: 'Process not found',
          };
        }

        process.update({
          name: updates.name,
          cycleTime: updates.cycleTime,
          quantityPerProduct: updates.quantityPerProduct,
          sequence: updates.sequence,
        });

        await repository.save(process);

        return {
          success: true,
          data: process.toJSON(),
          message: 'Process updated successfully',
        };
      } catch (error) {
        console.error('Error updating process:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROCESSES_DELETE,
    async (_event, id: string): Promise<ApiResponse<void>> => {
      try {
        await repository.delete(id);

        return {
          success: true,
          message: 'Process deleted successfully',
        };
      } catch (error) {
        console.error('Error deleting process:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
