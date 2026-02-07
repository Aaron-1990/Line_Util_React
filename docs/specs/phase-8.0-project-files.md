# Phase 8.0: Project Files Foundation Specification

## Metadata
- **Designed:** 2026-02-06
- **Designer:** Aaron Zapata
- **Project:** Line Optimizer
- **Framework:** Híbrido v2.0
- **Domain:** Manufacturing Engineering
- **Recommended Agents:** `backend-architect`, `frontend-developer`
- **Estimated Complexity:** Medium-High (5-7 days)

---

## Context

### Business Problem

Currently, Line Optimizer operates with a single local SQLite database. Users face critical limitations:

1. **No project persistence:** Work is lost when switching between different analysis scenarios
2. **No portability:** Cannot move projects between machines (home/office, engineer/manager)
3. **No collaboration:** Cannot share project files via email, USB, or cloud storage
4. **No archiving:** No way to save analysis results for future reference or auditing

### Solution: .lop Project Files

Implement save/load functionality with `.lop` project files (Line Optimizer Project) that:
- Contain complete project data (lines, models, volumes, canvas layout)
- Are portable across machines and OS platforms
- Support version migration (open old files in new app versions)
- Include metadata for tracking (project name, created date, app version)

### User Workflows Enabled

```
Engineer A (Juarez Plant):
  1. Import production data
  2. Configure canvas layout
  3. Run optimization
  4. Save as "Juarez_Q1_2026.lop"
  5. Email file to Manager B

Manager B:
  1. Receives "Juarez_Q1_2026.lop"
  2. Opens in Line Optimizer
  3. Reviews results
  4. Makes changes (add 2 lines)
  5. Saves as "Juarez_Q1_2026_v2.lop"
  6. Sends back for validation
```

### Key Requirements

1. **File format:** SQLite database (same as app database)
2. **Version management:** Automatic migration of old files to new schema
3. **Data integrity:** Backup before migration, rollback on failure
4. **User experience:** Clear dialogs, no data loss, intuitive File menu

---

## BLOQUE 0: Contracts & Architecture

### Principles Applied

1. **SQLite Snapshot Pattern:** Project file = copy of database with metadata
2. **Migration on Open:** Detect version differences, migrate with user confirmation
3. **Fail-Safe:** Automatic backup before any migration
4. **Forward Compatibility Prevention:** Block opening new files in old apps (clear error message)
5. **Metadata-Driven:** All version decisions based on `project_metadata` table

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTIONS                              │
├─────────────────────────────────────────────────────────────┤
│  File → New Project                                          │
│  File → Open Project (.lop)                             │
│  File → Save Project (Ctrl+S)                               │
│  File → Save Project As... (Ctrl+Shift+S)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              IPC HANDLERS (Main Process)                     │
├─────────────────────────────────────────────────────────────┤
│  project:new        → Clear database, reset state           │
│  project:open       → File dialog → Load & migrate          │
│  project:save       → Save to current path                  │
│  project:save-as    → File dialog → Save to new path        │
│  project:get-info   → Return current project metadata       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            PROJECT FILE SERVICE                              │
├─────────────────────────────────────────────────────────────┤
│  openProject(path)                                           │
│    ├─> VersionChecker.checkCompatibility()                  │
│    ├─> User confirmation dialog                             │
│    ├─> Backup original file                                 │
│    ├─> MigrationRunner.runPendingMigrations()              │
│    └─> VersionChecker.updateMetadata()                      │
│                                                              │
│  saveProject(path)                                           │
│    ├─> Database.backup(path)                                │
│    └─> Update project_metadata                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              VERSION CHECKER                                 │
├─────────────────────────────────────────────────────────────┤
│  checkCompatibility(db): VersionCompatibility               │
│    ├─> Read project_metadata                                │
│    ├─> Compare schemaVersion vs current                     │
│    ├─> Detect breaking changes                              │
│    └─> Return compatibility result                          │
│                                                              │
│  updateMetadata(db)                                          │
│    └─> Write current app/schema version                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Model

#### project_metadata Table

```sql
-- Migration 018_project_metadata.sql
CREATE TABLE IF NOT EXISTS project_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed on project creation
INSERT INTO project_metadata (key, value) VALUES
  ('app_version', '0.8.0'),           -- Semantic version (from package.json)
  ('schema_version', '18'),           -- DB schema version (from migrations)
  ('created_at', datetime('now')),    -- UTC timestamp
  ('last_modified_at', datetime('now')),
  ('last_modified_by', '0.8.0'),      -- App version that last saved
  ('project_name', 'Untitled Project'),
  ('description', '');                -- Optional project description
```

#### TypeScript Interfaces

