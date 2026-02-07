// ============================================
// PROJECT FILES FOUNDATION - PHASE 8.0
// Contracts for .lop file management and version control
// ============================================

/**
 * Project metadata stored in every .lop file.
 * This metadata is stored in the project_metadata table (key-value pairs).
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
 *
 * This is returned by VersionChecker.checkCompatibility() to inform the user
 * about what will happen when opening a .lop file.
 */
export interface VersionCompatibility {
  /** Can the file be opened in this app version? */
  canOpen: boolean;

  /** Does the file need migration to current schema? */
  needsMigration: boolean;

  /** Is the file from a newer app version? (forward compatibility issue) */
  isNewer: boolean;

  /** User-facing message explaining the situation (dialog title) */
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
 * This represents the currently open project and its metadata.
 */
export interface ProjectState {
  /** Path to currently open .lop file (null if new unsaved project) */
  currentFilePath: string | null;

  /** Project metadata from file */
  metadata: ProjectMetadata;

  /** Has the project been modified since last save? */
  hasUnsavedChanges: boolean;
}

/**
 * Request to update project metadata.
 * Used when user changes project name or description.
 */
export interface UpdateProjectMetadataRequest {
  projectName?: string;
  description?: string;
}

/**
 * Recent project file entry for "Open Recent" menu.
 * Stored in app settings/preferences.
 */
export interface RecentProject {
  /** Full path to .lop file */
  filePath: string;

  /** Project name (from metadata) */
  projectName: string;

  /** Last opened timestamp (ISO 8601) */
  lastOpened: string;

  /** File exists on disk */
  exists: boolean;
}

/**
 * Options for creating a new project.
 */
export interface NewProjectOptions {
  /** Initial project name (default: "Untitled Project") */
  projectName?: string;

  /** Initial description */
  description?: string;

  /** Clear all data (default: true) */
  clearData?: boolean;
}

/**
 * Options for opening a project.
 */
export interface OpenProjectOptions {
  /** Path to .lop file (if null, show file dialog) */
  filePath?: string | null;

  /** Skip compatibility check (dangerous, for testing only) */
  skipCompatibilityCheck?: boolean;
}

/**
 * Options for saving a project.
 */
export interface SaveProjectOptions {
  /** Path to save to (if null, use current file path or show dialog) */
  filePath?: string | null;

  /** Update metadata before saving */
  updateMetadata?: UpdateProjectMetadataRequest;
}

/**
 * Result of a project operation (open, save, new).
 */
export interface ProjectOperationResult {
  /** Operation succeeded */
  success: boolean;

  /** Error message (if failed) */
  error?: string;

  /** Path to the project file (if applicable) */
  filePath?: string;

  /** Updated project state (if applicable) */
  projectState?: ProjectState;
}
