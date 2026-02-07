import Database from 'better-sqlite3';
import { VersionCompatibility } from '@shared/types/project';
import { ProjectMetadataHelper } from '@main/database/helpers/ProjectMetadataHelper';
import fs from 'fs';
import path from 'path';

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
    const migrationsDir = path.join(__dirname, '../../database/migrations');

    if (!fs.existsSync(migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(migrationsDir);

    const allMigrations = files
      .filter((f: string) => f.endsWith('.sql'))
      .filter((f: string) => !f.includes('_ROLLBACK') && !f.includes('_VALIDATION'))
      .map((f: string) => {
        const match = f.match(/^(\d+)_(.+)\.sql$/);
        if (!match || !match[1] || !match[2]) return null;
        return {
          version: parseInt(match[1], 10),
          name: match[2],
        };
      })
      .filter((m): m is { version: number; name: string } => m !== null)
      .sort((a, b) => a.version - b.version);

    // Return migrations not yet executed and needed for upgrade
    return allMigrations.filter((m) =>
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
