// ============================================
// IPC HANDLERS - REGISTRATION
// Registra todos los handlers IPC
// ============================================

import { registerProductionLinesHandlers } from './production-lines.handler';
import { registerProductModelsHandlers } from './product-models.handler';
import { registerModelProcessesHandlers } from './model-processes.handler';
import { registerProductionVolumesHandlers } from './production-volumes.handler';
import { registerAreaCatalogHandlers } from './area-catalog.handler';
import { registerExcelHandlers } from './excel.handler';
import { registerMultiSheetExcelHandlers } from './multi-sheet-excel.handler';
import { registerVolumeHandlers } from './volumes.handler';

export function registerAllHandlers(): void {
  console.log('Registering IPC handlers...');

  registerProductionLinesHandlers();
  registerProductModelsHandlers();
  registerModelProcessesHandlers();
  registerProductionVolumesHandlers();
  registerAreaCatalogHandlers();
  registerExcelHandlers();
  registerMultiSheetExcelHandlers();
  registerVolumeHandlers();

  console.log('IPC handlers registered successfully');
}
