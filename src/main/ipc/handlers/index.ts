// ============================================
// IPC HANDLERS - REGISTRATION
// Registra todos los handlers IPC
// ============================================

import { registerProductionLinesHandlers } from './production-lines.handler';
import { registerProductModelsHandlers } from './product-models.handler';
import { registerModelProcessesHandlers } from './model-processes.handler';
import { registerProductionVolumesHandlers } from './production-volumes.handler';
import { registerAreaCatalogHandlers } from './area-catalog.handler';

export function registerAllHandlers(): void {
  console.log('Registering IPC handlers...');

  registerProductionLinesHandlers();
  registerProductModelsHandlers();
  registerModelProcessesHandlers();
  registerProductionVolumesHandlers();
  registerAreaCatalogHandlers();

  console.log('IPC handlers registered successfully');
}
