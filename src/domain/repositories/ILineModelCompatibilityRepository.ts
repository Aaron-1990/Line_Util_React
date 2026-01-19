// ============================================
// REPOSITORY INTERFACE: ILineModelCompatibilityRepository
// Define contract for LineModelCompatibility persistence
// Uses surrogate keys (IDs) for referential integrity
// ============================================

import { LineModelCompatibility } from '../entities/LineModelCompatibility';

/**
 * Repository interface for LineModelCompatibility
 *
 * Principle: Dependency Inversion (SOLID)
 * - Domain layer does not depend on infrastructure (SQLite)
 * - Allows changing implementation without affecting logic
 * - Facilitates testing with mocks
 *
 * Note: Uses IDs instead of names for lookups. The repository
 * handles joining to get names when needed for display.
 */
export interface ILineModelCompatibilityRepository {
  /**
   * Create a new compatibility record
   */
  create(compatibility: LineModelCompatibility): Promise<void>;

  /**
   * Update an existing compatibility by ID
   */
  update(id: string, compatibility: Partial<{
    cycleTime: number;
    efficiency: number;
    priority: number;
  }>): Promise<void>;

  /**
   * Find compatibility by ID
   */
  findById(id: string): Promise<LineModelCompatibility | null>;

  /**
   * Find compatibility by line ID and model ID (unique pair)
   */
  findByLineAndModel(lineId: string, modelId: string): Promise<LineModelCompatibility | null>;

  /**
   * Find all compatibilities for a specific line (by ID)
   */
  findByLine(lineId: string): Promise<LineModelCompatibility[]>;

  /**
   * Find all compatibilities for a specific line, ordered by priority
   */
  findByLineOrderedByPriority(lineId: string): Promise<LineModelCompatibility[]>;

  /**
   * Find all compatibilities for a specific model (by ID)
   */
  findByModel(modelId: string): Promise<LineModelCompatibility[]>;

  /**
   * Get all compatibilities
   */
  findAll(): Promise<LineModelCompatibility[]>;

  /**
   * Delete a compatibility by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all compatibilities for a specific line (by ID)
   */
  deleteByLine(lineId: string): Promise<void>;

  /**
   * Delete all compatibilities for a specific model (by ID)
   */
  deleteByModel(modelId: string): Promise<void>;

  /**
   * Batch create multiple compatibilities (for Excel import)
   */
  batchCreate(compatibilities: LineModelCompatibility[]): Promise<void>;

  /**
   * Check if a compatibility exists for a line-model pair (by IDs)
   */
  existsByLineAndModel(lineId: string, modelId: string): Promise<boolean>;

  /**
   * Get all unique line IDs that have compatibilities
   */
  getAllLineIds(): Promise<string[]>;

  /**
   * Get all unique model IDs that have compatibilities
   */
  getAllModelIds(): Promise<string[]>;
}
