// ============================================
// REPOSITORY INTERFACE: ILineModelAssignmentRepository
// Define contrato para asignaciones linea-modelo (Many-to-Many)
// ============================================

import { LineModelAssignment } from '@shared/types';

export interface ILineModelAssignmentRepository {
  findAll(): Promise<LineModelAssignment[]>;
  
  findByLineId(lineId: string): Promise<LineModelAssignment[]>;
  
  findByModelId(modelId: string): Promise<LineModelAssignment[]>;
  
  create(lineId: string, modelId: string): Promise<LineModelAssignment>;
  
  delete(id: string): Promise<void>;
  
  deleteByLineId(lineId: string): Promise<void>;
  
  deleteByModelId(modelId: string): Promise<void>;
  
  exists(lineId: string, modelId: string): Promise<boolean>;
}
