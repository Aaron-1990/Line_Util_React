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
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project As',
      defaultPath: this.currentFilePath || 'Untitled Project.lop',
      filters: [
        { name: 'Line Optimizer Project', extensions: ['lop'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return false; // User cancelled
    }

    const savePath = result.filePath;

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
        // Clear all data (keep schema)
        const tables = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'"
        ).all() as { name: string }[];

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
}