```typescript
// src/shared/types/project.ts

/**
 * Project metadata stored in every .lop file.
 */
export interface ProjectMetadata {
  /** Semantic version of app that created this file (e.g., "0.8.0") */
  appVersion: string;

  /** Database schema version (matches migration number, e.g., 18) */
  schemaVersion: number;

  /** UTC timestamp of file creation (ISO 8601) */
  createdAt: string;

  /** UTC timestamp of last modification (ISO 8601) */
  lastModifiedAt: string;

  /** App version that last modified this file */
  lastModifiedBy: string;

  /** Human-readable project name */
  projectName: string;

  /** Optional project description */
  description?: string;
}

/**
 * Result of version compatibility check.
 * Determines if a project file can be opened and what actions are needed.
 */
export interface VersionCompatibility {
  /** Can the file be opened in this app version? */
  canOpen: boolean;

  /** Does the file need migration to current schema? */
  needsMigration: boolean;

  /** Is the file from a newer app version? (forward compatibility issue) */
  isNewer: boolean;

  /** User-facing message explaining the situation */
  message: string;

  /** Detailed explanation (shown in dialog detail field) */
  detail?: string;

  /** List of migrations that will be applied (if needsMigration) */
  pendingMigrations?: Array<{ version: number; name: string }>;

  /** Warning about breaking changes (if any) */
  breakingChanges?: string[];
}

/**
 * Current project state in app.
 */
export interface ProjectState {
  /** Path to currently open .lop file (null if new unsaved project) */
  currentFilePath: string | null;

  /** Project metadata from file */
  metadata: ProjectMetadata;

  /** Has the project been modified since last save? */
  hasUnsavedChanges: boolean;
}
```

### IPC Channels

```typescript
// src/shared/constants/index.ts

export const PROJECT_CHANNELS = {
  // Project lifecycle
  NEW: 'project:new',
  OPEN: 'project:open',
  SAVE: 'project:save',
  SAVE_AS: 'project:save-as',
  CLOSE: 'project:close',

  // Project state queries
  GET_INFO: 'project:get-info',
  GET_RECENT: 'project:get-recent',
  HAS_UNSAVED_CHANGES: 'project:has-unsaved-changes',

  // Metadata operations
  UPDATE_METADATA: 'project:update-metadata',
} as const;

export const PROJECT_EVENTS = {
  // Emitted when project state changes
  PROJECT_OPENED: 'project:opened',
  PROJECT_SAVED: 'project:saved',
  PROJECT_CLOSED: 'project:closed',
  PROJECT_MODIFIED: 'project:modified', // User made changes
} as const;
```

### File Naming Convention

```
User-facing:
  Juarez_Q1_2026.lop
  BorgWarner_Analysis_2026-02-06.lop
  Test_Scenario_v3.lop

Backup files (auto-created before migration):
  Juarez_Q1_2026.lop.backup-1738876543210
  (timestamp = milliseconds since epoch)
```

### Trade-offs & Decisions

| Decision | Chosen Option | Alternative | Justification |
|----------|---------------|-------------|---------------|
| **File format** | SQLite database | JSON, ZIP(SQLite+JSON) | Native format, zero-copy, queries possible |
| **Migration strategy** | Automatic with confirmation | Manual export/import | User-friendly, matches industry standard (Excel, MS Project) |
| **Backup strategy** | Auto-backup before migration | No backup | Fail-safe, allows manual rollback |
| **Forward compatibility** | Block opening (error message) | Attempt to open with degradation | Simpler, clearer error messages |
| **Metadata storage** | Key-value table | JSON column | Flexible, queryable, extensible |
| **Version identifier** | Both app_version & schema_version | Only one | App version for UI, schema version for logic |

---

## BLOQUE 1: Database Schema - project_metadata Table

**Objetivo:** Add metadata table to track project version and information.

**Migration File:** `src/main/database/migrations/018_project_metadata.sql`

```sql
-- ============================================
-- MIGRATION 018: Project Metadata
-- PHASE: 8.0 - Project Files Foundation
-- BREAKING CHANGE: NO
-- BACKWARD COMPATIBLE: YES (only adds table)
-- ============================================

CREATE TABLE IF NOT EXISTS project_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster lookups (optimization)
CREATE INDEX IF NOT EXISTS idx_project_metadata_updated
  ON project_metadata(updated_at);

-- Seed default metadata
-- Note: app_version and schema_version will be set by ProjectFileService
INSERT OR IGNORE INTO project_metadata (key, value) VALUES
  ('project_name', 'Untitled Project'),
  ('description', ''),
  ('created_at', datetime('now')),
  ('last_modified_at', datetime('now'));

-- Add comment for future developers
-- SQLite doesn't support COMMENT ON, so we document in migration file:
--
-- project_metadata stores key-value pairs for:
--   - app_version: Semantic version (e.g., "0.8.0")
--   - schema_version: Migration number (e.g., "18")
--   - created_at: UTC timestamp of project creation
--   - last_modified_at: UTC timestamp of last save
--   - last_modified_by: App version that last saved this project
--   - project_name: User-defined project name
--   - description: Optional project description
```

