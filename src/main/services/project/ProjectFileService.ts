import Database from 'better-sqlite3';
import { dialog, BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { VersionChecker } from './VersionChecker';
import { ProjectMetadataHelper } from '@main/database/helpers/ProjectMetadataHelper';
import { MigrationRunner } from '@main/database/MigrationRunner';
import { ProjectState } from '@shared/types/project';
import DatabaseConnection from '@main/database/connection';
import { DB_CONFIG } from '@shared/constants';
import { SQLitePlantRepository } from '@main/database/repositories/SQLitePlantRepository';

/**
 * Manages project file operations (open, save, save-as).
 */
export class ProjectFileService {
  private static currentFilePath: string | null = null;
  private static hasUnsavedChanges: boolean = false;

  /**
   * Open a .lop file with version checking and migration.
   * @param filePath Path to .lop file (or null to show dialog)
   * @param mainWindow Main window for showing dialogs
   * @returns Database instance or null if user cancelled/error
   */
  static async openProject(
    filePath: string | null,
    mainWindow: BrowserWindow
  ): Promise<Database.Database | null> {
    // 1. Show file dialog if no path provided
    if (!filePath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Project',
        filters: [
          { name: 'Line Optimizer Project', extensions: ['lop'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null; // User cancelled
      }

      filePath = result.filePaths[0] || null;
    }

    // 2. Verify file exists
    if (!filePath || !fs.existsSync(filePath)) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'File Not Found',
        message: `Project file not found: ${filePath}`,
        buttons: ['OK']
      });
      return null;
    }

    // 3. Open database temporarily to check version
    let db: Database.Database;
    try {
      db = new Database(filePath as string, { readonly: false });
    } catch (error) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid Project File',
        message: 'Failed to open project file.',
        detail: error instanceof Error ? error.message : 'Unknown error',
        buttons: ['OK']
      });
      return null;
    }

    // 4. Check compatibility
    const compat = VersionChecker.checkCompatibility(db);

    // 5. Handle incompatible file (newer version)
    if (!compat.canOpen) {
      db.close();

      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: compat.message,
        message: compat.detail || compat.message,
        buttons: ['OK']
      });

      return null;
    }

    // 6. Handle file that needs migration
    if (compat.needsMigration) {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: compat.message,
        message: compat.detail || compat.message,
        buttons: ['Cancel', 'Upgrade Project'],
        defaultId: 1,
        cancelId: 0
      });

      if (choice.response === 0) {
        // User cancelled
        db.close();
        return null;
      }

      // 7. Create backup before migration
      const backupPath = `${filePath}.backup-${Date.now()}`;
      try {
        fs.copyFileSync(filePath as string, backupPath);
        console.log(`[ProjectFileService] Backup created: ${backupPath}`);
      } catch (error) {
        db.close();
        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Backup Failed',
          message: 'Failed to create backup before migration.',
          detail: error instanceof Error ? error.message : 'Unknown error',
          buttons: ['OK']
        });
        return null;
      }

      // 8. Run migrations
      try {
        const runner = new MigrationRunner(db);
        runner.runPendingMigrations();

        // Update metadata
        VersionChecker.updateMetadata(db);

        console.log(`[ProjectFileService] Project upgraded: ${filePath}`);

        // Show success message
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Project Upgraded',
          message: 'Project has been successfully upgraded to the current version.',
          detail: `Backup saved as:\n${path.basename(backupPath)}`,
          buttons: ['OK']
        });

        // NEW: Close and re-open the migrated database
        db.close();
        console.log(`[ProjectFileService] Closed database after migration`);

        db = new Database(filePath as string, { readonly: false });
        DatabaseConnection.configurePragmas(db); // Apply FK + WAL
        console.log(`[ProjectFileService] Re-opened migrated database`);
      } catch (error) {
        db.close();

        // Restore backup on failure
        try {
          fs.copyFileSync(backupPath, filePath as string);
          console.log(`[ProjectFileService] Backup restored after failed migration`);
        } catch (restoreError) {
          console.error(`[ProjectFileService] Failed to restore backup:`, restoreError);
        }

        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Upgrade Failed',
          message: 'Failed to upgrade project file.',
          detail:
            (error instanceof Error ? error.message : 'Unknown error') +
            '\n\nThe original file has been restored from backup.',
          buttons: ['OK']
        });

        return null;
      }
    }

    // 9. File is ready - set as current project
    this.currentFilePath = filePath;
    this.hasUnsavedChanges = false;

    // Log the metadata being loaded
    const loadedMetadata = ProjectMetadataHelper.read(db);
    console.log(`[ProjectFileService] Opened project: "${loadedMetadata?.projectName}" from ${filePath}`);

    return db;
  }

  /**
   * Save project to current file path.
   * @param sourceDb Active database connection
   * @param mainWindow Main window for showing dialogs
   * @returns Success status
   */
  static async saveProject(
    sourceDb: Database.Database,
    mainWindow: BrowserWindow
  ): Promise<boolean> {
    // If no current file path, use Save As
    if (!this.currentFilePath) {
      return this.saveProjectAs(sourceDb, mainWindow);
    }

    try {
      // Backup current database to file path
      await sourceDb.backup(this.currentFilePath);

      // Update metadata in the saved file
      const savedDb = new Database(this.currentFilePath);
      VersionChecker.updateMetadata(savedDb);
      savedDb.close();

      this.hasUnsavedChanges = false;

      console.log(`[ProjectFileService] Project saved: ${this.currentFilePath}`);
      return true;
    } catch (error) {
      console.error('[ProjectFileService] Save failed:', error);

      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save project file.',
        detail: error instanceof Error ? error.message : 'Unknown error',
        buttons: ['OK']
      });

      return false;
    }
  }

  /**
   * Save project to new file path (Save As).
   * @param sourceDb Active database connection
   * @param mainWindow Main window for showing dialogs
   * @returns Success status
   */
  static async saveProjectAs(
    sourceDb: Database.Database,
    mainWindow: BrowserWindow
  ): Promise<boolean> {
    // Pre-sanitize default filename to prevent common errors
    const currentName = this.currentFilePath
      ? path.basename(this.currentFilePath, '.lop')
      : 'Untitled Project';

    // Sanitize the current name (in case it has dots or invalid chars)
    const tempPath = path.join(
      app.getPath('documents'),
      currentName + '.lop'
    );
    const sanitizedDefaultPath = this.sanitizeFilePath(tempPath);

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project As',
      defaultPath: sanitizedDefaultPath,
      filters: [
        { name: 'Line Optimizer Project', extensions: ['lop'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      message: 'Avoid dots (.) and special characters in filenames.' // macOS only
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    // Post-validate: Sanitize user input
    const requestedPath = result.filePath;
    const sanitizedPath = this.sanitizeFilePath(requestedPath);

    // If path changed, confirm with user
    if (sanitizedPath !== requestedPath) {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Invalid Filename',
        message: 'The filename contains invalid characters.',
        detail:
          `Requested: ${path.basename(requestedPath)}\n` +
          `Will save as: ${path.basename(sanitizedPath)}\n\n` +
          `Tip: Avoid dots (.) and special characters (<>:"/\\|?*) in filenames.`,
        buttons: ['Cancel', 'Save with Corrected Name'],
        defaultId: 1,
        cancelId: 0
      });

      if (choice.response === 0) {
        console.log('[ProjectFileService] User cancelled save due to filename correction');
        return false; // User cancelled
      }
    }

    const savePath = sanitizedPath; // Use sanitized path for save

    try {
      // Backup to new path
      await sourceDb.backup(savePath);

      // Update metadata in saved file
      const savedDb = new Database(savePath);

      // Get project name from file name
      const projectName = path.basename(savePath, '.lop');
      console.log(`[ProjectFileService] Setting project name to: "${projectName}"`);

      // Initialize metadata if new project, otherwise update project name
      const existingMetadata = ProjectMetadataHelper.read(savedDb);
      if (!existingMetadata) {
        console.log('[ProjectFileService] Initializing new metadata');
        ProjectMetadataHelper.initialize(savedDb, projectName);
      } else {
        console.log(`[ProjectFileService] Updating existing metadata, old name: "${existingMetadata.projectName}"`);
        // Update project name to match file name
        ProjectMetadataHelper.update(savedDb, { projectName });
      }

      // Verify the update
      const updatedMetadata = ProjectMetadataHelper.read(savedDb);
      console.log(`[ProjectFileService] Verified project name in file: "${updatedMetadata?.projectName}"`);

      VersionChecker.updateMetadata(savedDb);
      savedDb.close();

      // Re-open the saved file and make it the active database
      // This ensures subsequent operations work on the saved file, not the original DB
      const newDb = new Database(savePath, { readonly: false });
      DatabaseConnection.replaceInstance(newDb);

      // Update current file path
      this.currentFilePath = savePath;
      this.hasUnsavedChanges = false;

      console.log(`[ProjectFileService] Project saved as: ${savePath}`);
      console.log(`[ProjectFileService] Active database switched to: ${savePath}`);
      return true;
    } catch (error) {
      console.error('[ProjectFileService] Save As failed:', error);

      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save project file.',
        detail: error instanceof Error ? error.message : 'Unknown error',
        buttons: ['OK']
      });

      return false;
    }
  }

  /**
   * Create new project (clear current database).
   * @param db Active database connection
   * @param mainWindow Main window for showing dialogs
   * @returns Success status
   */
  static async newProject(
    db: Database.Database,
    mainWindow: BrowserWindow
  ): Promise<boolean> {
    // Check for unsaved changes
    if (this.hasUnsavedChanges) {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Do you want to save before creating a new project?',
        buttons: ['Cancel', 'Discard Changes', 'Save'],
        defaultId: 2,
        cancelId: 0
      });

      if (choice.response === 0) {
        return false; // User cancelled
      }

      if (choice.response === 2) {
        // User wants to save
        const saved = await this.saveProject(db, mainWindow);
        if (!saved) return false; // Save failed or cancelled
      }

      // choice.response === 1: Discard changes, continue
    }

    try {
      // If a project file is open, switch back to default database before clearing
      if (this.currentFilePath) {
        console.log('[ProjectFileService] Closing project file, switching to default database');
        const userDataPath = app.getPath('userData');
        const defaultDbPath = path.join(userDataPath, DB_CONFIG.FILE_NAME);
        const defaultDb = new Database(defaultDbPath, { readonly: false });
        DatabaseConnection.replaceInstance(defaultDb);
        db = defaultDb; // Update local reference
      }

      // Verify database is open
      if (!db.open) {
        throw new Error('Database connection is not open');
      }

      // Disable foreign key constraints before clearing data
      // This must be done OUTSIDE of any transaction
      db.pragma('foreign_keys = OFF');

      try {
        // Clear all data (keep schema and system tables)
        // Exclude:
        // - migrations: schema version tracking
        // - shape_catalog, shape_categories, shape_anchors: built-in system data
        const tables = db.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table'
            AND name NOT LIKE 'sqlite_%'
            AND name NOT IN ('migrations', 'shape_catalog', 'shape_categories', 'shape_anchors')
        `).all() as { name: string }[];

        const transaction = db.transaction(() => {
          tables.forEach(table => {
            db.prepare(`DELETE FROM ${table.name}`).run();
          });
        });

        transaction();
      } finally {
        // Always re-enable foreign keys
        db.pragma('foreign_keys = ON');
      }

      // Auto-create default plant for new project (same logic as initializeApp)
      const plantRepo = new SQLitePlantRepository(db);
      console.log('[ProjectFileService] Creating default plant for new project');

      // Auto-detect timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

      const newPlant = await plantRepo.create({
        code: 'PLANT-001',
        name: 'My Plant',
        timezone,
      });

      // Set as default plant
      await plantRepo.setDefault(newPlant.id);
      console.log('[ProjectFileService] ✓ Default plant "My Plant" created successfully');

      // Re-seed shape catalog if empty (safety check)
      // This ensures shapes are always available after creating new project
      this.ensureShapesSeeded(db);

      // Initialize metadata for new project
      ProjectMetadataHelper.initialize(db, 'Untitled Project');

      // Reset state
      this.currentFilePath = null;
      this.hasUnsavedChanges = false;

      console.log('[ProjectFileService] New project created');
      return true;
    } catch (error) {
      console.error('[ProjectFileService] New project failed:', error);

      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Failed to Create New Project',
        message: 'An error occurred while creating a new project.',
        detail: error instanceof Error ? error.message : 'Unknown error',
        buttons: ['OK']
      });

      return false;
    }
  }

  /**
   * Get current project state.
   */
  static getProjectState(db: Database.Database): ProjectState {
    const metadata = ProjectMetadataHelper.read(db);

    return {
      currentFilePath: this.currentFilePath,
      metadata: metadata || {
        appVersion: '0.0.0',
        schemaVersion: 0,
        createdAt: '',
        lastModifiedAt: '',
        lastModifiedBy: '',
        projectName: 'Untitled Project',
      },
      hasUnsavedChanges: this.hasUnsavedChanges,
    };
  }

  /**
   * Mark project as modified (user made changes).
   */
  static markAsModified(): void {
    this.hasUnsavedChanges = true;
  }

  /**
   * Check if project has unsaved changes.
   */
  static hasChanges(): boolean {
    return this.hasUnsavedChanges;
  }

  /**
   * Sanitize file path by removing invalid characters and handling edge cases.
   *
   * Handles:
   * - Windows forbidden chars: < > : " / \ | ? *
   * - Control chars: 0x00-0x1F (invisible characters)
   * - Intermediate dots (extension parsing ambiguity)
   * - Leading/trailing whitespace
   * - Multiple consecutive spaces
   * - Windows reserved names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
   * - Empty filenames
   * - Excessive length (max 200 chars)
   *
   * @param filePath - Full path to sanitize
   * @returns Sanitized file path with directory preserved
   *
   * @example
   * sanitizeFilePath('/Users/me/test.1.lop')
   * // => '/Users/me/test_1.lop'
   *
   * @example
   * sanitizeFilePath('/Users/me/Project<new>.lop')
   * // => '/Users/me/Project_new_.lop'
   *
   * @example
   * sanitizeFilePath('/Users/me/CON.lop')
   * // => '/Users/me/CON_file.lop'
   */
  /**
   * Ensure shape catalog is seeded with built-in shapes.
   * Re-seeds if tables are empty (safety check for data integrity).
   * @param db Database instance to check and seed
   */
  private static ensureShapesSeeded(db: Database.Database): void {
    try {
      // Check if shape_catalog has data
      const shapeCount = db.prepare('SELECT COUNT(*) as count FROM shape_catalog').get() as { count: number };

      if (shapeCount.count > 0) {
        console.log('[ProjectFileService] Shape catalog already seeded, skipping');
        return;
      }

      console.log('[ProjectFileService] Shape catalog empty, re-seeding built-in shapes...');

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

      console.log('[ProjectFileService] ✓ Shape catalog re-seeded successfully');
    } catch (error) {
      console.warn('[ProjectFileService] Failed to re-seed shapes (may already exist):', error);
      // Non-fatal error - shapes might already exist from migration
    }
  }

  private static sanitizeFilePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath); // e.g., ".lop"
    let basename = path.basename(filePath, ext); // e.g., "test.1" from "test.1.lop"

    // Step 1: Remove control characters (0x00-0x1F)
    basename = basename.replace(/[\x00-\x1F]/g, '_');

    // Step 2: Remove Windows forbidden characters
    basename = basename.replace(/[<>:"/\\|?*]/g, '_');

    // Step 3: Remove dots (intermediate dots, leading dots, multiple dots)
    basename = basename.replace(/\./g, '_');

    // Step 4: Collapse multiple spaces into single space
    basename = basename.replace(/\s+/g, ' ');

    // Step 5: Trim leading/trailing whitespace
    basename = basename.trim();

    // Step 6: Replace spaces with underscores for cleaner filenames
    basename = basename.replace(/\s/g, '_');

    // Step 7: Check for Windows reserved names
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const upperBasename = basename.toUpperCase();
    if (reservedNames.includes(upperBasename)) {
      basename = `${basename}_file`; // "CON" → "CON_file"
    }

    // Step 8: Prevent empty filename
    if (basename.length === 0) {
      basename = 'Untitled_Project';
    }

    // Step 9: Limit length (Windows max = 255, but leave margin for full path)
    const maxLength = 200;
    if (basename.length > maxLength) {
      basename = basename.substring(0, maxLength);
    }

    return path.join(dir, basename + ext);
  }
}
