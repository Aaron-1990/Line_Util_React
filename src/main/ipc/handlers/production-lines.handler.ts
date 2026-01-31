// ============================================
// IPC HANDLER: Production Lines
// Expone operaciones de lineas al Renderer Process
// ============================================

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ApiResponse, ProductionLine as IProductionLine } from '@shared/types';
import { ProductionLine } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductionLineRepository } from '../../database/repositories';

export function registerProductionLinesHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repository = new SQLiteProductionLineRepository(db);

  ipcMain.handle(
    IPC_CHANNELS.LINES_GET_ALL,
    async (): Promise<ApiResponse<IProductionLine[]>> => {
      try {
        const lines = await repository.findActive();
        return {
          success: true,
          data: lines.map(line => line.toJSON()),
        };
      } catch (error) {
        console.error('Error getting all lines:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LINES_GET_BY_ID,
    async (_event, id: string): Promise<ApiResponse<IProductionLine | null>> => {
      try {
        const line = await repository.findById(id);
        return {
          success: true,
          data: line ? line.toJSON() : null,
        };
      } catch (error) {
        console.error('Error getting line by id:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LINES_CREATE,
    async (_event, data: Partial<IProductionLine>): Promise<ApiResponse<IProductionLine>> => {
      try {
        if (!data.name || !data.area || !data.timeAvailableDaily) {
          return {
            success: false,
            error: 'Missing required fields',
          };
        }

        const exists = await repository.existsByName(data.name);
        if (exists) {
          return {
            success: false,
            error: 'A line with this name already exists',
          };
        }

        const line = ProductionLine.create({
          name: data.name,
          area: data.area,
          timeAvailableDaily: data.timeAvailableDaily,
          xPosition: data.xPosition,
          yPosition: data.yPosition,
        });

        await repository.save(line);

        return {
          success: true,
          data: line.toJSON(),
          message: 'Line created successfully',
        };
      } catch (error) {
        console.error('Error creating line:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LINES_UPDATE,
    async (
      _event,
      id: string,
      updates: Partial<IProductionLine>
    ): Promise<ApiResponse<IProductionLine>> => {
      try {
        const line = await repository.findById(id);
        if (!line) {
          return {
            success: false,
            error: 'Line not found',
          };
        }

        if (updates.name) {
          const exists = await repository.existsByName(updates.name, id);
          if (exists) {
            return {
              success: false,
              error: 'A line with this name already exists',
            };
          }
        }

        line.update({
          name: updates.name,
          area: updates.area,
          timeAvailableDaily: updates.timeAvailableDaily,
        });

        await repository.save(line);

        return {
          success: true,
          data: line.toJSON(),
          message: 'Line updated successfully',
        };
      } catch (error) {
        console.error('Error updating line:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LINES_DELETE,
    async (_event, id: string): Promise<ApiResponse<void>> => {
      try {
        const line = await repository.findById(id);
        if (!line) {
          return {
            success: false,
            error: 'Line not found',
          };
        }

        await repository.delete(id);

        return {
          success: true,
          message: 'Line deleted successfully',
        };
      } catch (error) {
        console.error('Error deleting line:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LINES_UPDATE_POSITION,
    async (_event, id: string, x: number, y: number): Promise<ApiResponse<void>> => {
      try {
        await repository.updatePosition(id, x, y);

        return {
          success: true,
          message: 'Position updated successfully',
        };
      } catch (error) {
        console.error('Error updating position:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Phase 5.6: Per-line changeover toggle
  ipcMain.handle(
    IPC_CHANNELS.LINES_UPDATE_CHANGEOVER_ENABLED,
    async (_event, id: string, enabled: boolean): Promise<ApiResponse<void>> => {
      try {
        console.log(`[Lines Handler] Updating changeover enabled for line ${id}: ${enabled}`);

        const line = await repository.findById(id);
        if (!line) {
          return {
            success: false,
            error: 'Line not found',
          };
        }

        await repository.updateChangeoverEnabled(id, enabled);

        return {
          success: true,
          message: 'Changeover toggle updated successfully',
        };
      } catch (error) {
        console.error('Error updating changeover enabled:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Phase 5.6.3: Reset all changeover toggles to a specific state
  ipcMain.handle(
    IPC_CHANNELS.LINES_RESET_ALL_CHANGEOVER,
    async (_event, enabled: boolean = true): Promise<ApiResponse<number>> => {
      try {
        console.log(`[Lines Handler] Resetting all changeover toggles to: ${enabled ? 'ON' : 'OFF'}`);
        const count = await repository.resetAllChangeoverToggles(enabled);
        return {
          success: true,
          data: count,
          message: `Reset ${count} lines to ${enabled ? 'ON' : 'OFF'}`,
        };
      } catch (error) {
        console.error('Error resetting changeover toggles:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Phase 5.6.2: Set all changeover toggles to enabled/disabled
  ipcMain.handle(
    IPC_CHANNELS.LINES_SET_ALL_CHANGEOVER,
    async (_event, enabled: boolean): Promise<ApiResponse<number>> => {
      try {
        console.log(`[Lines Handler] Setting all changeover toggles to: ${enabled}`);
        const count = await repository.setAllChangeoverEnabled(enabled);
        return {
          success: true,
          data: count,
          message: `Updated ${count} lines`,
        };
      } catch (error) {
        console.error('Error setting all changeover toggles:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
