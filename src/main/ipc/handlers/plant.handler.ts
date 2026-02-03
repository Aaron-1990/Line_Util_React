// ============================================
// IPC HANDLER: Plants
// Phase 7: Multi-Plant Support
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse, Plant, CreatePlantInput, UpdatePlantInput } from '@shared/types';
import { PLANT_CHANNELS } from '@shared/constants';
import DatabaseConnection from '../../database/connection';
import { SQLitePlantRepository } from '../../database/repositories/SQLitePlantRepository';

export function registerPlantHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const plantRepository = new SQLitePlantRepository(db);

  // ============================================
  // GET ALL PLANTS
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<Plant[]>> => {
      try {
        console.log('[Plant Handler] Getting all plants');
        const plants = await plantRepository.findAll();
        return { success: true, data: plants };
      } catch (error) {
        console.error('[Plant Handler] Get all plants error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET PLANT BY ID
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.GET_BY_ID,
    async (_event, id: string): Promise<ApiResponse<Plant | null>> => {
      try {
        console.log('[Plant Handler] Getting plant by ID:', id);

        if (!id) {
          return { success: false, error: 'Missing plant ID' };
        }

        const plant = await plantRepository.findById(id);
        return { success: true, data: plant };
      } catch (error) {
        console.error('[Plant Handler] Get plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET DEFAULT PLANT
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.GET_DEFAULT,
    async (): Promise<ApiResponse<Plant | null>> => {
      try {
        console.log('[Plant Handler] Getting default plant');
        const plant = await plantRepository.getDefault();
        return { success: true, data: plant };
      } catch (error) {
        console.error('[Plant Handler] Get default plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CREATE PLANT
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.CREATE,
    async (_event, input: CreatePlantInput): Promise<ApiResponse<Plant>> => {
      try {
        console.log('[Plant Handler] Creating plant:', input.code, input.name);

        if (!input.code || !input.name) {
          return { success: false, error: 'Plant code and name are required' };
        }

        // Validate code format (uppercase, alphanumeric, max 10 chars)
        if (!/^[A-Z0-9_-]{1,10}$/i.test(input.code)) {
          return {
            success: false,
            error: 'Plant code must be 1-10 alphanumeric characters',
          };
        }

        const plant = await plantRepository.create({
          ...input,
          code: input.code.toUpperCase(), // Normalize to uppercase
        });

        return { success: true, data: plant };
      } catch (error) {
        console.error('[Plant Handler] Create plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE PLANT
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.UPDATE,
    async (_event, payload: { id: string } & UpdatePlantInput): Promise<ApiResponse<Plant>> => {
      try {
        const { id, ...input } = payload;
        console.log('[Plant Handler] Updating plant:', id);

        if (!id) {
          return { success: false, error: 'Missing plant ID' };
        }

        // Validate code format if provided
        if (input.code && !/^[A-Z0-9_-]{1,10}$/i.test(input.code)) {
          return {
            success: false,
            error: 'Plant code must be 1-10 alphanumeric characters',
          };
        }

        // Normalize code to uppercase if provided
        const normalizedInput = input.code
          ? { ...input, code: input.code.toUpperCase() }
          : input;

        const plant = await plantRepository.update(id, normalizedInput);
        return { success: true, data: plant };
      } catch (error) {
        console.error('[Plant Handler] Update plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE PLANT (SOFT DELETE)
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.DELETE,
    async (_event, payload: { id: string }): Promise<ApiResponse<void>> => {
      try {
        const { id } = payload;
        console.log('[Plant Handler] Deleting plant:', id);

        if (!id) {
          return { success: false, error: 'Missing plant ID' };
        }

        await plantRepository.delete(id);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Plant Handler] Delete plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // SET DEFAULT PLANT
  // ============================================

  ipcMain.handle(
    PLANT_CHANNELS.SET_DEFAULT,
    async (_event, payload: { id: string }): Promise<ApiResponse<Plant>> => {
      try {
        const { id } = payload;
        console.log('[Plant Handler] Setting default plant:', id);

        if (!id) {
          return { success: false, error: 'Missing plant ID' };
        }

        const plant = await plantRepository.setDefault(id);
        return { success: true, data: plant };
      } catch (error) {
        console.error('[Plant Handler] Set default plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Plant Handler] Registered all plant IPC handlers');
}
