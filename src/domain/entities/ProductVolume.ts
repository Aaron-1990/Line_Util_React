// ============================================
// ENTIDAD DE DOMINIO: ProductVolume
// Represents annual volume forecast for a model in a specific year
// Supports multi-year forecasts with variable operations days
// ============================================

import { nanoid } from 'nanoid';

/**
 * Interface for ProductVolume data transfer
 */
export interface IProductVolume {
  id: string;
  modelId: string;
  year: number;
  volume: number;
  operationsDays: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProductVolume Entity
 *
 * Represents the annual production volume forecast for a model in a specific year.
 * Supports dynamic year ranges imported from Excel.
 *
 * Business Logic:
 * - Daily Demand = Volume / Operations Days
 * - Operations days can vary by year (partial year, 6-day week, etc.)
 *
 * Example:
 * - Model: ECU-2024-A
 * - Year: 2025
 * - Volume: 50,000 units
 * - Operations Days: 240
 * - Daily Demand: 50,000 / 240 = 208.33 units/day
 */
export class ProductVolume {
  private constructor(
    private _id: string,
    private _modelId: string,
    private _year: number,
    private _volume: number,
    private _operationsDays: number,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    modelId: string;
    year: number;
    volume: number;
    operationsDays: number;
  }): ProductVolume {
    return new ProductVolume(
      nanoid(),
      params.modelId,
      params.year,
      params.volume,
      params.operationsDays,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: IProductVolume): ProductVolume {
    return new ProductVolume(
      data.id,
      data.modelId,
      data.year,
      data.volume,
      data.operationsDays,
      data.createdAt,
      data.updatedAt
    );
  }

  // ===== Getters =====

  get id(): string {
    return this._id;
  }

  get modelId(): string {
    return this._modelId;
  }

  get year(): number {
    return this._year;
  }

  get volume(): number {
    return this._volume;
  }

  get operationsDays(): number {
    return this._operationsDays;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ===== Business Logic =====

  /**
   * Calculate daily demand based on volume and operations days
   * Formula: Volume / Operations Days
   *
   * Example:
   * - Volume: 50,000 units/year
   * - Operations Days: 240 days
   * - Daily Demand: 50,000 / 240 = 208.33 units/day
   */
  calculateDailyDemand(): number {
    if (this._operationsDays === 0) return 0;
    return this._volume / this._operationsDays;
  }

  /**
   * Check if this year has any production planned
   */
  hasProduction(): boolean {
    return this._volume > 0 && this._operationsDays > 0;
  }

  /**
   * Update volume properties
   */
  update(params: {
    volume?: number;
    operationsDays?: number;
  }): void {
    if (params.volume !== undefined) this._volume = params.volume;
    if (params.operationsDays !== undefined) this._operationsDays = params.operationsDays;

    this._updatedAt = new Date();
    this.validate();
  }

  toJSON(): IProductVolume {
    return {
      id: this._id,
      modelId: this._modelId,
      year: this._year,
      volume: this._volume,
      operationsDays: this._operationsDays,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._modelId || this._modelId.trim().length === 0) {
      throw new Error('Model ID is required');
    }

    if (this._year < 2000 || this._year > 2100) {
      throw new Error('Year must be between 2000 and 2100');
    }

    if (this._volume < 0) {
      throw new Error('Volume must be >= 0');
    }

    if (this._operationsDays < 0 || this._operationsDays > 366) {
      throw new Error('Operations days must be between 0 and 366');
    }
  }
}