**Helper Functions:**

```typescript
// src/main/database/helpers/ProjectMetadataHelper.ts

import Database from 'better-sqlite3';
import { ProjectMetadata } from '@shared/types/project';
import pkg from '../../../../package.json';

const CURRENT_APP_VERSION = pkg.version; // e.g., "0.8.0"
const CURRENT_SCHEMA_VERSION = 18; // Update when adding migrations

export class ProjectMetadataHelper {
  /**
   * Initialize metadata for a new project.
   */
  static initialize(db: Database.Database, projectName: string = 'Untitled Project'): void {
    const stmt = db.prepare('INSERT OR REPLACE INTO project_metadata (key, value) VALUES (?, ?)');

    const metadata = {
      app_version: CURRENT_APP_VERSION,
      schema_version: CURRENT_SCHEMA_VERSION.toString(),
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      last_modified_by: CURRENT_APP_VERSION,
      project_name: projectName,
      description: '',
    };

    const transaction = db.transaction(() => {
      Object.entries(metadata).forEach(([key, value]) => {
        stmt.run(key, value);
      });
    });

    transaction();
  }

  /**
   * Read metadata from database.
   */
  static read(db: Database.Database): ProjectMetadata | null {
    try {
      const rows = db.prepare('SELECT key, value FROM project_metadata').all() as Array<{key: string, value: string}>;

      if (rows.length === 0) return null;

      const data: Record<string, string> = {};
      rows.forEach(row => data[row.key] = row.value);

      return {
        appVersion: data.app_version || '0.0.0',
        schemaVersion: parseInt(data.schema_version || '0', 10),
        createdAt: data.created_at || '',
        lastModifiedAt: data.last_modified_at || '',
        lastModifiedBy: data.last_modified_by || '',
        projectName: data.project_name || 'Untitled Project',
        description: data.description,
      };
    } catch (error) {
      // Table doesn't exist - legacy file before Phase 8
      return null;
    }
  }

  /**
   * Update metadata after save or migration.
   */
  static update(db: Database.Database, updates: Partial<ProjectMetadata>): void {
    const stmt = db.prepare('INSERT OR REPLACE INTO project_metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))');

    const mappings: Record<keyof ProjectMetadata, string> = {
      appVersion: 'app_version',
      schemaVersion: 'schema_version',
      createdAt: 'created_at',
      lastModifiedAt: 'last_modified_at',
      lastModifiedBy: 'last_modified_by',
      projectName: 'project_name',
      description: 'description',
    };

    const transaction = db.transaction(() => {
      Object.entries(updates).forEach(([key, value]) => {
        const dbKey = mappings[key as keyof ProjectMetadata];
        if (dbKey && value !== undefined) {
          const stringValue = typeof value === 'number' ? value.toString() : value;
          stmt.run(dbKey, stringValue);
        }
      });

      // Always update last_modified_at
      stmt.run('last_modified_at', new Date().toISOString());
    });

    transaction();
  }

  /**
   * Get current app and schema versions.
   */
  static getCurrentVersions(): { appVersion: string; schemaVersion: number } {
    return {
      appVersion: CURRENT_APP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }
}
```

**CHECKPOINT (30 sec):**

```bash
# 1. Type-check
npm run type-check

# 2. Verify migration applies
npm run db:reset  # Apply all migrations including new one

# 3. Verify table exists
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT * FROM project_metadata;"

# Expected output: Default metadata rows
```

**Criterios de éxito:**
- [ ] Migration 018 applies without errors
- [ ] project_metadata table exists with correct schema
- [ ] Default values are seeded
- [ ] Helper functions compile without errors

---

## BLOQUE 2: Version Checker Service

**Objetivo:** Implement version compatibility checking logic.

**File:** `src/main/services/project/VersionChecker.ts`

