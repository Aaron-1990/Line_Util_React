// ============================================
// ENTIDAD DE DOMINIO: ProductionLine
// Representa una linea de produccion con su logica de negocio
// ============================================

import { ProductionLine as IProductionLine } from '@shared/types';
import { nanoid } from 'nanoid';
import { TIME_CONFIG } from '@shared/constants';

/**
 * Entidad de Linea de Produccion
 * 
 * Principios aplicados:
 * - Single Responsibility: Solo maneja logica de una linea
 * - Encapsulation: Estado interno protegido
 * - Domain-Driven Design: Entidad rica con comportamiento
 * - Immutability: Getters sin setters directos
 */
export class ProductionLine {
  private constructor(
    private _id: string,
    private _name: string,
    private _area: string,
    private _lineType: 'shared' | 'dedicated',
    private _timeAvailableDaily: number,
    private _active: boolean,
    private _xPosition: number,
    private _yPosition: number,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // ===== Factory Methods =====

  static create(params: {
    name: string;
    area: string;
    lineType?: 'shared' | 'dedicated';
    timeAvailableDaily: number;
    xPosition?: number;
    yPosition?: number;
  }): ProductionLine {
    return new ProductionLine(
      nanoid(),
      params.name,
      params.area,
      params.lineType ?? 'shared',
      params.timeAvailableDaily,
      true,
      params.xPosition ?? 0,
      params.yPosition ?? 0,
      new Date(),
      new Date()
    );
  }

  static fromDatabase(data: IProductionLine): ProductionLine {
    return new ProductionLine(
      data.id,
      data.name,
      data.area,
      data.lineType ?? 'shared',
      data.timeAvailableDaily,
      data.active,
      data.xPosition,
      data.yPosition,
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

  get area(): string {
    return this._area;
  }

  get lineType(): 'shared' | 'dedicated' {
    return this._lineType;
  }

  get timeAvailableDaily(): number {
    return this._timeAvailableDaily;
  }

  get active(): boolean {
    return this._active;
  }

  get xPosition(): number {
    return this._xPosition;
  }

  get yPosition(): number {
    return this._yPosition;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ===== Business Logic =====

  // NOTE: Métodos relacionados con efficiency comentados temporalmente
  // Se reactivarán cuando se implemente la tabla Compatibilities
  
  // calculateEffectiveTime(): number {
  //   return this._timeAvailableDaily * this._efficiency;
  // }

  // calculateUtilization(timeUsed: number): number {
  //   const effectiveTime = this.calculateEffectiveTime();
  //   if (effectiveTime === 0) return 0;
  //   return (timeUsed / effectiveTime) * 100;
  // }

  // canHandle(timeRequired: number): boolean {
  //   return timeRequired <= this.calculateEffectiveTime();
  // }

  // getRemainingTime(timeUsed: number): number {
  //   return Math.max(0, this.calculateEffectiveTime() - timeUsed);
  // }

  update(params: {
    name?: string;
    area?: string;
    lineType?: 'shared' | 'dedicated';
    timeAvailableDaily?: number;
  }): void {
    if (params.name !== undefined) this._name = params.name;
    if (params.area !== undefined) this._area = params.area;
    if (params.lineType !== undefined) this._lineType = params.lineType;
    if (params.timeAvailableDaily !== undefined) {
      this._timeAvailableDaily = params.timeAvailableDaily;
    }

    this._updatedAt = new Date();
    this.validate();
  }

  updatePosition(x: number, y: number): void {
    this._xPosition = x;
    this._yPosition = y;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._active = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._active = true;
    this._updatedAt = new Date();
  }

  toJSON(): IProductionLine {
    return {
      id: this._id,
      name: this._name,
      area: this._area,
      lineType: this._lineType,
      timeAvailableDaily: this._timeAvailableDaily,
      active: this._active,
      xPosition: this._xPosition,
      yPosition: this._yPosition,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ===== Validation =====

  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Line name cannot be empty');
    }

    if (!this._area || this._area.trim().length === 0) {
      throw new Error('Area cannot be empty');
    }

    if (this._timeAvailableDaily <= 0) {
      throw new Error('Time available must be positive');
    }

    if (this._timeAvailableDaily > TIME_CONFIG.SECONDS_PER_DAY) {
      throw new Error(`Time available cannot exceed ${TIME_CONFIG.HOURS_PER_DAY} hours`);
    }
  }
}
