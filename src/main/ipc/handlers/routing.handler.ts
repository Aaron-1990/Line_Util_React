// ============================================
// IPC HANDLER: Model Area Routing
// Phase 6.5: DAG-based routing for parallel processes
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { ROUTING_CHANNELS } from '@shared/constants';
import type {
  ModelRoutingConfig,
  ModelAreaRoutingStepInput,
  RoutingValidationResult,
} from '@shared/types/routing';
import DatabaseConnection from '../../database/connection';
import { SQLiteModelAreaRoutingRepository } from '../../database/repositories/SQLiteModelAreaRoutingRepository';

export function registerRoutingHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const routingRepository = new SQLiteModelAreaRoutingRepository(db);

  // ============================================
  // GET ROUTING BY MODEL
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.GET_BY_MODEL,
    async (_event, modelId: string): Promise<ApiResponse<ModelRoutingConfig | null>> => {
      try {
        console.log('[Routing Handler] Getting routing for model:', modelId);

        if (!modelId) {
          return { success: false, error: 'Missing model ID' };
        }

        const config = await routingRepository.findByModel(modelId);
        return { success: true, data: config };
      } catch (error) {
        console.error('[Routing Handler] Get routing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // SET ROUTING (ATOMIC REPLACEMENT)
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.SET_ROUTING,
    async (
      _event,
      modelId: string,
      steps: ModelAreaRoutingStepInput[]
    ): Promise<ApiResponse<void>> => {
      try {
        console.log('[Routing Handler] Setting routing for model:', modelId, 'steps:', steps.length);

        if (!modelId) {
          return { success: false, error: 'Missing model ID' };
        }

        if (!Array.isArray(steps)) {
          return { success: false, error: 'Steps must be an array' };
        }

        // Validate DAG before saving
        const validation = routingRepository.validateSteps(steps);
        if (!validation.isValid) {
          const errors: string[] = [];
          if (validation.hasCycle) {
            errors.push(`Cycle detected involving: ${validation.cycleNodes?.join(', ')}`);
          }
          if (validation.hasOrphans) {
            errors.push(`Orphan areas detected: ${validation.orphanNodes?.join(', ')}`);
          }
          return { success: false, error: errors.join('; ') };
        }

        await routingRepository.setRouting(modelId, steps);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Routing Handler] Set routing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // SET PREDECESSORS FOR SINGLE AREA
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.SET_PREDECESSORS,
    async (
      _event,
      modelId: string,
      areaCode: string,
      predecessors: string[]
    ): Promise<ApiResponse<void>> => {
      try {
        console.log(
          '[Routing Handler] Setting predecessors for:',
          modelId,
          areaCode,
          predecessors
        );

        if (!modelId || !areaCode) {
          return { success: false, error: 'Missing model ID or area code' };
        }

        if (!Array.isArray(predecessors)) {
          return { success: false, error: 'Predecessors must be an array' };
        }

        await routingRepository.setPredecessors(modelId, areaCode, predecessors);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Routing Handler] Set predecessors error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE ROUTING
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.DELETE_ROUTING,
    async (_event, modelId: string): Promise<ApiResponse<void>> => {
      try {
        console.log('[Routing Handler] Deleting routing for model:', modelId);

        if (!modelId) {
          return { success: false, error: 'Missing model ID' };
        }

        await routingRepository.deleteRouting(modelId);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Routing Handler] Delete routing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // VALIDATE DAG
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.VALIDATE_DAG,
    async (_event, modelId: string): Promise<ApiResponse<RoutingValidationResult>> => {
      try {
        console.log('[Routing Handler] Validating routing for model:', modelId);

        if (!modelId) {
          return { success: false, error: 'Missing model ID' };
        }

        const result = await routingRepository.validateRouting(modelId);
        return { success: true, data: result };
      } catch (error) {
        console.error('[Routing Handler] Validate routing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET TOPOLOGICAL ORDER
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.GET_TOPOLOGICAL_ORDER,
    async (_event, modelId: string): Promise<ApiResponse<string[] | null>> => {
      try {
        console.log('[Routing Handler] Getting topological order for model:', modelId);

        if (!modelId) {
          return { success: false, error: 'Missing model ID' };
        }

        const order = await routingRepository.getTopologicalOrder(modelId);
        return { success: true, data: order };
      } catch (error) {
        console.error('[Routing Handler] Get topological order error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CHECK IF MODEL HAS ROUTING
  // ============================================

  ipcMain.handle(
    ROUTING_CHANNELS.HAS_ROUTING,
    async (_event, modelId: string): Promise<ApiResponse<boolean>> => {
      try {
        if (!modelId) {
          return { success: false, error: 'Missing model ID' };
        }

        const hasRouting = await routingRepository.hasRouting(modelId);
        return { success: true, data: hasRouting };
      } catch (error) {
        console.error('[Routing Handler] Has routing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Routing Handler] Registered all routing IPC handlers');
}
