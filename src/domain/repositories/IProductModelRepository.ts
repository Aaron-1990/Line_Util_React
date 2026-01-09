// ============================================
// REPOSITORY INTERFACE: IProductModelRepository
// Define contrato para persistencia de modelos de producto
// ============================================

import { ProductModel } from '../entities/ProductModel';

export interface IProductModelRepository {
  findAll(): Promise<ProductModel[]>;
  
  findById(id: string): Promise<ProductModel | null>;
  
  findByFamily(family: string): Promise<ProductModel[]>;
  
  findByArea(area: string): Promise<ProductModel[]>;
  
  findActive(): Promise<ProductModel[]>;
  
  findCompatibleWithLine(lineId: string): Promise<ProductModel[]>;
  
  save(model: ProductModel): Promise<void>;
  
  delete(id: string): Promise<void>;
  
  existsByName(family: string, name: string, excludeId?: string): Promise<boolean>;
}
