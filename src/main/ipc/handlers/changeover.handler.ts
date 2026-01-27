// ============================================
// IPC HANDLER: Changeover Matrix
// Phase 5: Changeover time management
// Three-tier resolution: Global → Family → Line Override
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { CHANGEOVER_CHANNELS } from '@shared/constants';
import type {
  FamilyChangeoverDefault,
  LineChangeoverOverride,
  ResolvedChangeoverTime,
  ChangeoverMatrix,
  ChangeoverMethodId,
} from '@shared/types/changeover';
import DatabaseConnection from '../../database/connection';
import { SQLiteChangeoverRepository } from '../../database/repositories/SQLiteChangeoverRepository';

export function registerChangeoverHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const changeoverRepository = new SQLiteChangeoverRepository(db);

  // ============================================
  // GLOBAL SETTINGS
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_GLOBAL_DEFAULT,
    async (): Promise<ApiResponse<number>> => {
      try {
        console.log('[Changeover Handler] Getting global default');
        const minutes = await changeoverRepository.getGlobalDefault();
        return { success: true, data: minutes };
      } catch (error) {
        console.error('[Changeover Handler] Get global default error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.SET_GLOBAL_DEFAULT,
    async (_event, minutes: number): Promise<ApiResponse<void>> => {
      try {
        console.log('[Changeover Handler] Setting global default:', minutes);

        if (typeof minutes !== 'number' || minutes < 0 || minutes > 480) {
          return { success: false, error: 'Invalid changeover time (0-480 minutes)' };
        }

        await changeoverRepository.setGlobalDefault(minutes);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Changeover Handler] Set global default error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_SMED_BENCHMARK,
    async (): Promise<ApiResponse<number>> => {
      try {
        console.log('[Changeover Handler] Getting SMED benchmark');
        const minutes = await changeoverRepository.getSmedBenchmark();
        return { success: true, data: minutes };
      } catch (error) {
        console.error('[Changeover Handler] Get SMED benchmark error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.SET_SMED_BENCHMARK,
    async (_event, minutes: number): Promise<ApiResponse<void>> => {
      try {
        console.log('[Changeover Handler] Setting SMED benchmark:', minutes);

        if (typeof minutes !== 'number' || minutes < 0 || minutes > 60) {
          return { success: false, error: 'Invalid SMED benchmark (0-60 minutes)' };
        }

        await changeoverRepository.setSmedBenchmark(minutes);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Changeover Handler] Set SMED benchmark error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // FAMILY DEFAULTS
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_ALL_FAMILY_DEFAULTS,
    async (): Promise<ApiResponse<FamilyChangeoverDefault[]>> => {
      try {
        console.log('[Changeover Handler] Getting all family defaults');
        const defaults = await changeoverRepository.getAllFamilyDefaults();
        return { success: true, data: defaults };
      } catch (error) {
        console.error('[Changeover Handler] Get all family defaults error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_FAMILY_DEFAULT,
    async (
      _event,
      fromFamily: string,
      toFamily: string
    ): Promise<ApiResponse<FamilyChangeoverDefault | null>> => {
      try {
        console.log('[Changeover Handler] Getting family default:', fromFamily, '->', toFamily);

        if (!fromFamily || !toFamily) {
          return { success: false, error: 'Missing family names' };
        }

        const result = await changeoverRepository.getFamilyDefault(fromFamily, toFamily);
        return { success: true, data: result };
      } catch (error) {
        console.error('[Changeover Handler] Get family default error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.SET_FAMILY_DEFAULT,
    async (
      _event,
      fromFamily: string,
      toFamily: string,
      changeoverMinutes: number,
      notes?: string
    ): Promise<ApiResponse<FamilyChangeoverDefault>> => {
      try {
        console.log(
          '[Changeover Handler] Setting family default:',
          fromFamily,
          '->',
          toFamily,
          '=',
          changeoverMinutes
        );

        if (!fromFamily || !toFamily) {
          return { success: false, error: 'Missing family names' };
        }

        if (typeof changeoverMinutes !== 'number' || changeoverMinutes < 0 || changeoverMinutes > 480) {
          return { success: false, error: 'Invalid changeover time (0-480 minutes)' };
        }

        const result = await changeoverRepository.setFamilyDefault(
          fromFamily,
          toFamily,
          changeoverMinutes,
          notes
        );
        return { success: true, data: result };
      } catch (error) {
        console.error('[Changeover Handler] Set family default error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.DELETE_FAMILY_DEFAULT,
    async (_event, fromFamily: string, toFamily: string): Promise<ApiResponse<boolean>> => {
      try {
        console.log('[Changeover Handler] Deleting family default:', fromFamily, '->', toFamily);

        if (!fromFamily || !toFamily) {
          return { success: false, error: 'Missing family names' };
        }

        const deleted = await changeoverRepository.deleteFamilyDefault(fromFamily, toFamily);
        return { success: true, data: deleted };
      } catch (error) {
        console.error('[Changeover Handler] Delete family default error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.BULK_SET_FAMILY_DEFAULTS,
    async (
      _event,
      defaults: Array<{
        fromFamily: string;
        toFamily: string;
        changeoverMinutes: number;
        notes?: string;
      }>
    ): Promise<ApiResponse<number>> => {
      try {
        console.log('[Changeover Handler] Bulk setting family defaults:', defaults.length);

        if (!Array.isArray(defaults) || defaults.length === 0) {
          return { success: false, error: 'No defaults provided' };
        }

        const count = await changeoverRepository.bulkSetFamilyDefaults(defaults);
        return { success: true, data: count };
      } catch (error) {
        console.error('[Changeover Handler] Bulk set family defaults error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // LINE OVERRIDES
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_LINE_OVERRIDES,
    async (_event, lineId: string): Promise<ApiResponse<LineChangeoverOverride[]>> => {
      try {
        console.log('[Changeover Handler] Getting line overrides for:', lineId);

        if (!lineId) {
          return { success: false, error: 'Missing line ID' };
        }

        const overrides = await changeoverRepository.getLineOverrides(lineId);
        return { success: true, data: overrides };
      } catch (error) {
        console.error('[Changeover Handler] Get line overrides error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_LINE_OVERRIDE,
    async (
      _event,
      lineId: string,
      fromModelId: string,
      toModelId: string
    ): Promise<ApiResponse<LineChangeoverOverride | null>> => {
      try {
        console.log(
          '[Changeover Handler] Getting line override:',
          lineId,
          fromModelId,
          '->',
          toModelId
        );

        if (!lineId || !fromModelId || !toModelId) {
          return { success: false, error: 'Missing required parameters' };
        }

        const result = await changeoverRepository.getLineOverride(lineId, fromModelId, toModelId);
        return { success: true, data: result };
      } catch (error) {
        console.error('[Changeover Handler] Get line override error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.SET_LINE_OVERRIDE,
    async (
      _event,
      lineId: string,
      fromModelId: string,
      toModelId: string,
      changeoverMinutes: number,
      notes?: string
    ): Promise<ApiResponse<LineChangeoverOverride>> => {
      try {
        console.log(
          '[Changeover Handler] Setting line override:',
          lineId,
          fromModelId,
          '->',
          toModelId,
          '=',
          changeoverMinutes
        );

        if (!lineId || !fromModelId || !toModelId) {
          return { success: false, error: 'Missing required parameters' };
        }

        if (fromModelId === toModelId && changeoverMinutes !== 0) {
          return { success: false, error: 'Same model changeover must be 0 minutes' };
        }

        if (typeof changeoverMinutes !== 'number' || changeoverMinutes < 0 || changeoverMinutes > 480) {
          return { success: false, error: 'Invalid changeover time (0-480 minutes)' };
        }

        const result = await changeoverRepository.setLineOverride(
          lineId,
          fromModelId,
          toModelId,
          changeoverMinutes,
          notes
        );
        return { success: true, data: result };
      } catch (error) {
        console.error('[Changeover Handler] Set line override error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.DELETE_LINE_OVERRIDE,
    async (
      _event,
      lineId: string,
      fromModelId: string,
      toModelId: string
    ): Promise<ApiResponse<boolean>> => {
      try {
        console.log(
          '[Changeover Handler] Deleting line override:',
          lineId,
          fromModelId,
          '->',
          toModelId
        );

        if (!lineId || !fromModelId || !toModelId) {
          return { success: false, error: 'Missing required parameters' };
        }

        const deleted = await changeoverRepository.deleteLineOverride(lineId, fromModelId, toModelId);
        return { success: true, data: deleted };
      } catch (error) {
        console.error('[Changeover Handler] Delete line override error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.DELETE_ALL_LINE_OVERRIDES,
    async (_event, lineId: string): Promise<ApiResponse<number>> => {
      try {
        console.log('[Changeover Handler] Deleting all line overrides for:', lineId);

        if (!lineId) {
          return { success: false, error: 'Missing line ID' };
        }

        const count = await changeoverRepository.deleteAllLineOverrides(lineId);
        return { success: true, data: count };
      } catch (error) {
        console.error('[Changeover Handler] Delete all line overrides error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.BULK_SET_LINE_OVERRIDES,
    async (
      _event,
      overrides: Array<{
        lineId: string;
        fromModelId: string;
        toModelId: string;
        changeoverMinutes: number;
        notes?: string;
      }>
    ): Promise<ApiResponse<number>> => {
      try {
        console.log('[Changeover Handler] Bulk setting line overrides:', overrides.length);

        if (!Array.isArray(overrides) || overrides.length === 0) {
          return { success: false, error: 'No overrides provided' };
        }

        const count = await changeoverRepository.bulkSetLineOverrides(overrides);
        return { success: true, data: count };
      } catch (error) {
        console.error('[Changeover Handler] Bulk set line overrides error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // RESOLVED TIMES
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_RESOLVED_TIMES,
    async (_event, lineId: string): Promise<ApiResponse<ResolvedChangeoverTime[]>> => {
      try {
        console.log('[Changeover Handler] Getting resolved times for:', lineId);

        if (!lineId) {
          return { success: false, error: 'Missing line ID' };
        }

        const times = await changeoverRepository.getResolvedChangeoverTimes(lineId);
        return { success: true, data: times };
      } catch (error) {
        console.error('[Changeover Handler] Get resolved times error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_RESOLVED_TIME,
    async (
      _event,
      lineId: string,
      fromModelId: string,
      toModelId: string
    ): Promise<ApiResponse<ResolvedChangeoverTime | null>> => {
      try {
        console.log(
          '[Changeover Handler] Getting resolved time:',
          lineId,
          fromModelId,
          '->',
          toModelId
        );

        if (!lineId || !fromModelId || !toModelId) {
          return { success: false, error: 'Missing required parameters' };
        }

        const time = await changeoverRepository.getResolvedChangeoverTime(
          lineId,
          fromModelId,
          toModelId
        );
        return { success: true, data: time };
      } catch (error) {
        console.error('[Changeover Handler] Get resolved time error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // MATRIX
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_MATRIX,
    async (_event, lineId: string): Promise<ApiResponse<ChangeoverMatrix | null>> => {
      try {
        console.log('[Changeover Handler] Getting matrix for:', lineId);

        if (!lineId) {
          return { success: false, error: 'Missing line ID' };
        }

        const matrix = await changeoverRepository.getChangeoverMatrix(lineId);
        return { success: true, data: matrix };
      } catch (error) {
        console.error('[Changeover Handler] Get matrix error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.COPY_MATRIX,
    async (
      _event,
      sourceLineId: string,
      targetLineId: string
    ): Promise<ApiResponse<number>> => {
      try {
        console.log('[Changeover Handler] Copying matrix:', sourceLineId, '->', targetLineId);

        if (!sourceLineId || !targetLineId) {
          return { success: false, error: 'Missing required parameters' };
        }

        if (sourceLineId === targetLineId) {
          return { success: false, error: 'Cannot copy matrix to itself' };
        }

        const count = await changeoverRepository.copyMatrixFromLine(sourceLineId, targetLineId);
        return { success: true, data: count };
      } catch (error) {
        console.error('[Changeover Handler] Copy matrix error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CALCULATION METHOD
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_CALCULATION_METHOD,
    async (
      _event,
      context: 'global' | 'analysis' | 'simulation' = 'global'
    ): Promise<ApiResponse<{ methodId: ChangeoverMethodId; config: Record<string, unknown> }>> => {
      try {
        console.log('[Changeover Handler] Getting calculation method for:', context);
        const method = await changeoverRepository.getCalculationMethod(context);
        return { success: true, data: method };
      } catch (error) {
        console.error('[Changeover Handler] Get calculation method error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.SET_CALCULATION_METHOD,
    async (
      _event,
      context: 'global' | 'analysis' | 'simulation',
      methodId: ChangeoverMethodId,
      config?: Record<string, unknown>
    ): Promise<ApiResponse<void>> => {
      try {
        console.log('[Changeover Handler] Setting calculation method:', context, methodId);

        const validMethods = ['probability_weighted', 'tsp_optimal', 'worst_case', 'simple_average'];
        if (!validMethods.includes(methodId)) {
          return { success: false, error: 'Invalid calculation method' };
        }

        await changeoverRepository.setCalculationMethod(context, methodId, config);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Changeover Handler] Set calculation method error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UTILITIES
  // ============================================

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_ALL_FAMILIES,
    async (): Promise<ApiResponse<string[]>> => {
      try {
        console.log('[Changeover Handler] Getting all families');
        const families = await changeoverRepository.getAllFamilies();
        return { success: true, data: families };
      } catch (error) {
        console.error('[Changeover Handler] Get all families error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANGEOVER_CHANNELS.GET_LINES_WITH_DATA,
    async (): Promise<ApiResponse<string[]>> => {
      try {
        console.log('[Changeover Handler] Getting lines with changeover data');
        const lineIds = await changeoverRepository.getLinesWithChangeoverData();
        return { success: true, data: lineIds };
      } catch (error) {
        console.error('[Changeover Handler] Get lines with data error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Changeover Handler] Registered all changeover IPC handlers');
}
