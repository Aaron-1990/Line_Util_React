// ============================================
// IPC HANDLER: Results Export
// Phase 9: Export Optimization Results to Excel
// ============================================

import { ipcMain, dialog } from 'electron';
import { writeFile } from 'fs/promises';
import { EXPORT_CHANNELS } from '@shared/constants';
import { ApiResponse, ExportResultsRequest } from '@shared/types';
import { ExcelExporter } from '@main/services/excel/ExcelExporter';

export function registerExportHandlers(): void {
  // ===== EXPORT RESULTS TO EXCEL =====
  ipcMain.handle(
    EXPORT_CHANNELS.EXPORT_RESULTS_EXCEL,
    async (_event, request: ExportResultsRequest): Promise<ApiResponse<{ path: string }>> => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const suggestedName = `LineOptimizer_Results_${timestamp}.xlsx`;

        const { canceled, filePath } = await dialog.showSaveDialog({
          title: 'Export Results to Excel',
          defaultPath: suggestedName,
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        });

        if (canceled || !filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        const exporter = new ExcelExporter();
        const buffer = exporter.exportToBuffer(request);
        await writeFile(filePath, buffer);

        console.log('[Export Handler] Excel exported to:', filePath);
        return { success: true, data: { path: filePath } };
      } catch (error) {
        console.error('[Export Handler] Export error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during export',
        };
      }
    }
  );
}
