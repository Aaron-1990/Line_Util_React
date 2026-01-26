// ============================================
// IPC HANDLER: Area Catalog
// Expone operaciones de catalogo de areas
// ============================================

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import { ApiResponse, AreaCatalogItem } from '@shared/types';
import DatabaseConnection from '../../database/connection';

export function registerAreaCatalogHandlers(): void {
  const db = DatabaseConnection.getInstance();

  ipcMain.handle(
    IPC_CHANNELS.CATALOG_AREAS_GET_ALL,
    async (): Promise<ApiResponse<AreaCatalogItem[]>> => {
      try {
        const rows = db
          .prepare('SELECT * FROM area_catalog WHERE active = 1 ORDER BY sequence, name')
          .all() as Array<{
            id: string;
            code: string;
            name: string;
            color: string;
            sequence: number | null;
            active: number;
            created_at: string;
            updated_at: string;
          }>;

        const areas: AreaCatalogItem[] = rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          color: row.color,
          sequence: row.sequence ?? 0,
          active: Boolean(row.active),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }));

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
}
