// ============================================
// ENTIDAD DE DOMINIO: ProductionVolume
// Representa el volumen de produccion anual de una familia
// ============================================

import { ProductionVolume as IProductionVolume } from '@shared/types';
import { nanoid } from 'nanoid';

export class ProductionVolume {
  private constructor(
    private _id: string,
    private _family: string,
    private _daysOfOperation: number,
    private _year: number,
    private _quantity: number,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    family: string;
    daysOfOperation: number;
    year: number;
    quantity: number;
  }): ProductionVolume {
    return new ProductionVolume(
      nanoid(),
      params.family,
      params.daysOfOperation,
      params.year,
      params.quantity,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: IProductionVolume): ProductionVolume {
    return new ProductionVolume(
      data.id,
      data.family,
      data.daysOfOperation,
      data.year,
      data.quantity,
      data.createdAt,
      data.updatedAt
    );
  }

  // ===== Getters =====

  get id(): string {
    return this._id;
  }

  get family(): string {
    return this._family;
  }

  get daysOfOperation(): number {
    return this._daysOfOperation;
  }

  get year(): number {
    return this._year;
  }

  get quantity(): number {
    return this._quantity;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ===== Business Logic =====

  calculateDailyVolume(): number {
    if (this._daysOfOperation === 0) return 0;
    return this._quantity / this._daysOfOperation;
  }

  calculateMonthlyVolume(): number {
    return (this._quantity / 12);
  }

  calculateWeeklyVolume(): number {
    const weeksPerYear = 52;
    return this._quantity / weeksPerYear;
  }

  update(params: {
    family?: string;
    daysOfOperation?: number;
    year?: number;
    quantity?: number;
  }): void {
    if (params.family !== undefined) this._family = params.family;
    if (params.daysOfOperation !== undefined) {
      this._daysOfOperation = params.daysOfOperation;
    }
    if (params.year !== undefined) this._year = params.year;
    if (params.quantity !== undefined) this._quantity = params.quantity;

    this._updatedAt = new Date();
    this.validate();
  }

  toJSON(): IProductionVolume {
    return {
      id: this._id,
      family: this._family,
      daysOfOperation: this._daysOfOperation,
      year: this._year,
      quantity: this._quantity,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._family || this._family.trim().length === 0) {
      throw new Error('Family cannot be empty');
    }

    if (this._daysOfOperation <= 0) {
      throw new Error('Days of operation must be positive');
    }

    if (this._daysOfOperation > 365) {
      throw new Error('Days of operation cannot exceed 365');
    }

    if (this._year < 2024) {
      throw new Error('Year must be 2024 or later');
    }

    if (this._quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
  }
}