```typescript
import Database from 'better-sqlite3';
import { ProjectMetadata, VersionCompatibility } from '@shared/types/project';
import { ProjectMetadataHelper } from '@main/database/helpers/ProjectMetadataHelper';

/**
 * Checks version compatibility of .lop files.
 * Determines if a file can be opened and what migrations are needed.
 */
export class VersionChecker {
  /**
   * Check if a .lop file is compatible with current app version.
   */
  static checkCompatibility(db: Database.Database): VersionCompatibility {
    const metadata = ProjectMetadataHelper.read(db);
    const { appVersion: currentAppVersion, schemaVersion: currentSchemaVersion } =
      ProjectMetadataHelper.getCurrentVersions();

    // Case 1: Legacy file without metadata (created before Phase 8)
    if (!metadata) {
      return {
        canOpen: true,
        needsMigration: true,
        isNewer: false,
        message: 'Legacy Project Upgrade',
        detail:
          'This project was created with an older version of Line Optimizer (before v0.8.0).\n\n' +
          'It will be upgraded to the current format.\n\n' +
          'A backup will be created automatically.',
        pendingMigrations: this.getPendingMigrations(db, 0),
      };
    }

    const fileSchemaVersion = metadata.schemaVersion;

    // Case 2: File from NEWER version (forward compatibility issue)
    if (fileSchemaVersion > currentSchemaVersion) {
      return {
        canOpen: false,
        needsMigration: false,
        isNewer: true,
        message: 'Incompatible Project File',
        detail:
          `This project requires Line Optimizer v${metadata.lastModifiedBy} or newer.\n\n` +
          `You are currently using v${currentAppVersion}.\n\n` +
          `Please update Line Optimizer to open this file.`,
      };
    }

    // Case 3: File from SAME version (no migration needed)
    if (fileSchemaVersion === currentSchemaVersion) {
      return {
        canOpen: true,
        needsMigration: false,
        isNewer: false,
        message: 'Project is compatible',
        detail: `This project is up to date with the current version.`,
      };
    }

    // Case 4: File from OLDER version (needs migration)
    const pendingMigrations = this.getPendingMigrations(db, fileSchemaVersion);
    const breakingChanges = this.detectBreakingChanges(pendingMigrations);

    return {
      canOpen: true,
      needsMigration: true,
      isNewer: false,
      message: 'Project Upgrade Required',
      detail:
        `This project will be upgraded:\n` +
        `  From: v${metadata.appVersion} (schema ${fileSchemaVersion})\n` +
        `  To: v${currentAppVersion} (schema ${currentSchemaVersion})\n\n` +
        `Migrations to apply: ${pendingMigrations.length}\n\n` +
        (breakingChanges.length > 0
          ? `⚠️ Breaking changes:\n${breakingChanges.join('\n')}\n\n`
          : '') +
        `A backup will be created before upgrading.\n\n` +
        `Once upgraded, this project cannot be opened in older versions.`,
      pendingMigrations,
      breakingChanges,
    };
  }

  /**
   * Get list of migrations needed to upgrade file.
   */
  private static getPendingMigrations(
    db: Database.Database,
    fromVersion: number
  ): Array<{ version: number; name: string }> {
    // Get executed migrations from file
    let executedVersions: Set<number>;
    try {
      const rows = db
        .prepare('SELECT version FROM migrations ORDER BY version')
        .all() as { version: number }[];
      executedVersions = new Set(rows.map(r => r.version));
    } catch {
      // migrations table doesn't exist (legacy file)
      executedVersions = new Set();
    }

    // Get all available migrations
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const files = fs.readdirSync(migrationsDir);

    const allMigrations = files
      .filter((f: string) => f.endsWith('.sql'))
      .map((f: string) => {
        const match = f.match(/^(\d+)_(.+)\.sql$/);
        if (!match) return null;
        return {
          version: parseInt(match[1], 10),
          name: match[2],
        };
      })
      .filter((m: any) => m !== null)
      .sort((a: any, b: any) => a.version - b.version);

    // Return migrations not yet executed and needed for upgrade
    return allMigrations.filter((m: any) =>
      !executedVersions.has(m.version) && m.version > fromVersion
    );
  }

  /**
   * Detect migrations with breaking changes.
   * Breaking changes = migrations that drop columns, rename tables, change data types.
   */
  private static detectBreakingChanges(
    migrations: Array<{ version: number; name: string }>
  ): string[] {
    // Manually maintained list of breaking migrations
    // Update this when adding breaking migrations
    const BREAKING_MIGRATIONS: Record<number, string> = {
      // Example (none yet in Phase 8.0):
      // 25: "Changeover time storage changed from minutes to seconds",
      // 30: "Production lines unified into canvas objects",
    };

    const breaking: string[] = [];

    migrations.forEach(m => {
      if (BREAKING_MIGRATIONS[m.version]) {
        breaking.push(`• Migration ${m.version}: ${BREAKING_MIGRATIONS[m.version]}`);
      }
    });

    return breaking;
  }

  /**
   * Update metadata after successful migration or save.
   */
  static updateMetadata(db: Database.Database): void {
    const { appVersion, schemaVersion } = ProjectMetadataHelper.getCurrentVersions();

    ProjectMetadataHelper.update(db, {
      appVersion,
      schemaVersion,
      lastModifiedBy: appVersion,
      lastModifiedAt: new Date().toISOString(),
    });
  }
}
```

**CHECKPOINT (30 sec):**

