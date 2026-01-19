// ============================================
// REPOSITORY INTERFACE: IProductVolumeRepository
// Define contract for ProductVolume persistence
// Supports multi-year volume queries
// ============================================

import { ProductVolume } from '../entities/ProductVolume';

/**
 * Repository interface for ProductVolume
 *
 * Principle: Dependency Inversion (SOLID)
 * - Domain layer does not depend on infrastructure (SQLite)
 * - Allows changing implementation without affecting logic
 * - Facilitates testing with mocks
 */
export interface IProductVolumeRepository {
  /**
   * Create a new volume record
   */
  create(volume: ProductVolume): Promise<void>;

  /**
   * Update an existing volume by ID
   */
  update(id: string, data: Partial<{
    volume: number;
    operationsDays: number;
  }>): Promise<void>;

  /**
   * Find volume by ID
   */
  findById(id: string): Promise<ProductVolume | null>;

  /**
   * Find all volumes for a specific model (across all years)
   */
  findByModel(modelId: string): Promise<ProductVolume[]>;

  /**
   * Find all volumes for a specific year (across all models)
   */
  findByYear(year: number): Promise<ProductVolume[]>;

  /**
   * Find volume for a specific model in a specific year
   */
  findByModelAndYear(modelId: string, year: number): Promise<ProductVolume | null>;

  /**
   * Get all volumes
   */
  findAll(): Promise<ProductVolume[]>;

  /**
   * Get list of all years that have volume data
   */
  getAvailableYears(): Promise<number[]>;

  /**
   * Get the min and max years in the volume data
   */
  getYearRange(): Promise<{ min: number; max: number } | null>;

  /**
   * Delete a volume by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all volumes for a specific model
   */
  deleteByModel(modelId: string): Promise<void>;

  /**
   * Delete all volumes for a specific year
   */
  deleteByYear(year: number): Promise<void>;

  /**
   * Batch create multiple volumes (for Excel import)
   */
  batchCreate(volumes: ProductVolume[]): Promise<void>;

  /**
   * Check if a volume exists for a model-year pair
   */
  existsByModelAndYear(modelId: string, year: number): Promise<boolean>;

  /**
   * Get volume summary by year (count of models, total volume)
   */
  getYearSummary(): Promise<Array<{
    year: number;
    modelCount: number;
    totalVolume: number;
    avgOperationsDays: number;
  }>>;
}
