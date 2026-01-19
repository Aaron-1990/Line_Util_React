// ============================================
// ENTIDAD DE DOMINIO: ProductModelV2
// Modelo de producto optimizado para multi-sheet import
// Compatible con el algoritmo Python de optimizacion
// ============================================

import { nanoid } from 'nanoid';

/**
 * Interface for ProductModelV2 data transfer
 */
export interface IProductModelV2 {
  id: string;
  name: string;
  customer: string;
  program: string;
  family: string;
  annualVolume: number;
  operationsDays: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProductModelV2 Entity
 *
 * Represents a product model for multi-sheet Excel import.
 * Includes annual volume and operations days for Python algorithm calculations.
 *
 * Business Logic:
 * - Daily Demand = Annual Volume / Operations Days
 * - Used by Python algorithm to calculate line utilization
 */
export class ProductModelV2 {
  private constructor(
    private _id: string,
    private _name: string,
    private _customer: string,
    private _program: string,
    private _family: string,
    private _annualVolume: number,
    private _operationsDays: number,
    private _active: boolean,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    name: string;
    customer: string;
    program: string;
    family: string;
    annualVolume: number;
    operationsDays: number;
    active?: boolean;
  }): ProductModelV2 {
    return new ProductModelV2(
      nanoid(),
      params.name,
      params.customer,
      params.program,
      params.family,
      params.annualVolume,
      params.operationsDays,
      params.active ?? true,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: IProductModelV2): ProductModelV2 {
    return new ProductModelV2(
      data.id,
      data.name,
      data.customer,
      data.program,
      data.family,
      data.annualVolume,
      data.operationsDays,
      data.active,
      data.createdAt,
      data.updatedAt
    );
  }

  // ===== Getters =====

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get customer(): string {
    return this._customer;
  }

  get program(): string {
    return this._program;
  }

  get family(): string {
    return this._family;
  }

  get annualVolume(): number {
    return this._annualVolume;
  }

  get operationsDays(): number {
    return this._operationsDays;
  }

  get active(): boolean {
    return this._active;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ===== Business Logic =====

  /**
   * Calculate daily demand (units per day)
   * Formula: Annual Volume / Operations Days
   *
   * Example:
   * - Annual Volume: 50,000 units
   * - Operations Days: 250 days
   * - Daily Demand: 50,000 / 250 = 200 units/day
   */
  calculateDailyDemand(): number {
    if (this._operationsDays <= 0) return 0;
    return this._annualVolume / this._operationsDays;
  }

  /**
   * Update model properties
   */
  update(params: {
    name?: string;
    customer?: string;
    program?: string;
    family?: string;
    annualVolume?: number;
    operationsDays?: number;
  }): void {
    if (params.name !== undefined) this._name = params.name;
    if (params.customer !== undefined) this._customer = params.customer;
    if (params.program !== undefined) this._program = params.program;
    if (params.family !== undefined) this._family = params.family;
    if (params.annualVolume !== undefined) this._annualVolume = params.annualVolume;
    if (params.operationsDays !== undefined) this._operationsDays = params.operationsDays;

    this._updatedAt = new Date();
    this.validate();
  }

  deactivate(): void {
    this._active = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._active = true;
    this._updatedAt = new Date();
  }

  toJSON(): IProductModelV2 {
    return {
      id: this._id,
      name: this._name,
      customer: this._customer,
      program: this._program,
      family: this._family,
      annualVolume: this._annualVolume,
      operationsDays: this._operationsDays,
      active: this._active,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Model name is required');
    }

    if (this._annualVolume < 0) {
      throw new Error('Annual volume must be >= 0');
    }

    if (this._operationsDays < 1 || this._operationsDays > 365) {
      throw new Error('Operations days must be between 1-365');
    }
  }
}
