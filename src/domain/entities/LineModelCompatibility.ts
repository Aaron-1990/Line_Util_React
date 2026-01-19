// ============================================
// ENTIDAD DE DOMINIO: LineModelCompatibility
// Representa la compatibilidad entre una linea y un modelo
// Incluye cycle time, efficiency y priority
// ============================================

import { nanoid } from 'nanoid';

/**
 * Interface for LineModelCompatibility data transfer
 * Uses surrogate keys (IDs) for referential integrity
 */
export interface ILineModelCompatibility {
  id: string;
  lineId: string;
  modelId: string;
  cycleTime: number;
  efficiency: number;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LineModelCompatibility Entity
 *
 * Represents which models can run on which lines,
 * including specific efficiency (OEE) for each line-model pair.
 *
 * Uses surrogate keys (IDs) for referential integrity instead of natural keys (names).
 * This follows Clean Architecture principles where entities relate by identity.
 *
 * Business Logic:
 * - Real Time Per Unit = Cycle Time / (Efficiency / 100)
 * - Used by Python algorithm to calculate actual production time
 *
 * Example:
 * - Cycle Time: 45 seconds
 * - Efficiency: 85%
 * - Real Time Per Unit: 45 / 0.85 = 52.94 seconds
 */
export class LineModelCompatibility {
  private constructor(
    private _id: string,
    private _lineId: string,
    private _modelId: string,
    private _cycleTime: number,
    private _efficiency: number,
    private _priority: number,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    lineId: string;
    modelId: string;
    cycleTime: number;
    efficiency: number;
    priority?: number;
  }): LineModelCompatibility {
    return new LineModelCompatibility(
      nanoid(),
      params.lineId,
      params.modelId,
      params.cycleTime,
      params.efficiency,
      params.priority ?? 1,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: ILineModelCompatibility): LineModelCompatibility {
    return new LineModelCompatibility(
      data.id,
      data.lineId,
      data.modelId,
      data.cycleTime,
      data.efficiency,
      data.priority,
      data.createdAt,
      data.updatedAt
    );
  }

  // ===== Getters =====

  get id(): string {
    return this._id;
  }

  get lineId(): string {
    return this._lineId;
  }

  get modelId(): string {
    return this._modelId;
  }

  get cycleTime(): number {
    return this._cycleTime;
  }

  get efficiency(): number {
    return this._efficiency;
  }

  get priority(): number {
    return this._priority;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ===== Business Logic =====

  /**
   * Calculate real time per unit considering efficiency (OEE)
   * Formula: Cycle Time / (Efficiency / 100)
   *
   * Example:
   * - Cycle Time: 45 seconds
   * - Efficiency: 85%
   * - Real Time: 45 / 0.85 = 52.94 seconds/unit
   */
  calculateRealTimePerUnit(): number {
    if (this._efficiency <= 0) return Infinity;
    return this._cycleTime / (this._efficiency / 100);
  }

  /**
   * Calculate how many units can be produced in a given time
   */
  calculateUnitsInTime(availableSeconds: number): number {
    const realTimePerUnit = this.calculateRealTimePerUnit();
    if (realTimePerUnit <= 0 || realTimePerUnit === Infinity) return 0;
    return Math.floor(availableSeconds / realTimePerUnit);
  }

  /**
   * Calculate time needed to produce a certain number of units
   */
  calculateTimeForUnits(units: number): number {
    return units * this.calculateRealTimePerUnit();
  }

  /**
   * Update compatibility properties
   */
  update(params: {
    cycleTime?: number;
    efficiency?: number;
    priority?: number;
  }): void {
    if (params.cycleTime !== undefined) this._cycleTime = params.cycleTime;
    if (params.efficiency !== undefined) this._efficiency = params.efficiency;
    if (params.priority !== undefined) this._priority = params.priority;

    this._updatedAt = new Date();
    this.validate();
  }

  toJSON(): ILineModelCompatibility {
    return {
      id: this._id,
      lineId: this._lineId,
      modelId: this._modelId,
      cycleTime: this._cycleTime,
      efficiency: this._efficiency,
      priority: this._priority,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._lineId || this._lineId.trim().length === 0) {
      throw new Error('Line ID is required');
    }

    if (!this._modelId || this._modelId.trim().length === 0) {
      throw new Error('Model ID is required');
    }

    if (this._cycleTime <= 0) {
      throw new Error('Cycle time must be > 0');
    }

    if (this._efficiency <= 0 || this._efficiency > 100) {
      throw new Error('Efficiency must be between 0-100');
    }

    if (this._priority < 1) {
      throw new Error('Priority must be >= 1');
    }
  }
}
