// ============================================
// IPC HANDLER: Shape Catalog
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { SHAPE_CATALOG_CHANNELS } from '@shared/constants';
import DatabaseConnection from '../../database/connection';
import { SQLiteShapeCatalogRepository } from '../../database/repositories/SQLiteShapeCatalogRepository';
import type { ShapeDefinition } from '@shared/types/shape-catalog';

export function registerShapeCatalogHandlers(): void {
  // ============================================
  // GET ALL SHAPES
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<ShapeDefinition[]>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        console.log('[Shape Catalog Handler] Getting all shapes');
        const shapes = await repo.findAll();
        return { success: true, data: shapes };
      } catch (error) {
        console.error('[Shape Catalog Handler] Get all shapes error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET SHAPES BY CATEGORY
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.GET_BY_CATEGORY,
    async (_event, categoryId: string): Promise<ApiResponse<ShapeDefinition[]>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        console.log('[Shape Catalog Handler] Getting shapes by category:', categoryId);

        if (!categoryId) {
          return { success: false, error: 'Missing category ID' };
        }

        const shapes = await repo.findByCategory(categoryId);
        return { success: true, data: shapes };
      } catch (error) {
        console.error('[Shape Catalog Handler] Get shapes by category error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET SHAPE BY ID
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.GET_BY_ID,
    async (_event, id: string): Promise<ApiResponse<ShapeDefinition | null>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        console.log('[Shape Catalog Handler] Getting shape by ID:', id);

        if (!id) {
          return { success: false, error: 'Missing shape ID' };
        }

        const shape = await repo.findById(id);
        return { success: true, data: shape };
      } catch (error) {
        console.error('[Shape Catalog Handler] Get shape by ID error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET CATEGORIES
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.GET_CATEGORIES,
    async (): Promise<ApiResponse<any[]>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        console.log('[Shape Catalog Handler] Getting all categories');
        const categories = await repo.findAllCategories();
        return { success: true, data: categories };
      } catch (error) {
        console.error('[Shape Catalog Handler] Get categories error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // IMPORT SVG
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.IMPORT_SVG,
    async (
      _event,
      payload: { name: string; categoryId: string; svgContent: string; sourceFile?: string }
    ): Promise<ApiResponse<ShapeDefinition>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        console.log('[Shape Catalog Handler] Importing SVG shape:', payload.name);

        if (!payload.name || !payload.categoryId || !payload.svgContent) {
          return { success: false, error: 'Missing required fields: name, categoryId, or svgContent' };
        }

        const shape = await repo.importSvg(
          payload.svgContent,
          payload.name,
          payload.categoryId
        );

        return { success: true, data: shape };
      } catch (error) {
        console.error('[Shape Catalog Handler] Import SVG error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // IMPORT DXF (Placeholder for future)
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.IMPORT_DXF,
    async (
      _event,
      payload: { name: string; categoryId: string; filePath: string }
    ): Promise<ApiResponse<ShapeDefinition>> => {
      try {
        console.log('[Shape Catalog Handler] Import DXF not yet implemented:', payload.name);
        return {
          success: false,
          error: 'DXF import not yet implemented. Coming in a future release.',
        };
      } catch (error) {
        console.error('[Shape Catalog Handler] Import DXF error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // IMPORT IMAGE (Placeholder for future)
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.IMPORT_IMAGE,
    async (
      _event,
      payload: { name: string; categoryId: string; filePath: string }
    ): Promise<ApiResponse<ShapeDefinition>> => {
      try {
        console.log('[Shape Catalog Handler] Import image not yet implemented:', payload.name);
        return {
          success: false,
          error: 'Image import not yet implemented. Coming in a future release.',
        };
      } catch (error) {
        console.error('[Shape Catalog Handler] Import image error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE FAVORITE
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.UPDATE_FAVORITE,
    async (
      _event,
      payload: { id: string; isFavorite: boolean }
    ): Promise<ApiResponse<void>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        const { id, isFavorite } = payload;
        console.log('[Shape Catalog Handler] Updating favorite status:', id, isFavorite);

        if (!id || isFavorite === undefined) {
          return { success: false, error: 'Missing shape ID or favorite status' };
        }

        await repo.updateFavorite(id, isFavorite);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Shape Catalog Handler] Update favorite error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // INCREMENT USAGE COUNT
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.INCREMENT_USAGE,
    async (_event, id: string): Promise<ApiResponse<void>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        console.log('[Shape Catalog Handler] Incrementing usage count:', id);

        if (!id) {
          return { success: false, error: 'Missing shape ID' };
        }

        await repo.incrementUsage(id);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Shape Catalog Handler] Increment usage error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE SHAPE
  // ============================================

  ipcMain.handle(
    SHAPE_CATALOG_CHANNELS.DELETE,
    async (_event, payload: { id: string }): Promise<ApiResponse<void>> => {
      try {
        const repo = new SQLiteShapeCatalogRepository(DatabaseConnection.getInstance());
        const { id } = payload;
        console.log('[Shape Catalog Handler] Deleting shape:', id);

        if (!id) {
          return { success: false, error: 'Missing shape ID' };
        }

        await repo.delete(id);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Shape Catalog Handler] Delete shape error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Shape Catalog Handler] Registered all shape catalog IPC handlers');
}
