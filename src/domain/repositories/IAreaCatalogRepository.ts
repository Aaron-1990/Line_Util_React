// ============================================
// REPOSITORY INTERFACE: IAreaCatalogRepository
// Define contrato para catalogo de areas configurables
// ============================================

import { AreaCatalogItem } from '@shared/types';

/**
 * Repositorio para catalogo de areas
 * 
 * Permite que cada empresa configure sus propias areas
 * sin necesidad de cambiar codigo
 */
export interface IAreaCatalogRepository {
  findAll(): Promise<AreaCatalogItem[]>;
  
  findById(id: string): Promise<AreaCatalogItem | null>;
  
  findByCode(code: string): Promise<AreaCatalogItem | null>;
  
  findActive(): Promise<AreaCatalogItem[]>;
  
  save(item: AreaCatalogItem): Promise<void>;
  
  delete(id: string): Promise<void>;
  
  existsByCode(code: string, excludeId?: string): Promise<boolean>;
  
  seed(defaultAreas: readonly { code: string; name: string; color: string }[]): Promise<void>;
}
