import { ipcMain, BrowserWindow } from 'electron';
import { PROJECT_CHANNELS, PROJECT_EVENTS } from '@shared/constants';
import { ApiResponse, ProjectState } from '@shared/types';
import { ProjectFileService } from '@main/services/project/ProjectFileService';
import DatabaseConnection from '@main/database/connection';

let mainWindow: BrowserWindow | null = null;

export function registerProjectHandlers(window: BrowserWindow): void {
  mainWindow = window;

  // ===== NEW PROJECT =====
  ipcMain.handle(
    PROJECT_CHANNELS.NEW,
    async (): Promise<ApiResponse<void>> => {
      try {
        if (!mainWindow) {
          return {
            success: false,
            error: 'Main window not available',
          };
        }

        const success = await ProjectFileService.newProject(DatabaseConnection.getInstance(), mainWindow);

        if (success) {
          // Broadcast event (only if window still exists)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_CLOSED);
          }

          return { success: true };
        }

        return {
          success: false,
          error: 'User cancelled or error occurred',
        };
      } catch (error) {
        console.error('[Project Handler] New project error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== OPEN PROJECT =====
  ipcMain.handle(
    PROJECT_CHANNELS.OPEN,
    async (_event, filePath?: string): Promise<ApiResponse<void>> => {
      try {
        if (!mainWindow) {
          return {
            success: false,
            error: 'Main window not available',
          };
        }

        const loadedDb = await ProjectFileService.openProject(
          filePath || null,
          mainWindow
        );

        if (loadedDb) {
          // Replace current database connection
          DatabaseConnection.replaceInstance(loadedDb);

          // Broadcast event (only if window still exists)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_OPENED);
          }

          return { success: true };
        }

        return {
          success: false,
          error: 'User cancelled or file incompatible',
        };
      } catch (error) {
        console.error('[Project Handler] Open project error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== SAVE PROJECT =====
  ipcMain.handle(
    PROJECT_CHANNELS.SAVE,
    async (): Promise<ApiResponse<void>> => {
      try {
        if (!mainWindow) {
          return {
            success: false,
            error: 'Main window not available',
          };
        }

        const success = await ProjectFileService.saveProject(DatabaseConnection.getInstance(), mainWindow);

        if (success) {
          // Broadcast event (only if window still exists)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_SAVED);
          }

          return { success: true };
        }

        return {
          success: false,
          error: 'User cancelled or save failed',
        };
      } catch (error) {
        console.error('[Project Handler] Save project error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== SAVE PROJECT AS =====
  ipcMain.handle(
    PROJECT_CHANNELS.SAVE_AS,
    async (): Promise<ApiResponse<void>> => {
      try {
        if (!mainWindow) {
          return {
            success: false,
            error: 'Main window not available',
          };
        }

        const success = await ProjectFileService.saveProjectAs(DatabaseConnection.getInstance(), mainWindow);

        if (success) {
          // Broadcast event (only if window still exists)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_SAVED);
          }

          return { success: true };
        }

        return {
          success: false,
          error: 'User cancelled or save failed',
        };
      } catch (error) {
        console.error('[Project Handler] Save As error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET PROJECT INFO =====
  ipcMain.handle(
    PROJECT_CHANNELS.GET_INFO,
    async (): Promise<ApiResponse<ProjectState>> => {
      try {
        // Always get current database instance (in case it was replaced by openProject)
        const currentDb = DatabaseConnection.getInstance();
        const state = ProjectFileService.getProjectState(currentDb);

        return {
          success: true,
          data: state,
        };
      } catch (error) {
        console.error('[Project Handler] Get info error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CHECK UNSAVED CHANGES =====
  ipcMain.handle(
    PROJECT_CHANNELS.HAS_UNSAVED_CHANGES,
    async (): Promise<ApiResponse<boolean>> => {
      try {
        const hasChanges = ProjectFileService.hasChanges();

        return {
          success: true,
          data: hasChanges,
        };
      } catch (error) {
        console.error('[Project Handler] Has unsaved changes error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Project Handler] Registered project handlers');
}
