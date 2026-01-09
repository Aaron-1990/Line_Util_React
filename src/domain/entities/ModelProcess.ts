// ============================================
// ENTIDAD DE DOMINIO: ModelProcess
// Representa un proceso individual de un modelo (Top, Bottom, etc)
// ============================================

import { ModelProcess as IModelProcess } from '@shared/types';
import { nanoid } from 'nanoid';

export class ModelProcess {
  private constructor(
    private _id: string,
    private _modelId: string,
    private _name: string,
    private _cycleTime: number,
    private _quantityPerProduct: number,
    private _sequence: number,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    modelId: string;
    name: string;
    cycleTime: number;
    quantityPerProduct: number;
    sequence: number;
  }): ModelProcess {
    return new ModelProcess(
      nanoid(),
      params.modelId,
      params.name,
      params.cycleTime,
      params.quantityPerProduct,
      params.sequence,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: IModelProcess): ModelProcess {
    return new ModelProcess(
      data.id,
      data.modelId,
      data.name,
      data.cycleTime,
      data.quantityPerProduct,
      data.sequence,
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

  get name(): string {
    return this._name;
  }

  get cycleTime(): number {
    return this._cycleTime;
  }

  get quantityPerProduct(): number {
    return this._quantityPerProduct;
  }

  get sequence(): number {
    return this._sequence;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ===== Business Logic =====

  calculateTotalTime(): number {
    return this._cycleTime * this._quantityPerProduct;
  }

  calculateTimeForQuantity(productQuantity: number): number {
    return this.calculateTotalTime() * productQuantity;
  }

  update(params: {
    name?: string;
    cycleTime?: number;
    quantityPerProduct?: number;
    sequence?: number;
  }): void {
    if (params.name !== undefined) this._name = params.name;
    if (params.cycleTime !== undefined) this._cycleTime = params.cycleTime;
    if (params.quantityPerProduct !== undefined) {
      this._quantityPerProduct = params.quantityPerProduct;
    }
    if (params.sequence !== undefined) this._sequence = params.sequence;

    this._updatedAt = new Date();
    this.validate();
  }

  toJSON(): IModelProcess {
    return {
      id: this._id,
      modelId: this._modelId,
      name: this._name,
      cycleTime: this._cycleTime,
      quantityPerProduct: this._quantityPerProduct,
      sequence: this._sequence,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._modelId || this._modelId.trim().length === 0) {
      throw new Error('Model ID cannot be empty');
    }

    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Process name cannot be empty');
    }

    if (this._cycleTime <= 0) {
      throw new Error('Cycle time must be positive');
    }

    if (this._quantityPerProduct <= 0) {
      throw new Error('Quantity per product must be positive');
    }

    if (this._sequence < 0) {
      throw new Error('Sequence must be non-negative');
    }
  }
}
