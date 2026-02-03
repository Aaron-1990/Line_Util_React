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
import { registerModelsV2Handlers } from './models-v2.handler';
import { registerCompatibilityHandlers } from './compatibility.handler';
import { registerAnalysisHandlers } from './analysis.handler';
import { registerWindowHandlers } from './window.handler';
import { registerChangeoverHandlers } from './changeover.handler';
import { registerRoutingHandlers } from './routing.handler';
import { registerPlantHandlers } from './plant.handler';
import { registerShapeCatalogHandlers } from './shape-catalog.handler';
import { registerCanvasObjectHandlers } from './canvas-objects.handler';

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
  registerModelsV2Handlers();
  registerCompatibilityHandlers();
  registerAnalysisHandlers();
  registerWindowHandlers();
  registerChangeoverHandlers();
  registerRoutingHandlers();
  registerPlantHandlers();
  registerShapeCatalogHandlers();
  registerCanvasObjectHandlers();

  console.log('IPC handlers registered successfully');
}
