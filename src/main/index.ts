// ============================================
// MAIN PROCESS ENTRY POINT
// Electron Main Process
// ============================================

import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import DatabaseConnection from './database/connection';
import { registerAllHandlers } from './ipc/handlers';
import { PROJECT_EVENTS, PROJECT_CHANNELS, POWER_EVENTS } from '@shared/constants';
import { ApiResponse } from '@shared/types';
import { SQLitePlantRepository } from './database/repositories/SQLitePlantRepository';

// Type for save dialog result
type SaveDialogResult = 'save' | 'dont-save' | 'cancel';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

// Flag to track if app is in the process of quitting (after user confirmed)
let isQuitting = false;

// Periodic WAL checkpoint timer (Bug 5 fix)
let checkpointTimer: NodeJS.Timeout | null = null;

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

/**
 * Ensure shape catalog is seeded with built-in shapes.
 * Re-seeds if tables are empty (safety check for data integrity).
 */
function ensureShapesSeeded(db: any): void {
  try {
    // Check if shape_catalog has data
    const shapeCount = db.prepare('SELECT COUNT(*) as count FROM shape_catalog').get() as { count: number };

    if (shapeCount.count > 0) {
      console.log('[Main] Shape catalog already seeded');
      return;
    }

    console.log('[Main] Shape catalog empty, re-seeding built-in shapes...');

    // Re-seed shape categories
    db.prepare(`
      INSERT INTO shape_categories (id, name, display_order, icon) VALUES
        ('basic', 'Basic Shapes', 1, 'Shapes'),
        ('machines', 'Machines & Equipment', 2, 'Cog'),
        ('flow', 'Flow Control', 3, 'GitBranch'),
        ('custom', 'Custom', 99, 'Sparkles')
    `).run();

    // Re-seed basic shapes
    db.prepare(`
      INSERT INTO shape_catalog (id, category_id, name, description, source, render_type, primitive_type, default_width, default_height) VALUES
        ('rect-basic', 'basic', 'Rectangle', 'Standard rectangular shape for general use', 'builtin', 'primitive', 'rectangle', 200, 100),
        ('triangle-basic', 'basic', 'Triangle', 'Triangular shape for decision points or flow direction', 'builtin', 'primitive', 'triangle', 200, 120),
        ('circle-basic', 'basic', 'Circle', 'Circular shape for nodes or junctions', 'builtin', 'primitive', 'circle', 120, 120),
        ('diamond-basic', 'basic', 'Diamond', 'Diamond shape for decision or inspection points', 'builtin', 'primitive', 'diamond', 120, 120)
    `).run();

    // Re-seed shape anchors
    db.prepare(`
      INSERT INTO shape_anchors (id, shape_id, name, position, offset_x, offset_y, is_input, is_output) VALUES
        ('rect-top', 'rect-basic', 'top', 'top', 0.5, 0, 1, 1),
        ('rect-bottom', 'rect-basic', 'bottom', 'bottom', 0.5, 1, 1, 1),
        ('rect-left', 'rect-basic', 'left', 'left', 0, 0.5, 1, 1),
        ('rect-right', 'rect-basic', 'right', 'right', 1, 0.5, 1, 1),
        ('tri-top', 'triangle-basic', 'top', 'top', 0.5, 0, 1, 1),
        ('tri-bottom-left', 'triangle-basic', 'bottom-left', 'bottom', 0.25, 1, 1, 1),
        ('tri-bottom-right', 'triangle-basic', 'bottom-right', 'bottom', 0.75, 1, 1, 1),
        ('circle-top', 'circle-basic', 'top', 'top', 0.5, 0, 1, 1),
        ('circle-bottom', 'circle-basic', 'bottom', 'bottom', 0.5, 1, 1, 1),
        ('circle-left', 'circle-basic', 'left', 'left', 0, 0.5, 1, 1),
        ('circle-right', 'circle-basic', 'right', 'right', 1, 0.5, 1, 1),
        ('diamond-top', 'diamond-basic', 'top', 'top', 0.5, 0, 1, 1),
        ('diamond-bottom', 'diamond-basic', 'bottom', 'bottom', 0.5, 1, 1, 1),
        ('diamond-left', 'diamond-basic', 'left', 'left', 0, 0.5, 1, 1),
        ('diamond-right', 'diamond-basic', 'right', 'right', 1, 0.5, 1, 1)
    `).run();

    console.log('[Main] ✓ Shape catalog re-seeded successfully');
  } catch (error) {
    console.warn('[Main] Failed to re-seed shapes (may already exist):', error);
    // Non-fatal error - shapes might already exist from migration
  }
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

    // Safety check: Ensure shape catalog is seeded
    ensureShapesSeeded(db);
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

  // ============================================
  // POWER MONITOR - Handle Mac sleep/wake cycle
  // Fix: Bug 5 - Deleted objects reappear after sleep
  // ============================================
  powerMonitor.on('suspend', () => {
    console.log('[Main] System suspending - forcing WAL checkpoint');
    DatabaseConnection.checkpoint('TRUNCATE');
  });

  powerMonitor.on('shutdown', () => {
    console.log('[Main] System shutting down - forcing WAL checkpoint');
    DatabaseConnection.checkpoint('TRUNCATE');
  });

  powerMonitor.on('lock-screen', () => {
    console.log('[Main] Screen locked - forcing WAL checkpoint');
    DatabaseConnection.checkpoint('PASSIVE');
  });

  powerMonitor.on('resume', () => {
    console.log('[Main] System resumed from sleep');
    // Notify renderer to refresh state from DB
    const window = BrowserWindow.getAllWindows()[0];
    if (window && !window.isDestroyed()) {
      window.webContents.send(POWER_EVENTS.SYSTEM_RESUMED);
    }
  });

  // ============================================
  // PERIODIC WAL CHECKPOINT (Bug 5 defense-in-depth)
  // Checkpoint every 30 seconds to ensure writes persist
  // PASSIVE mode: non-blocking, safe for concurrent operations
  // ============================================
  checkpointTimer = setInterval(() => {
    DatabaseConnection.checkpoint('PASSIVE');
  }, 30000); // 30 seconds
  console.log('[Main] Periodic WAL checkpoint enabled (30s interval)');
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
  // Clear periodic checkpoint timer
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
    checkpointTimer = null;
  }

  // Force final WAL checkpoint before quit (Bug 5 fix)
  console.log('[Main] App quitting - forcing final WAL checkpoint');
  DatabaseConnection.checkpoint('TRUNCATE');

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
 * Note: area_catalog is cleared and starts empty (no default areas).
 * App is industry-agnostic - users define their own areas based on their processes.
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