```bash
# 1. Type-check
npm run type-check

# 2. Unit test (manual for now)
# Create test database with old schema_version
sqlite3 /tmp/test-old-project.db << EOF
CREATE TABLE project_metadata (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO project_metadata VALUES ('schema_version', '10');
EOF

# 3. Test in Node REPL
node
> const Database = require('better-sqlite3');
> const db = new Database('/tmp/test-old-project.db');
> // Import VersionChecker and test checkCompatibility()
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Detects legacy files (no metadata)
- [ ] Detects newer files (blocks opening)
- [ ] Detects older files (returns pending migrations)
- [ ] Detects same version (no migration needed)

---

## BLOQUE 3: Project File Service

**Objetivo:** Implement save/load operations with migration.

**File:** `src/main/services/project/ProjectFileService.ts`

```typescript
import Database from 'better-sqlite3';
import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { VersionChecker } from './VersionChecker';
import { ProjectMetadataHelper } from '@main/database/helpers/ProjectMetadataHelper';
import { MigrationRunner } from '@main/database/MigrationRunner';
import { ProjectMetadata, ProjectState } from '@shared/types/project';

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
          { name: 'Line Optimizer Project', extensions: ['lineopt'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null; // User cancelled
      }

      filePath = result.filePaths[0];
    }

    // 2. Verify file exists
    if (!fs.existsSync(filePath)) {
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
      db = new Database(filePath, { readonly: false });
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
        fs.copyFileSync(filePath, backupPath);
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
        await runner.runPendingMigrations();

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
          fs.copyFileSync(backupPath, filePath);
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
        { name: 'Line Optimizer Project', extensions: ['lineopt'] },
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

      // Initialize metadata if new project
      if (!ProjectMetadataHelper.read(savedDb)) {
        const projectName = path.basename(savePath, '.lop');
        ProjectMetadataHelper.initialize(savedDb, projectName);
      }

      VersionChecker.updateMetadata(savedDb);
      savedDb.close();

      // Update current file path
      this.currentFilePath = savePath;
      this.hasUnsavedChanges = false;

      console.log(`[ProjectFileService] Project saved as: ${savePath}`);
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
```

**CHECKPOINT (1 min):**

```bash
# 1. Type-check
npm run type-check

# 2. Manual test save/load
npm start
# In app:
#  - Import some data
#  - File → Save As → test-project.lop
#  - Close app
#  - Reopen app
#  - File → Open → test-project.lop
#  - Verify data loaded correctly
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Save creates .lop file
- [ ] Open loads .lop file correctly
- [ ] Migration dialog shows for old files
- [ ] Backup created before migration
- [ ] Error dialog shows for incompatible files

---

## BLOQUE 4: IPC Handlers

**Objetivo:** Expose project operations to renderer via IPC.

**File:** `src/main/ipc/handlers/project.handler.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { PROJECT_CHANNELS, PROJECT_EVENTS } from '@shared/constants';
import { ApiResponse, ProjectState } from '@shared/types';
import { ProjectFileService } from '@main/services/project/ProjectFileService';
import DatabaseConnection from '@main/database/connection';

export function registerProjectHandlers(mainWindow: BrowserWindow): void {
  const db = DatabaseConnection.getInstance();

  // ===== NEW PROJECT =====
  ipcMain.handle(
    PROJECT_CHANNELS.NEW,
    async (): Promise<ApiResponse<void>> => {
      try {
        const success = await ProjectFileService.newProject(db, mainWindow);

        if (success) {
          // Broadcast event
          mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_CLOSED);

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
        const loadedDb = await ProjectFileService.openProject(
          filePath || null,
          mainWindow
        );

        if (loadedDb) {
          // Replace current database connection
          DatabaseConnection.replaceInstance(loadedDb);

          // Broadcast event
          mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_OPENED);

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
        const success = await ProjectFileService.saveProject(db, mainWindow);

        if (success) {
          // Broadcast event
          mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_SAVED);

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
        const success = await ProjectFileService.saveProjectAs(db, mainWindow);

        if (success) {
          // Broadcast event
          mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_SAVED);

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
        const state = ProjectFileService.getProjectState(db);

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
```

**Register in Main:**

```typescript
// src/main/index.ts

import { registerProjectHandlers } from './ipc/handlers/project.handler';

// After creating mainWindow:
registerProjectHandlers(mainWindow);
```

**CHECKPOINT (30 sec):**

```bash
# 1. Type-check
npm run type-check

# 2. Verify handlers registered
npm start
# Check console for: "[Project Handler] Registered project handlers"
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Handlers registered without errors
- [ ] IPC calls work from renderer (test in next BLOQUE)

---

## BLOQUE 5: Frontend - File Menu & Shortcuts

**Objetivo:** Add File menu with project operations.

**File:** `src/renderer/components/layout/FileMenu.tsx`

```typescript
import { useCallback } from 'react';
import { FileIcon, FolderOpenIcon, SaveIcon, FileTextIcon } from 'lucide-react';
import { useProjectStore } from '@renderer/store/useProjectStore';

export const FileMenu = () => {
  const { newProject, openProject, saveProject, saveProjectAs, projectInfo } = useProjectStore();

  const handleNew = useCallback(async () => {
    await newProject();
  }, [newProject]);

  const handleOpen = useCallback(async () => {
    await openProject();
  }, [openProject]);

  const handleSave = useCallback(async () => {
    await saveProject();
  }, [saveProject]);

  const handleSaveAs = useCallback(async () => {
    await saveProjectAs();
  }, [saveProjectAs]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
      {/* File Menu Dropdown */}
      <div className="relative group">
        <button className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded">
          File
        </button>

        <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="py-1">
            {/* New Project */}
            <button
              onClick={handleNew}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <FileTextIcon className="w-4 h-4" />
              <span>New Project</span>
              <span className="ml-auto text-xs text-gray-400">Ctrl+N</span>
            </button>

            {/* Open Project */}
            <button
              onClick={handleOpen}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <FolderOpenIcon className="w-4 h-4" />
              <span>Open Project...</span>
              <span className="ml-auto text-xs text-gray-400">Ctrl+O</span>
            </button>

            <div className="border-t border-gray-200 my-1" />

            {/* Save Project */}
            <button
              onClick={handleSave}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <SaveIcon className="w-4 h-4" />
              <span>Save Project</span>
              <span className="ml-auto text-xs text-gray-400">Ctrl+S</span>
            </button>

            {/* Save Project As */}
            <button
              onClick={handleSaveAs}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <FileIcon className="w-4 h-4" />
              <span>Save Project As...</span>
              <span className="ml-auto text-xs text-gray-400">Ctrl+Shift+S</span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Name Display */}
      {projectInfo && (
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <FileIcon className="w-4 h-4" />
          <span className="font-medium">{projectInfo.metadata.projectName}</span>
          {projectInfo.hasUnsavedChanges && (
            <span className="text-orange-600">•</span>
          )}
        </div>
      )}
    </div>
  );
};
```

**Zustand Store:**

```typescript
// src/renderer/store/useProjectStore.ts

