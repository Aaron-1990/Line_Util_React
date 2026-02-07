import Database from 'better-sqlite3';
import { ProjectMetadata } from '@shared/types/project';
import pkg from '../../../../package.json';

const CURRENT_APP_VERSION = pkg.version; // e.g., "0.1.0"
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
    const stmt = db.prepare('INSERT OR REPLACE INTO project_metadata (key, value) VALUES (?, ?)');

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
