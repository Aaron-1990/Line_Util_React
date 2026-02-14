// ============================================
// MAIN PROCESS ENTRY POINT
// Electron Main Process
// ============================================

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import DatabaseConnection from './database/connection';
import { registerAllHandlers } from './ipc/handlers';
import { PROJECT_EVENTS, PROJECT_CHANNELS } from '@shared/constants';
import { ApiResponse } from '@shared/types';
import { SQLitePlantRepository } from './database/repositories/SQLitePlantRepository';

// Type for save dialog result
type SaveDialogResult = 'save' | 'dont-save' | 'cancel';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

// Flag to track if app is in the process of quitting (after user confirmed)
let isQuitting = false;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Line Optimizer',
    backgroundColor: '#f9fafb',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Handle window close - delegate to before-quit hook for unified handling
  // The before-quit hook uses IPC event pattern to query renderer for project state
  mainWindow.on('close', (e) => {
    // If already in quit process, allow close
    if (isQuitting) {
      return;
    }

    // Prevent default close and trigger app.quit() instead
    // This ensures before-quit hook handles unsaved changes check
    e.preventDefault();
    app.quit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp(): Promise<void> {
  try {
    const db = DatabaseConnection.getInstance();
    console.log('Database initialized successfully');

    // Auto-create default plant on first run (Hybrid UX approach)
    const plantRepo = new SQLitePlantRepository(db);
    const existingPlants = await plantRepo.findAll();

    if (existingPlants.length === 0) {
      console.log('No plants found - creating default plant "My Plant"');

      // Auto-detect timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

      const newPlant = await plantRepo.create({
        code: 'PLANT-001',
        name: 'My Plant',
        timezone,
      });

      // Set as default plant (first plant should be default)
      await plantRepo.setDefault(newPlant.id);

      console.log('✓ Default plant "My Plant" created successfully');
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}

app.on('ready', async () => {
  await initializeApp();
  createMainWindow();

  // Register IPC handlers after window is created (project handlers need window for dialogs)
  if (mainWindow) {
    registerAllHandlers(mainWindow);
    console.log('IPC handlers registered successfully');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    DatabaseConnection.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// ============================================
// QUIT AFTER SAVE IPC HANDLER (BLOQUE 5)
// Called by renderer after successful Save As during close
// Must be registered here in main/index.ts to access isQuitting flag
// ============================================
ipcMain.handle(
  PROJECT_CHANNELS.QUIT_AFTER_SAVE,
  async (): Promise<ApiResponse<void>> => {
    console.log('[Main] Quit after save requested - proceeding to quit');
    isQuitting = true;
    app.quit();
    return { success: true };
  }
);

// ============================================
// BEFORE-QUIT HOOK - Untitled Project Workflow
// Intercepts app close to check for unsaved changes
// ============================================
app.on('before-quit', async (event) => {
  // If already handling quit, allow it to proceed
  if (isQuitting) {
    DatabaseConnection.close();
    return;
  }

  // Get the main window
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) {
    // No window, allow quit
    isQuitting = true;
    DatabaseConnection.close();
    return;
  }

  // Prevent immediate quit while we check project state
  event.preventDefault();

  try {
    // Query renderer for current project state using IPC event pattern
    const projectState = await getProjectStateFromRenderer(window);

    // Check if Untitled + unsaved changes
    if (projectState?.projectType === 'untitled' && projectState?.hasUnsavedChanges) {
      console.log('[Main] Untitled project has unsaved changes - showing save prompt');

      // Show native save prompt dialog
      const result = await showSavePrompt(window);

      if (result === 'cancel') {
        // User cancelled - don't quit, return to app
        console.log('[Main] User cancelled quit - returning to app');
        return;
      }

      if (result === 'save') {
        // Trigger Save As - renderer will handle the save dialog
        // After successful save, renderer will call app:quit-after-save
        console.log('[Main] User chose Save As - triggering save dialog');
        window.webContents.send(PROJECT_EVENTS.TRIGGER_SAVE_AS);
        // Don't quit yet - wait for save completion
        return;
      }

      if (result === 'dont-save') {
        // Clear temp database before quitting (BLOQUE 6)
        console.log('[Main] User chose Don\'t Save - clearing temp database');
        await clearTempDatabase();
      }
    }

    // Allow quit after handling
    isQuitting = true;
    app.quit();

  } catch (error) {
    console.error('[Main] Error checking project state on quit:', error);
    // On error, allow quit to prevent app from hanging
    isQuitting = true;
    app.quit();
  }
});

/**
 * Query current project state from renderer using IPC event pattern.
 *
 * @description
 * Sends GET_PROJECT_STATE_REQUEST event to renderer, waits for
 * PROJECT_STATE_RESPONSE. Uses timeout to prevent hanging if
 * renderer doesn't respond.
 *
 * @param window - Main browser window to query
 * @returns Project state or null if timeout/error
 */
async function getProjectStateFromRenderer(
  window: BrowserWindow
): Promise<{ projectType: 'untitled' | 'saved'; hasUnsavedChanges: boolean; projectFilePath: string | null } | null> {
  return new Promise((resolve) => {
    // Timeout fallback: 1 second
    const timeout = setTimeout(() => {
      console.warn('[Main] Timeout waiting for project state response');
      resolve(null);
    }, 1000);

    // Listen for response from renderer (one-time)
    ipcMain.once(PROJECT_EVENTS.PROJECT_STATE_RESPONSE, (_event, state) => {
      clearTimeout(timeout);
      resolve(state);
    });

    // Request state from renderer
    window.webContents.send(PROJECT_EVENTS.GET_PROJECT_STATE_REQUEST);
  });
}

/**
 * Show native Electron save prompt dialog with 3 options.
 *
 * @description
 * Uses dialog.showMessageBox to display a native OS dialog asking
 * the user whether to save changes to an Untitled Project before closing.
 *
 * Button layout (following Excel/Word convention):
 * - Save As... (index 0, default)
 * - Don't Save (index 1)
 * - Cancel (index 2)
 *
 * @param window - Parent window for the dialog
 * @returns User's choice: 'save', 'dont-save', or 'cancel'
 */
async function showSavePrompt(window: BrowserWindow): Promise<SaveDialogResult> {
  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Save As...', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Save Changes?',
    message: 'Do you want to save changes to Untitled Project?',
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
 * Clear all user data from the temporary database.
 *
 * @description
 * Deletes all rows from data tables while preserving schema (tables, indexes,
 * triggers, views). Used when user chooses "Don't Save" on app close.
 *
 * Tables cleared (in FK-safe order - children before parents):
 * - Canvas system: canvas_connections, buffer_properties, process_properties,
 *   process_line_links, canvas_object_compatibilities, canvas_objects
 * - Routing: model_area_predecessors, model_area_routing,
 *   plant_model_routing_predecessors, plant_model_routing
 * - Volumes: product_volumes, plant_product_volumes
 * - Changeover: line_changeover_overrides, family_changeover_defaults
 * - Core: product_models_v2, plants, analysis_runs, canvas_areas
 * - Settings: user_preferences, changeover_method_configs, project_metadata
 *
 * Tables preserved (seed/system data):
 * - migrations (schema tracking)
 * - shape_categories, shape_catalog, shape_anchors (built-in shapes)
 * - _archived_*, _migration_*, _production_line_id_mapping (migration artifacts)
 *
 * Note: area_catalog is cleared (includes user-created areas) but default areas
 * are automatically re-seeded on next app open via migration 001 (INSERT OR IGNORE)
 *
 * Uses a transaction for atomicity - all or nothing.
 */
async function clearTempDatabase(): Promise<void> {
  try {
    const db = DatabaseConnection.getInstance();

    // List of data tables to clear, ordered for FK safety (children first)
    // This order respects foreign key constraints by deleting dependent records first
    const tablesToClear = [
      // Canvas system (deepest dependencies first)
      'canvas_connections',
      'buffer_properties',
      'process_properties',
      'process_line_links',
      'canvas_object_compatibilities',
      'canvas_objects',

      // Routing DAG (edges before nodes)
      'model_area_predecessors',
      'model_area_routing',
      'plant_model_routing_predecessors',
      'plant_model_routing',

      // Volumes (plant-specific then global)
      'plant_product_volumes',
      'product_volumes',

      // Changeover (overrides before defaults)
      'line_changeover_overrides',
      'family_changeover_defaults',

      // Core entities (models before plants due to FK)
      'product_models_v2',
      'plants',

      // Catalogs (user-created + seed data - will be re-seeded on next run via migrations)
      'area_catalog',

      // Historical/UI data
      'analysis_runs',
      'canvas_areas',

      // Settings (can be re-seeded on next run if needed)
      'user_preferences',
      'changeover_method_configs',
      'project_metadata',
    ];

    // Execute all DELETEs in a transaction for atomicity
    const clearAll = db.transaction(() => {
      // Temporarily disable foreign key checks to avoid ordering issues
      // (SQLite only enforces FK at statement level, not transaction level)
      db.pragma('foreign_keys = OFF');

      for (const table of tablesToClear) {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
          console.log(`[Main] Cleared table: ${table}`);
        } catch (tableError) {
          // Table might not exist in older schemas - log and continue
          console.warn(`[Main] Could not clear table ${table}:`, tableError);
        }
      }

      // Re-enable foreign key checks
      db.pragma('foreign_keys = ON');
    });

    clearAll();

    console.log('[Main] Temporary database cleared successfully - next app open will be empty');

  } catch (error) {
    console.error('[Main] Failed to clear temporary database:', error);
    // Don't throw - allow app to quit even if cleanup fails
    // Next app open will have stale data, but that's better than blocking quit
  }
}

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled rejection:', error);
});
