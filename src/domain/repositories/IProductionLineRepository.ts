// ============================================
// REPOSITORY INTERFACE: IProductionLineRepository
// Define contrato para persistencia de lineas de produccion
// ============================================

import { ProductionLine } from '../entities/ProductionLine';

/**
 * Interfaz de repositorio para Production Lines
 * 
 * Principio: Dependency Inversion (SOLID)
 * - Domain layer NO depende de infraestructura (SQLite)
 * - Permite cambiar implementacion sin afectar logica
 * - Facilita testing con mocks
 */
export interface IProductionLineRepository {
  findAll(): Promise<ProductionLine[]>;
  
  findById(id: string): Promise<ProductionLine | null>;
  
  findByArea(area: string): Promise<ProductionLine[]>;
  
  findActive(): Promise<ProductionLine[]>;
  
  save(line: ProductionLine): Promise<void>;
  
  delete(id: string): Promise<void>;
  
  existsByName(name: string, excludeId?: string): Promise<boolean>;
  
  updatePosition(id: string, x: number, y: number): Promise<void>;
}
