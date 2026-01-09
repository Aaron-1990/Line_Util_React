// ============================================
// REPOSITORY INTERFACE: IProductionVolumeRepository
// Define contrato para persistencia de volumenes de produccion
// ============================================

import { ProductionVolume } from '../entities/ProductionVolume';

export interface IProductionVolumeRepository {
  findAll(): Promise<ProductionVolume[]>;
  
  findById(id: string): Promise<ProductionVolume | null>;
  
  findByYear(year: number): Promise<ProductionVolume[]>;
  
  findByFamily(family: string): Promise<ProductionVolume[]>;
  
  findByFamilyAndYear(family: string, year: number): Promise<ProductionVolume | null>;
  
  save(volume: ProductionVolume): Promise<void>;
  
  delete(id: string): Promise<void>;
  
  existsByFamilyAndYear(family: string, year: number, excludeId?: string): Promise<boolean>;
}
