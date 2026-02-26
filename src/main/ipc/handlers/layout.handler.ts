// ============================================
// IPC HANDLER: Project Layouts
// Phase 8.5: Canvas Background Layouts
// ============================================

import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { LAYOUT_CHANNELS } from '@shared/constants';
import type { ApiResponse } from '@shared/types';
import type { LayoutImage, ImportLayoutResult, UpdateLayoutInput } from '@shared/types/layout';
import DatabaseConnection from '../../database/connection';
import { SQLiteLayoutRepository } from '../../database/repositories/SQLiteLayoutRepository';

// Default dimensions for layout images (canvas units)
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export function registerLayoutHandlers(): void {
  // ============================================
  // IMPORT LAYOUT (file dialog + read + store)
  // ============================================

  ipcMain.handle(
    LAYOUT_CHANNELS.IMPORT,
    async (
      _event,
      payload: { plantId: string; viewportCenter?: { x: number; y: number } }
    ): Promise<ApiResponse<ImportLayoutResult>> => {
      try {
        const { plantId, viewportCenter } = payload;

        if (!plantId) {
          return { success: false, error: 'Missing plantId' };
        }

        // Open file dialog
        const result = await dialog.showOpenDialog({
          title: 'Import Layout Image',
          buttonLabel: 'Import',
          filters: [
            {
              name: 'Layout Images',
              extensions: ['png', 'jpg', 'jpeg', 'svg', 'bmp', 'webp'],
            },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0 || !result.filePaths[0]) {
          return { success: false, error: 'Import canceled' };
        }

        const filePath = result.filePaths[0] as string;
        const fileName = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath).toLowerCase().replace('.', '');

        const stats = fs.statSync(filePath);
        const fileSizeBytes = stats.size;

        // Determine source format
        const format = ext === 'jpg' || ext === 'jpeg' ? 'jpg' :
                       ext === 'svg' ? 'svg' :
                       ext === 'bmp' ? 'bmp' :
                       ext === 'webp' ? 'webp' :
                       'png';

        let imageData: string;

        if (ext === 'svg') {
          // SVG: read as string
          imageData = fs.readFileSync(filePath, 'utf-8');
        } else {
          // Raster formats: read as base64 data URI
          const buffer = fs.readFileSync(filePath);
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                           ext === 'webp' ? 'image/webp' :
                           ext === 'bmp' ? 'image/bmp' :
                           'image/png';
          imageData = `data:${mimeType};base64,${buffer.toString('base64')}`;
        }

        // Calculate position: center of current viewport or origin
        const xPosition = viewportCenter ? viewportCenter.x - DEFAULT_WIDTH / 2 : 0;
        const yPosition = viewportCenter ? viewportCenter.y - DEFAULT_HEIGHT / 2 : 0;

        const repo = new SQLiteLayoutRepository(DatabaseConnection.getInstance());
        const layout = repo.create({
          plantId,
          name: fileName,
          imageData,
          sourceFormat: format as LayoutImage['sourceFormat'],
          xPosition,
          yPosition,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
          opacity: 0.5,
          originalWidth: DEFAULT_WIDTH,
          originalHeight: DEFAULT_HEIGHT,
        });

        console.log(`[Layout Handler] Imported layout "${layout.name}" (${fileSizeBytes} bytes)`);

        return {
          success: true,
          data: { layout, fileSizeBytes },
        };
      } catch (error) {
        console.error('[Layout Handler] Import error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET LAYOUTS BY PLANT
  // ============================================

  ipcMain.handle(
    LAYOUT_CHANNELS.GET_BY_PLANT,
    async (
      _event,
      plantId: string
    ): Promise<ApiResponse<LayoutImage[]>> => {
      try {
        if (!plantId) {
          return { success: false, error: 'Missing plantId' };
        }

        const repo = new SQLiteLayoutRepository(DatabaseConnection.getInstance());
        const layouts = repo.findByPlant(plantId);

        return { success: true, data: layouts };
      } catch (error) {
        console.error('[Layout Handler] Get by plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE LAYOUT (position, size, opacity, locked, visible)
  // ============================================

  ipcMain.handle(
    LAYOUT_CHANNELS.UPDATE,
    async (
      _event,
      payload: { id: string } & UpdateLayoutInput
    ): Promise<ApiResponse<LayoutImage>> => {
      try {
        const { id, ...input } = payload;

        if (!id) {
          return { success: false, error: 'Missing layout id' };
        }

        const repo = new SQLiteLayoutRepository(DatabaseConnection.getInstance());
        const updated = repo.update(id, input);

        if (!updated) {
          return { success: false, error: `Layout not found: ${id}` };
        }

        return { success: true, data: updated };
      } catch (error) {
        console.error('[Layout Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE LAYOUT
  // ============================================

  ipcMain.handle(
    LAYOUT_CHANNELS.DELETE,
    async (
      _event,
      id: string
    ): Promise<ApiResponse<void>> => {
      try {
        if (!id) {
          return { success: false, error: 'Missing layout id' };
        }

        const repo = new SQLiteLayoutRepository(DatabaseConnection.getInstance());
        const deleted = repo.delete(id);

        if (!deleted) {
          return { success: false, error: `Layout not found: ${id}` };
        }

        console.log(`[Layout Handler] Deleted layout: ${id}`);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Layout Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Layout Handler] Registered all layout IPC handlers');
}
