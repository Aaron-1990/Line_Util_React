// ============================================
// REPOSITORY INTERFACE: ICanvasAreaRepository
// Define contrato para areas visuales del canvas
// ============================================

import { CanvasArea } from '@shared/types';

export interface ICanvasAreaRepository {
  findAll(): Promise<CanvasArea[]>;
  
  findById(id: string): Promise<CanvasArea | null>;
  
  findByAreaCode(areaCode: string): Promise<CanvasArea[]>;
  
  save(area: CanvasArea): Promise<void>;
  
  delete(id: string): Promise<void>;
  
  updatePosition(id: string, x: number, y: number): Promise<void>;
  
  updateSize(id: string, width: number, height: number): Promise<void>;
}
