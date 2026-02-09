import { ipcMain, BrowserWindow, dialog } from 'electron';
import { PROJECT_CHANNELS, PROJECT_EVENTS } from '@shared/constants';
import { ApiResponse, ProjectState, UntitledProjectState } from '@shared/types';
import { ProjectFileService } from '@main/services/project/ProjectFileService';
import DatabaseConnection from '@main/database/connection';

// ===== TYPE DEFINITIONS =====
type SaveDialogResult = 'save' | 'dont-save' | 'cancel';

interface ProjectStateFromRenderer {
  projectType: 'untitled' | 'saved';
  hasUnsavedChanges: boolean;
  projectFilePath: string | null;
}

// ===== CONSTANTS =====
// List of all data tables to clear (preserves schema)
// NOTE: Excludes VIEWs (production_lines, line_model_compatibilities) - only real tables
const DATA_TABLES = [
  // Core tables (Phase 7.5+)
  'canvas_objects',                    // Replaces production_lines (which is now a VIEW)
  'canvas_object_compatibilities',     // Replaces line_model_compatibilities (which is now a VIEW)
  'canvas_connections',
  'buffer_properties',
  'process_properties',
  'process_line_links',
  // Legacy/shared tables
  'product_models_v2',
  'product_volumes',
  'area_catalog',
  'plants',
  'plant_product_volumes',
  'plant_model_routing',
  'plant_model_routing_predecessors',
  'family_changeover_defaults',
  'line_changeover_overrides',
  'user_preferences',
  'canvas_areas',
  'analysis_runs',
  'project_metadata',
  'changeover_method_configs',
] as const;

let mainWindow: BrowserWindow | null = null;

// ===== HELPER FUNCTIONS =====

/**
 * Query current project state from renderer using IPC event pattern.
 * Uses timeout to prevent hanging if renderer doesn't respond.
 */
async function getProjectStateFromRenderer(
  window: BrowserWindow
): Promise<ProjectStateFromRenderer | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[Project Handler] Timeout waiting for project state response');
      resolve(null);
    }, 1000);

    ipcMain.once(PROJECT_EVENTS.PROJECT_STATE_RESPONSE, (_event, state) => {
      clearTimeout(timeout);
      resolve(state);
    });

    window.webContents.send(PROJECT_EVENTS.GET_PROJECT_STATE_REQUEST);
  });
}

/**
 * Show native save prompt dialog for unsaved changes.
 * Returns user's choice: 'save', 'dont-save', or 'cancel'.
 */
async function showSavePromptForOperation(
  window: BrowserWindow,
  operation: 'open' | 'new'
): Promise<SaveDialogResult> {
  const message = operation === 'open'
    ? 'Do you want to save changes to Untitled Project before opening another file?'
    : 'Do you want to save changes to Untitled Project before creating a new project?';

  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Save As...', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Save Changes?',
    message,
    detail: 'Your changes will be lost if you don\'t save them.',
    noLink: true,
  });

  switch (result.response) {
    case 0:
      return 'save';
    case 1:
      return 'dont-save';
    case 2:
    default:
      return 'cancel';
  }
}

/**
 * Clear all data tables (preserves schema).
 * Used for "Don't Save" workflow.
 */
async function clearDataTables(): Promise<void> {
  const db = DatabaseConnection.getInstance();

  const clearAll = db.transaction(() => {
    for (const table of DATA_TABLES) {
      try {
        db.prepare(`DELETE FROM ${table}`).run();
      } catch (tableError) {
        console.warn(`[Project Handler] Could not clear table ${table}:`, tableError);
      }
    }
  });

  clearAll();
  console.log('[Project Handler] Data tables cleared for Don\'t Save workflow');
}

