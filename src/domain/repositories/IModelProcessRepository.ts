// ============================================
// REPOSITORY INTERFACE: IModelProcessRepository
// Define contrato para persistencia de procesos de modelos
// ============================================

import { ModelProcess } from '../entities/ModelProcess';

export interface IModelProcessRepository {
  findAll(): Promise<ModelProcess[]>;
  
  findById(id: string): Promise<ModelProcess | null>;
  
  findByModelId(modelId: string): Promise<ModelProcess[]>;
  
  save(process: ModelProcess): Promise<void>;
  
  delete(id: string): Promise<void>;
  
  deleteByModelId(modelId: string): Promise<void>;
}
