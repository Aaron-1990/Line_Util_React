// ============================================
// IPC HANDLERS - REGISTRATION
// Registra todos los handlers IPC
// ============================================

import { registerProductionLinesHandlers } from './production-lines.handler';
import { registerProductModelsHandlers } from './product-models.handler';
import { registerModelProcessesHandlers } from './model-processes.handler';
import { registerProductionVolumesHandlers } from './production-volumes.handler';

/**
 * Registra todos los handlers IPC de la aplicacion
 * 
 * Debe ser llamado en el main process antes de que la app este lista
 */
export function registerAllHandlers(): void {
  console.log('Registering IPC handlers...');

  registerProductionLinesHandlers();
  registerProductModelsHandlers();
  registerModelProcessesHandlers();
  registerProductionVolumesHandlers();

  console.log('IPC handlers registered successfully');
}