import { create } from 'zustand';
import { PROJECT_CHANNELS, PROJECT_EVENTS } from '@shared/constants';
import { ProjectState } from '@shared/types';

interface ProjectStore {
  projectInfo: ProjectState | null;

  // Actions
  newProject: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  refreshProjectInfo: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectInfo: null,

  newProject: async () => {
    const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.NEW);

    if (response.success) {
      await get().refreshProjectInfo();
    }
  },

  openProject: async () => {
    const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.OPEN);

    if (response.success) {
      await get().refreshProjectInfo();
    }
  },

  saveProject: async () => {
    const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.SAVE);

    if (response.success) {
      await get().refreshProjectInfo();
    }
  },

  saveProjectAs: async () => {
    const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.SAVE_AS);

    if (response.success) {
      await get().refreshProjectInfo();
    }
  },

  refreshProjectInfo: async () => {
    const response = await window.electronAPI.invoke<ProjectState>(PROJECT_CHANNELS.GET_INFO);

    if (response.success && response.data) {
      set({ projectInfo: response.data });
    }
  },
}));

// Listen for project events
if (window.electronAPI) {
  window.electronAPI.on(PROJECT_EVENTS.PROJECT_OPENED, () => {
    useProjectStore.getState().refreshProjectInfo();
  });

  window.electronAPI.on(PROJECT_EVENTS.PROJECT_SAVED, () => {
    useProjectStore.getState().refreshProjectInfo();
  });

  window.electronAPI.on(PROJECT_EVENTS.PROJECT_CLOSED, () => {
    useProjectStore.getState().refreshProjectInfo();
  });
}
```

**Keyboard Shortcuts:**

```typescript
// src/renderer/hooks/useKeyboardShortcuts.ts

import { useEffect } from 'react';
import { useProjectStore } from '@renderer/store/useProjectStore';

export function useKeyboardShortcuts() {
  const { newProject, openProject, saveProject, saveProjectAs } = useProjectStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N: New Project
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        newProject();
      }

      // Ctrl+O: Open Project
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        openProject();
      }

      // Ctrl+S: Save Project
      if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveProject();
      }

      // Ctrl+Shift+S: Save Project As
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveProjectAs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [newProject, openProject, saveProject, saveProjectAs]);
}
```

**Integrate in AppLayout:**

```typescript
// src/renderer/components/layout/AppLayout.tsx

import { FileMenu } from './FileMenu';
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts';

export const AppLayout = () => {
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col">
      <FileMenu />
      {/* Rest of layout */}
    </div>
  );
};
```

**CHECKPOINT (1 min):**

```bash
# 1. Type-check
npm run type-check

