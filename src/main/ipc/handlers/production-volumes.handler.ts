// ============================================
// IPC HANDLER: Production Volumes
// Expone operaciones de volumenes al Renderer Process
// ============================================

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ApiResponse, ProductionVolume as IProductionVolume } from '@shared/types';
import { ProductionVolume } from '@domain/entities';
import DatabaseConnection from '../../database/connection';
import { SQLiteProductionVolumeRepository } from '../../database/repositories';

export function registerProductionVolumesHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repository = new SQLiteProductionVolumeRepository(db);

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_GET_ALL,
    async (): Promise<ApiResponse<IProductionVolume[]>> => {
      try {
        const volumes = await repository.findAll();
        return {
          success: true,
          data: volumes.map(volume => volume.toJSON()),
        };
      } catch (error) {
        console.error('Error getting all volumes:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_GET_BY_YEAR,
    async (_event, year: number): Promise<ApiResponse<IProductionVolume[]>> => {
      try {
        const volumes = await repository.findByYear(year);
        return {
          success: true,
          data: volumes.map(volume => volume.toJSON()),
        };
      } catch (error) {
        console.error('Error getting volumes by year:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_CREATE,
    async (_event, data: Partial<IProductionVolume>): Promise<ApiResponse<IProductionVolume>> => {
      try {
        if (!data.family || !data.daysOfOperation || !data.year || data.quantity === undefined) {
          return {
            success: false,
            error: 'Missing required fields',
          };
        }

        const exists = await repository.existsByFamilyAndYear(data.family, data.year);
        if (exists) {
          return {
            success: false,
            error: 'A volume for this family and year already exists',
          };
        }

        const volume = ProductionVolume.create({
          family: data.family,
          daysOfOperation: data.daysOfOperation,
          year: data.year,
          quantity: data.quantity,
        });

        await repository.save(volume);

        return {
          success: true,
          data: volume.toJSON(),
          message: 'Volume created successfully',
        };
      } catch (error) {
        console.error('Error creating volume:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_UPDATE,
    async (
      _event,
      id: string,
      updates: Partial<IProductionVolume>
    ): Promise<ApiResponse<IProductionVolume>> => {
      try {
        const volume = await repository.findById(id);
        if (!volume) {
          return {
            success: false,
            error: 'Volume not found',
          };
        }

        if (updates.family && updates.year) {
          const exists = await repository.existsByFamilyAndYear(updates.family, updates.year, id);
          if (exists) {
            return {
              success: false,
              error: 'A volume for this family and year already exists',
            };
          }
        }

        volume.update({
          family: updates.family,
          daysOfOperation: updates.daysOfOperation,
          year: updates.year,
          quantity: updates.quantity,
        });

        await repository.save(volume);

        return {
          success: true,
          data: volume.toJSON(),
          message: 'Volume updated successfully',
        };
      } catch (error) {
        console.error('Error updating volume:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_DELETE,
    async (_event, id: string): Promise<ApiResponse<void>> => {
      try {
        await repository.delete(id);

        return {
          success: true,
          message: 'Volume deleted successfully',
        };
      } catch (error) {
        console.error('Error deleting volume:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