export function registerProjectHandlers(window: BrowserWindow): void {
  mainWindow = window;

  // ===== NEW PROJECT (BLOQUE 8: with unsaved changes check) =====
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

        // STEP 1: Check if current project has unsaved changes
        const state = await getProjectStateFromRenderer(mainWindow);

        // STEP 2: If unsaved changes exist, prompt to save first
        if (state?.hasUnsavedChanges) {
          const result = await showSavePromptForOperation(mainWindow, 'new');

          if (result === 'cancel') {
            console.log('[Project Handler] User cancelled new project');
            return {
              success: false,
              error: 'User cancelled',
            };
          }

          if (result === 'save') {
            // Trigger Save As, then create new project after save completes
            console.log('[Project Handler] User chose Save As before new project');
            mainWindow.webContents.send(PROJECT_EVENTS.TRIGGER_SAVE_AS_THEN_NEW);
            return {
              success: true,
            };
          }

          // result === 'dont-save': Clear data and continue with new project
          console.log('[Project Handler] User chose Don\'t Save - clearing data');
          await clearDataTables();
        }

        // STEP 3: Create new project using ProjectFileService
        const success = await ProjectFileService.newProject(DatabaseConnection.getInstance(), mainWindow);

        if (success) {
          // STEP 4: Notify renderer to reset to Untitled state
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_RESET, {
              projectType: 'untitled',
              filePath: null,
            });
          }

          console.log('[Project Handler] New project created successfully');
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

  // ===== OPEN PROJECT (BLOQUE 8: with unsaved changes check) =====
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

        // STEP 1: Check if current project has unsaved changes
        const state = await getProjectStateFromRenderer(mainWindow);

        // STEP 2: If Untitled + unsaved changes, prompt to save first
        if (state?.projectType === 'untitled' && state?.hasUnsavedChanges) {
          const result = await showSavePromptForOperation(mainWindow, 'open');

          if (result === 'cancel') {
            console.log('[Project Handler] User cancelled open project');
            return {
              success: false,
              error: 'User cancelled',
            };
          }

          if (result === 'save') {
            // Trigger Save As, then open file after save completes
            // Pass filePath so renderer knows which file to open after saving
            console.log('[Project Handler] User chose Save As before opening');
            mainWindow.webContents.send(PROJECT_EVENTS.TRIGGER_SAVE_AS_THEN_OPEN, filePath || null);
            return {
              success: true,
            };
          }

          // result === 'dont-save': Clear temp database and continue opening
          console.log('[Project Handler] User chose Don\'t Save - clearing temp database');
          await clearDataTables();
        }

        // STEP 3: Open project file using ProjectFileService
        const loadedDb = await ProjectFileService.openProject(
          filePath || null,
          mainWindow
        );

        if (loadedDb) {
          // STEP 4: Replace current database connection with .lop content
          DatabaseConnection.replaceInstance(loadedDb);

          // STEP 5: Notify renderer to update project state to 'saved'
          if (mainWindow && !mainWindow.isDestroyed()) {
            const projectState = ProjectFileService.getProjectState(loadedDb);
            mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_OPENED, {
              projectType: 'saved',
              filePath: projectState.currentFilePath,
            });
          }

          console.log('[Project Handler] Project opened successfully:', filePath);
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

  // ===== GET PROJECT STATE (Untitled Project Workflow) =====
  ipcMain.handle(
    PROJECT_CHANNELS.GET_PROJECT_STATE,
    async (): Promise<ApiResponse<UntitledProjectState>> => {
      try {
        // Get current database path dynamically
        const dbPath = DatabaseConnection.getPath();
        const isDefaultDB = dbPath?.includes('line-optimizer.db') ?? true;

        // Get hasChanges from ProjectFileService
        const hasChanges = ProjectFileService.hasChanges();

        // Determine project type based on database path
        const projectType = isDefaultDB ? 'untitled' : 'saved';

        const state: UntitledProjectState = {
          projectType,
          projectFilePath: isDefaultDB ? null : dbPath,
          hasUnsavedChanges: hasChanges,
          lastSavedAt: null, // Will be populated from ProjectFileService in future
        };

        return {
          success: true,
          data: state,
        };
      } catch (error) {
        console.error('[Project Handler] Get project state error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CLEAR TEMP DATABASE (Untitled Project Workflow) =====
  ipcMain.handle(
    PROJECT_CHANNELS.CLEAR_TEMP_DATABASE,
    async (): Promise<ApiResponse<void>> => {
      try {
        // Get current database instance dynamically (don't capture reference)
        const db = DatabaseConnection.getInstance();

        // Use transaction for atomic clear
        const clearAllTables = db.transaction(() => {
          for (const table of DATA_TABLES) {
            try {
              db.prepare(`DELETE FROM ${table}`).run();
            } catch (tableError) {
              // Table might not exist in older schemas, log and continue
              console.warn(`[Project Handler] Could not clear table ${table}:`, tableError);
            }
          }
        });

        clearAllTables();

        console.log('[Project Handler] Temporary database cleared successfully');

        return { success: true };
      } catch (error) {
        console.error('[Project Handler] Clear temp database error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CLEAR DATABASE AT PATH (Untitled Project Workflow) =====
  ipcMain.handle(
    PROJECT_CHANNELS.CLEAR_DATABASE_AT_PATH,
    async (_event, dbPath: string): Promise<ApiResponse<void>> => {
      try {
        // Open the specific database temporarily
        const Database = require('better-sqlite3');
        const db = new Database(dbPath);

        // Configure pragmas
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');

        // Use transaction for atomic clear
        const clearAllTables = db.transaction(() => {
          for (const table of DATA_TABLES) {
            try {
              db.prepare(`DELETE FROM ${table}`).run();
            } catch (tableError) {
              // Table might not exist in older schemas, log and continue
              console.warn(`[Project Handler] Could not clear table ${table}:`, tableError);
            }
          }
        });

        clearAllTables();

        // Close the temporary connection
        db.close();

        console.log(`[Project Handler] Database at ${dbPath} cleared successfully`);

        return { success: true };
      } catch (error) {
        console.error('[Project Handler] Clear database at path error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET DEFAULT DB PATH (Untitled Project Workflow) =====
  ipcMain.handle(
    PROJECT_CHANNELS.GET_DEFAULT_DB_PATH,
    async (): Promise<ApiResponse<string>> => {
      try {
        const defaultPath = DatabaseConnection.getDefaultPath();
        return { success: true, data: defaultPath };
      } catch (error) {
        console.error('[Project Handler] Get default DB path error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // NOTE: QUIT_AFTER_SAVE is registered in main/index.ts to access isQuitting flag

  console.log('[Project Handler] Registered project handlers');
}
