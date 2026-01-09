// ============================================
// ENTIDAD DE DOMINIO: ProductModel
// Representa un modelo de producto con sus procesos
// ============================================

import { ProductModel as IProductModel } from '@shared/types';
import { nanoid } from 'nanoid';

export class ProductModel {
  private constructor(
    private _id: string,
    private _family: string,
    private _name: string,
    private _bu: string,
    private _area: string,
    private _priority: number,
    private _efficiency: number,
    private _compatibleLines: string[],
    private _active: boolean,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    family: string;
    name: string;
    bu: string;
    area: string;
    priority: number;
    efficiency: number;
    compatibleLines?: string[];
  }): ProductModel {
    return new ProductModel(
      nanoid(),
      params.family,
      params.name,
      params.bu,
      params.area,
      params.priority,
      params.efficiency,
      params.compatibleLines ?? [],
      true,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: IProductModel): ProductModel {
    return new ProductModel(
      data.id,
      data.family,
      data.name,
      data.bu,
      data.area,
      data.priority,
      data.efficiency,
      data.compatibleLines,
      data.active,
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

  get name(): string {
    return this._name;
  }

  get bu(): string {
    return this._bu;
  }

  get area(): string {
    return this._area;
  }

  get priority(): number {
    return this._priority;
  }

  get efficiency(): number {
    return this._efficiency;
  }

  get compatibleLines(): string[] {
    return [...this._compatibleLines];
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

  isCompatibleWithLine(lineId: string): boolean {
    return this._compatibleLines.includes(lineId);
  }

  addCompatibleLine(lineId: string): void {
    if (!this.isCompatibleWithLine(lineId)) {
      this._compatibleLines.push(lineId);
      this._updatedAt = new Date();
    }
  }

  removeCompatibleLine(lineId: string): void {
    const index = this._compatibleLines.indexOf(lineId);
    if (index > -1) {
      this._compatibleLines.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  setCompatibleLines(lineIds: string[]): void {
    this._compatibleLines = [...lineIds];
    this._updatedAt = new Date();
  }

  hasHigherPriorityThan(other: ProductModel): boolean {
    return this._priority < other._priority;
  }

  update(params: {
    family?: string;
    name?: string;
    bu?: string;
    area?: string;
    priority?: number;
    efficiency?: number;
  }): void {
    if (params.family !== undefined) this._family = params.family;
    if (params.name !== undefined) this._name = params.name;
    if (params.bu !== undefined) this._bu = params.bu;
    if (params.area !== undefined) this._area = params.area;
    if (params.priority !== undefined) this._priority = params.priority;
    if (params.efficiency !== undefined) this._efficiency = params.efficiency;

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

  toJSON(): IProductModel {
    return {
      id: this._id,
      family: this._family,
      name: this._name,
      bu: this._bu,
      area: this._area,
      priority: this._priority,
      efficiency: this._efficiency,
      compatibleLines: [...this._compatibleLines],
      active: this._active,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._family || this._family.trim().length === 0) {
      throw new Error('Model family cannot be empty');
    }

    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Model name cannot be empty');
    }

    if (!this._bu || this._bu.trim().length === 0) {
      throw new Error('Business unit cannot be empty');
    }

    if (!this._area || this._area.trim().length === 0) {
      throw new Error('Area cannot be empty');
    }

    if (this._priority < 0) {
      throw new Error('Priority must be non-negative');
    }

    if (this._efficiency <= 0 || this._efficiency > 1) {
      throw new Error('Efficiency must be between 0 and 1');
    }
  }
}