# 2. Visual test
npm start
# Verify:
#  - File menu appears
#  - Keyboard shortcuts work (Ctrl+S, Ctrl+O, etc.)
#  - Project name displays
#  - Unsaved changes indicator (•) appears
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] File menu renders correctly
- [ ] Keyboard shortcuts work
- [ ] Project name displays in header
- [ ] Unsaved changes indicator works

---

## BLOQUE FINAL: Alternate Flows & Edge Cases

### Alternate Flow 1: User Closes App with Unsaved Changes

**Scenario:**
```
1. User imports data or modifies canvas
2. ProjectFileService.markAsModified() called
3. User clicks window close button (X)
4. App should prompt: "Save changes before closing?"
```

**Implementation:**

```typescript
// src/main/index.ts

import { app, BrowserWindow } from 'electron';
import { ProjectFileService } from './services/project/ProjectFileService';

mainWindow.on('close', async (e) => {
  if (ProjectFileService.hasChanges()) {
    e.preventDefault(); // Prevent immediate close

    const { dialog } = require('electron');
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save before closing?',
      buttons: ['Cancel', 'Close Without Saving', 'Save'],
      defaultId: 2,
      cancelId: 0
    });

    if (choice.response === 0) {
      // Cancel - do nothing
      return;
    }

    if (choice.response === 2) {
      // Save first
      const saved = await ProjectFileService.saveProject(
        DatabaseConnection.getInstance(),
        mainWindow
      );

      if (!saved) {
        return; // Save failed/cancelled, don't close
      }
    }

    // choice.response === 1 or save succeeded: close window
    mainWindow.destroy();
  }
});
```

**Test:**
1. Open project, make changes
2. Click window close button
3. Verify dialog appears
4. Test all 3 options (Cancel, Close Without Saving, Save)

---

### Alternate Flow 2: Migration Fails

**Scenario:**
```
1. User opens old .lop file
2. Migration runs
3. SQL error occurs (e.g., constraint violation)
4. App should restore backup and show error
```

**Implementation:** Already handled in `ProjectFileService.openProject()`:

```typescript
} catch (error) {
  db.close();

  // Restore backup on failure
  try {
    fs.copyFileSync(backupPath, filePath);
    console.log('[ProjectFileService] Backup restored');
  } catch (restoreError) {
    console.error('[ProjectFileService] Failed to restore backup:', restoreError);
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
```

**Test:**
1. Create test .lop with invalid data
2. Create migration that will fail on that data
3. Open file, verify backup restored

---

### Edge Case 1: File Path with Special Characters

**Scenario:**
```
File name: "Proyecto Juárez (2026) #1.lop"
Path: /Users/aaronzapata/Projects/Line Optimizer Files/
```

**Handling:** Electron's `dialog.showOpenDialog()` handles this automatically. No special code needed.

**Test:**
1. Create .lop with special characters in name
2. Open file
3. Verify opens correctly

---

### Edge Case 2: Concurrent File Access

**Scenario:**
```
1. User opens "Project.lop" in App Instance A
2. User opens same "Project.lop" in App Instance B
3. Both modify data
4. Both try to save
```

**Current behavior:** Last save wins (SQLite allows concurrent reads, sequential writes).

**Acceptable for Phase 8.0:** This is a rare edge case. Users typically don't open same project in multiple instances.

**Future improvement (Phase 8.2):** File locking or warning "File already open in another instance".

**Test:** Not critical for Phase 8.0.

---

### Edge Case 3: Corrupted .lop File

**Scenario:**
```
1. .lop file is corrupted (incomplete download, disk error)
2. User tries to open
3. SQLite fails to open
```

**Handling:** Already handled in `ProjectFileService.openProject()`:

```typescript
try {
  db = new Database(filePath, { readonly: false });
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
```

**Test:**
1. Create corrupted file: `echo "invalid data" > test.lop`
2. Try to open
3. Verify error dialog shows

---

## Success Criteria

**Phase 8.0 is complete when:**

- [ ] **Save/Load:**
  - [ ] File → Save creates .lop file with correct data
  - [ ] File → Save As prompts for new file name
  - [ ] File → Open loads .lop and displays data correctly
  - [ ] Ctrl+S / Ctrl+Shift+S keyboard shortcuts work

- [ ] **Version Management:**
  - [ ] project_metadata table exists and is populated
  - [ ] Opening old file shows upgrade dialog
  - [ ] Backup is created before migration
  - [ ] Migration applies successfully
  - [ ] Opening new file in old app shows clear error message

- [ ] **User Experience:**
  - [ ] File menu displays correctly
  - [ ] Project name shows in header
  - [ ] Unsaved changes indicator (•) appears when modified
  - [ ] "Save before closing?" dialog appears when closing with unsaved changes
  - [ ] All dialogs have clear messages

