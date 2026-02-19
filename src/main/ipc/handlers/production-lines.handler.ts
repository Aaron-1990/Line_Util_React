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
  ipcMain.handle(
    IPC_CHANNELS.LINES_GET_ALL,
    async (): Promise<ApiResponse<IProductionLine[]>> => {
      try {
        // Get fresh instance on each request (critical for replaceInstance() to work)
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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

  // Phase 7: Get lines by plant (plant-scoped canvas)
  ipcMain.handle(
    IPC_CHANNELS.LINES_GET_BY_PLANT,
    async (_event, plantId: string): Promise<ApiResponse<IProductionLine[]>> => {
      try {
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
        const lines = await repository.findActiveByPlant(plantId);
        return {
          success: true,
          data: lines.map(line => line.toJSON()),
        };
      } catch (error) {
        console.error('Error getting lines by plant:', error);
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());

        if (!data.name || !data.area || !data.timeAvailableDaily) {
          return {
            success: false,
            error: 'Missing required fields',
          };
        }

        // Phase 7: Check for duplicate name within the same plant
        if (data.plantId) {
          const existsInPlant = await repository.existsByNameInPlant(data.name, data.plantId);
          if (existsInPlant) {
            return {
              success: false,
              error: 'A line with this name already exists in this plant',
            };
          }
        } else {
          const exists = await repository.existsByName(data.name);
          if (exists) {
            return {
              success: false,
              error: 'A line with this name already exists',
            };
          }
        }

        const line = ProductionLine.create({
          name: data.name,
          area: data.area,
          timeAvailableDaily: data.timeAvailableDaily,
          xPosition: data.xPosition,
          yPosition: data.yPosition,
          plantId: data.plantId, // Phase 7: Associate line with plant
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());

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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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
        const repository = new SQLiteProductionLineRepository(DatabaseConnection.getInstance());
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

  // Bug 1 Fix: Get validation counts for process objects by plant
  ipcMain.handle(
    IPC_CHANNELS.LINES_GET_VALIDATION_COUNTS,
    async (_event, plantId: string): Promise<ApiResponse<{ complete: number; incomplete: number; total: number }>> => {
      try {
        const db = DatabaseConnection.getInstance();

        // Single query with CASE statements for efficiency
        // A process object is "complete" if it has (matches client-side badge in GenericShapeNode):
        // 1. process_properties with area != '' AND time_available_daily > 0
        // 2. At least one model assigned (canvas_object_compatibilities)
        // Note: name is NOT checked — required at creation, UI prevents clearing it
        const result = db.prepare(`
          SELECT
            COUNT(CASE
              WHEN pp.area IS NOT NULL
                AND pp.area != ''
                AND pp.time_available_daily > 0
                AND (SELECT COUNT(*) FROM canvas_object_compatibilities WHERE canvas_object_id = co.id) > 0
              THEN 1
            END) as complete_count,
            COUNT(CASE
              WHEN pp.area IS NULL
                OR pp.area = ''
                OR pp.time_available_daily IS NULL
                OR pp.time_available_daily <= 0
                OR (SELECT COUNT(*) FROM canvas_object_compatibilities WHERE canvas_object_id = co.id) = 0
              THEN 1
            END) as incomplete_count,
            COUNT(*) as total_count
          FROM canvas_objects co
          LEFT JOIN process_properties pp ON co.id = pp.canvas_object_id
          WHERE co.object_type = 'process'
            AND co.active = 1
            AND co.plant_id = ?
        `).get(plantId) as { complete_count: number; incomplete_count: number; total_count: number };

        return {
          success: true,
          data: {
            complete: result.complete_count,
            incomplete: result.incomplete_count,
            total: result.total_count,
          },
        };
      } catch (error) {
        console.error('[Lines Handler] Error getting validation counts:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
