// ============================================
// REPOSITORY INTERFACE: IProductModelV2Repository
// Define contract for ProductModelV2 persistence (multi-sheet import)
// ============================================

import { ProductModelV2 } from '../entities/ProductModelV2';

/**
 * Repository interface for ProductModelV2
 *
 * Principle: Dependency Inversion (SOLID)
 * - Domain layer does not depend on infrastructure (SQLite)
 * - Allows changing implementation without affecting logic
 * - Facilitates testing with mocks
 */
export interface IProductModelV2Repository {
  /**
   * Create a new model
   */
  create(model: ProductModelV2): Promise<void>;

  /**
   * Update an existing model by name
   */
  update(name: string, model: Partial<{
    customer: string;
    program: string;
    family: string;
    annualVolume: number;
    operationsDays: number;
    active: boolean;
  }>): Promise<void>;

  /**
   * Find a model by its unique name
   */
  findByName(name: string): Promise<ProductModelV2 | null>;

  /**
   * Find a model by ID
   */
  findById(id: string): Promise<ProductModelV2 | null>;

  /**
   * Get all models
   */
  findAll(): Promise<ProductModelV2[]>;

  /**
   * Get all active models
   */
  findActive(): Promise<ProductModelV2[]>;

  /**
   * Get models by family
   */
  findByFamily(family: string): Promise<ProductModelV2[]>;

  /**
   * Get models by customer
   */
  findByCustomer(customer: string): Promise<ProductModelV2[]>;

  /**
   * Delete a model by name (soft delete - sets active=false)
   */
  delete(name: string): Promise<void>;

  /**
   * Hard delete a model by name
   */
  hardDelete(name: string): Promise<void>;

  /**
   * Batch create multiple models (for Excel import)
   */
  batchCreate(models: ProductModelV2[]): Promise<void>;

  /**
   * Check if a model exists by name
   */
  existsByName(name: string): Promise<boolean>;

  /**
   * Get all model names (for validation)
   */
  getAllNames(): Promise<string[]>;
}