- [ ] **Data Integrity:**
  - [ ] All tables are saved in .lop
  - [ ] Canvas layout is preserved
  - [ ] Volumes, compatibilities, changeover matrix are preserved
  - [ ] No data loss during save/load cycle

- [ ] **Error Handling:**
  - [ ] Corrupted file shows error message
  - [ ] Failed migration restores backup
  - [ ] User can cancel any operation without side effects

---

## Testing Strategy

### Unit Tests (Optional in Phase 8.0, Required in 8.1)

```typescript
// src/main/services/project/__tests__/VersionChecker.test.ts

describe('VersionChecker', () => {
  it('detects legacy files without metadata', () => {
    const db = createLegacyDatabase();
    const compat = VersionChecker.checkCompatibility(db);
    expect(compat.needsMigration).toBe(true);
    expect(compat.isNewer).toBe(false);
  });

  it('blocks opening newer files', () => {
    const db = createDatabaseWithVersion(99);
    const compat = VersionChecker.checkCompatibility(db);
    expect(compat.canOpen).toBe(false);
    expect(compat.isNewer).toBe(true);
  });

  it('allows opening same version without migration', () => {
    const db = createDatabaseWithVersion(18);
    const compat = VersionChecker.checkCompatibility(db);
    expect(compat.canOpen).toBe(true);
    expect(compat.needsMigration).toBe(false);
  });
});
```

### Manual Testing Guide

**Test 1: Save New Project**
```
1. npm start
2. Import test data
3. Configure canvas layout
4. File → Save As → "Test_Project.lop"
5. Close app
6. Verify file exists in file system
7. Open .lop in DB Browser
8. Verify all tables have data
9. Verify project_metadata table exists
```

**Test 2: Open Saved Project**
```
1. npm start
2. File → Open → "Test_Project.lop"
3. Verify all data loaded:
   - Lines appear on canvas
   - Models in database
   - Volumes visible
4. Make changes
5. File → Save (Ctrl+S)
6. Close and reopen
7. Verify changes persisted
```

**Test 3: Migration (Upgrade Old File)**
```
1. Create old .lop (simulate v0.7.0):
   - Copy current DB
   - Delete project_metadata table
   - Set schema version to 10 in migrations table
2. npm start (with v0.8.0)
3. File → Open → old file
4. Verify dialog: "Project Upgrade Required"
5. Click "Upgrade Project"
6. Verify backup created (.backup-XXXXX file)
7. Verify project opens successfully
8. Open in DB Browser
9. Verify project_metadata exists with version 18
```

**Test 4: Unsaved Changes Warning**
```
1. npm start
2. File → Open → "Test_Project.lop"
3. Make changes (add line, move node)
4. Verify unsaved indicator (•) appears
5. Click window close button (X)
6. Verify "Save before closing?" dialog
7. Test each option:
   a. Cancel → window stays open
   b. Close Without Saving → window closes, changes lost
   c. Save → window closes, changes saved
```

**Test 5: File Not Found**
```
1. npm start
2. File → Open → navigate to deleted file
3. Verify error: "File Not Found"
```

**Test 6: Keyboard Shortcuts**
```
1. npm start
2. Press Ctrl+O → Open dialog appears
3. Press Ctrl+S → Save dialog appears (if no current file)
4. Open project
5. Make changes
6. Press Ctrl+S → Saves to current file
7. Press Ctrl+Shift+S → Save As dialog appears
```

---

## Implementation Command

```bash
# For orchestrator or manual implementation
claude "@backend-architect @frontend-developer implement phase-8.0-project-files according to docs/specs/phase-8.0-project-files.md"
```

---

## Post-Implementation Verification

After implementing Phase 8.0, run these checks:

```bash
# 1. Type-check passes
npm run type-check

# 2. Migrations applied
npm run db:reset
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT * FROM project_metadata;"

# 3. App starts without errors
npm start
# Check console for:
# - [Project Handler] Registered project handlers
# - No errors

# 4. Manual testing
# Follow "Manual Testing Guide" above

# 5. Create test project for Phase 8.1
# File → Save As → "Base_Project_For_Scenarios.lop"
# This will be used to test scenarios in Phase 8.1
```

---

## Dependencies for Phase 8.1 (Scenarios)

Phase 8.0 provides foundation for Phase 8.1:

- ✅ .lop file format established
- ✅ Version management system in place
- ✅ Save/Load working
- ✅ Metadata table for project info

Phase 8.1 will add:
- Scenarios table
- Scenario changes (deltas)
- Tabs UI for switching scenarios
- Compare scenarios panel

---

**Status:** Ready for Implementation
**Blocked By:** None
**Blocks:** Phase 8.1 (Scenarios)
