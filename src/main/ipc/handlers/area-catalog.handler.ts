// ============================================
// IPC HANDLER: Area Catalog
// Expone operaciones de catalogo de areas
// ============================================

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ApiResponse, AreaCatalogItem } from '@shared/types';
import { SQLiteAreaCatalogRepository } from '../../database/repositories';
import DatabaseConnection from '../../database/connection';
import { nanoid } from 'nanoid';

export function registerAreaCatalogHandlers(): void {
  // ============================================
  // GET ALL AREAS
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.CATALOG_AREAS_GET_ALL,
    async (): Promise<ApiResponse<AreaCatalogItem[]>> => {
      try {
        const repository = new SQLiteAreaCatalogRepository(DatabaseConnection.getInstance());
        const areas = await repository.findActive();
        return {
          success: true,
          data: areas,
        };
      } catch (error) {
        console.error('Error getting area catalog:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CREATE AREA
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.CATALOG_AREAS_CREATE,
    async (
      _event,
      params: { code: string; name: string; color: string; sequence?: number }
    ): Promise<ApiResponse<AreaCatalogItem>> => {
      try {
        const repository = new SQLiteAreaCatalogRepository(DatabaseConnection.getInstance());

        // Validation
        if (!params.code || params.code.trim().length === 0) {
          return {
            success: false,
            error: 'Code is required',
          };
        }

        if (params.code.length > 20) {
          return {
            success: false,
            error: 'Code must be 20 characters or less',
          };
        }

        // Validate code format (alphanumeric + underscore)
        if (!/^[a-zA-Z0-9_]+$/.test(params.code)) {
          return {
            success: false,
            error: 'Code must contain only letters, numbers, and underscores',
          };
        }

        if (!params.name || params.name.trim().length === 0) {
          return {
            success: false,
            error: 'Name is required',
          };
        }

        if (params.name.length > 100) {
          return {
            success: false,
            error: 'Name must be 100 characters or less',
          };
        }

        if (!params.color || params.color.trim().length === 0) {
          return {
            success: false,
            error: 'Color is required',
          };
        }

        // Validate color format (#RRGGBB or #RGB)
        if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(params.color)) {
          return {
            success: false,
            error: 'Color must be a valid hex format (#RRGGBB or #RGB)',
          };
        }

        // Validate sequence (if provided)
        if (params.sequence !== undefined && params.sequence < 0) {
          return {
            success: false,
            error: 'Sequence must be a positive integer',
          };
        }

        // Check if area already exists (active or inactive)
        const existingArea = await repository.findByCode(params.code);

        if (existingArea) {
          if (existingArea.active) {
            // Area exists and is active - cannot create
            return {
              success: false,
              error: `Area with code "${params.code}" already exists`,
            };
          }
          // Area exists but is inactive - reactivate it with new data
          existingArea.name = params.name.trim();
          existingArea.color = params.color.trim();
          existingArea.sequence = params.sequence ?? existingArea.sequence;
          existingArea.active = true;
          existingArea.updatedAt = new Date();

          await repository.save(existingArea);

          return {
            success: true,
            data: existingArea,
          };
        }

        // Area doesn't exist - create new one
        const now = new Date();
        const newArea: AreaCatalogItem = {
          id: nanoid(),
          code: params.code.trim(),
          name: params.name.trim(),
          color: params.color.trim(),
          sequence: params.sequence ?? 0,
          active: true,
          createdAt: now,
          updatedAt: now,
        };

        await repository.save(newArea);

        return {
          success: true,
          data: newArea,
        };
      } catch (error) {
        console.error('Error creating area:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE AREA
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.CATALOG_AREAS_UPDATE,
    async (
      _event,
      params: { id: string; name?: string; color?: string; sequence?: number }
    ): Promise<ApiResponse<AreaCatalogItem>> => {
      try {
        const repository = new SQLiteAreaCatalogRepository(DatabaseConnection.getInstance());

        // Validation
        if (!params.id) {
          return {
            success: false,
            error: 'Area ID is required',
          };
        }

        // Check if area exists
        const existing = await repository.findById(params.id);
        if (!existing) {
          return {
            success: false,
            error: 'Area not found',
          };
        }

        // Validate name (if provided)
        if (params.name !== undefined) {
          if (params.name.trim().length === 0) {
            return {
              success: false,
              error: 'Name cannot be empty',
            };
          }

          if (params.name.length > 100) {
            return {
              success: false,
              error: 'Name must be 100 characters or less',
            };
          }
        }

        // Validate color (if provided)
        if (params.color !== undefined) {
          if (params.color.trim().length === 0) {
            return {
              success: false,
              error: 'Color cannot be empty',
            };
          }

          if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(params.color)) {
            return {
              success: false,
              error: 'Color must be a valid hex format (#RRGGBB or #RGB)',
            };
          }
        }

        // Validate sequence (if provided)
        if (params.sequence !== undefined && params.sequence < 0) {
          return {
            success: false,
            error: 'Sequence must be a positive integer',
          };
        }

        // Update area
        const updatedArea: AreaCatalogItem = {
          ...existing,
          name: params.name !== undefined ? params.name.trim() : existing.name,
          color: params.color !== undefined ? params.color.trim() : existing.color,
          sequence: params.sequence !== undefined ? params.sequence : existing.sequence,
          updatedAt: new Date(),
        };

        await repository.save(updatedArea);

        return {
          success: true,
          data: updatedArea,
        };
      } catch (error) {
        console.error('Error updating area:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE AREA
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.CATALOG_AREAS_DELETE,
    async (_event, params: { id: string }): Promise<ApiResponse<void>> => {
      try {
        const repository = new SQLiteAreaCatalogRepository(DatabaseConnection.getInstance());

        // Validation
        if (!params.id) {
          return {
            success: false,
            error: 'Area ID is required',
          };
        }

        // Check if area exists
        const existing = await repository.findById(params.id);
        if (!existing) {
          return {
            success: false,
            error: 'Area not found',
          };
        }

        // Check if area is in use by any production lines
        const inUse = await repository.isInUse(params.id);
        if (inUse) {
          // Count how many lines are using this area
          const db = DatabaseConnection.getInstance();
          const count = db
            .prepare(
              `
              SELECT COUNT(*) as count
              FROM production_lines
              WHERE area = (SELECT code FROM area_catalog WHERE id = ?)
            `
            )
            .get(params.id) as { count: number };

          return {
            success: false,
            error: `Cannot delete area: ${count.count} production line(s) are using it`,
          };
        }

        // Soft delete
        await repository.delete(params.id);

        return {
          success: true,
        };
      } catch (error) {
        console.error('Error deleting area:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
