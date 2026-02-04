// ============================================
// IPC HANDLER: Canvas Objects
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { ipcMain } from 'electron';
import { ApiResponse } from '@shared/types';
import { CANVAS_OBJECT_CHANNELS } from '@shared/constants';
import DatabaseConnection from '../../database/connection';
import { SQLiteCanvasObjectRepository } from '../../database/repositories/SQLiteCanvasObjectRepository';
import type {
  CanvasObject,
  CanvasObjectWithDetails,
  BufferProperties,
  ProcessLineLink,
  CanvasConnection,
} from '@shared/types/canvas-object';
import type { CanvasObjectType } from '@shared/types/canvas-object';
import type { ProductionLine } from '@shared/types';

export function registerCanvasObjectHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repo = new SQLiteCanvasObjectRepository(db);

  // ============================================
  // GET OBJECTS BY PLANT
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.GET_BY_PLANT,
    async (_event, plantId: string): Promise<ApiResponse<CanvasObjectWithDetails[]>> => {
      try {
        console.log('[Canvas Object Handler] Getting objects by plant:', plantId);

        if (!plantId) {
          return { success: false, error: 'Missing plant ID' };
        }

        const objects = await repo.findByPlant(plantId);
        return { success: true, data: objects };
      } catch (error) {
        console.error('[Canvas Object Handler] Get by plant error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET OBJECT BY ID
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.GET_BY_ID,
    async (_event, id: string): Promise<ApiResponse<CanvasObjectWithDetails | null>> => {
      try {
        console.log('[Canvas Object Handler] Getting object by ID:', id);

        if (!id) {
          return { success: false, error: 'Missing object ID' };
        }

        const object = await repo.findById(id);
        return { success: true, data: object };
      } catch (error) {
        console.error('[Canvas Object Handler] Get by ID error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CREATE OBJECT
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.CREATE,
    async (
      _event,
      payload: {
        plantId: string;
        shapeId: string;
        name: string;
        xPosition: number;
        yPosition: number;
        objectType?: CanvasObjectType;
        width?: number;
        height?: number;
      }
    ): Promise<ApiResponse<CanvasObject>> => {
      try {
        console.log('[Canvas Object Handler] Creating object:', payload.name);

        if (!payload.plantId || !payload.shapeId || !payload.name) {
          return { success: false, error: 'Missing required fields: plantId, shapeId, or name' };
        }

        const object = await repo.create({
          plantId: payload.plantId,
          shapeId: payload.shapeId,
          name: payload.name,
          xPosition: payload.xPosition,
          yPosition: payload.yPosition,
          objectType: payload.objectType || 'generic',
          width: payload.width,
          height: payload.height,
        });

        return { success: true, data: object };
      } catch (error) {
        console.error('[Canvas Object Handler] Create error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE OBJECT
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.UPDATE,
    async (
      _event,
      objectId: string,
      updates: {
        name?: string;
        description?: string;
        colorOverride?: string;
        locked?: boolean;
      }
    ): Promise<ApiResponse<CanvasObject>> => {
      try {
        console.log('[Canvas Object Handler] Updating object:', objectId);

        if (!objectId) {
          return { success: false, error: 'Missing object ID' };
        }

        const object = await repo.update(objectId, updates);
        return { success: true, data: object };
      } catch (error) {
        console.error('[Canvas Object Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE OBJECT
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.DELETE,
    async (_event, objectId: string): Promise<ApiResponse<void>> => {
      try {
        console.log('[Canvas Object Handler] Deleting object:', objectId);

        if (!objectId) {
          return { success: false, error: 'Missing object ID' };
        }

        await repo.delete(objectId);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Canvas Object Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE POSITION
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.UPDATE_POSITION,
    async (
      _event,
      objectId: string,
      x: number,
      y: number
    ): Promise<ApiResponse<void>> => {
      try {
        console.log('[Canvas Object Handler] Updating position:', objectId, x, y);

        if (!objectId || x === undefined || y === undefined) {
          return { success: false, error: 'Missing object ID or position coordinates' };
        }

        await repo.updatePosition(objectId, x, y);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Canvas Object Handler] Update position error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE POSITIONS BATCH
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.UPDATE_POSITIONS_BATCH,
    async (
      _event,
      positions: Array<{ id: string; xPosition: number; yPosition: number }>
    ): Promise<ApiResponse<void>> => {
      try {
        console.log('[Canvas Object Handler] Batch updating positions:', positions.length, 'objects');

        if (!positions || positions.length === 0) {
          return { success: false, error: 'No positions provided' };
        }

        // Transform to repository format
        const repoPositions = positions.map(p => ({ id: p.id, x: p.xPosition, y: p.yPosition }));
        await repo.updatePositionsBatch(repoPositions);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Canvas Object Handler] Batch update positions error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DUPLICATE OBJECT
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.DUPLICATE,
    async (
      _event,
      id: string
    ): Promise<ApiResponse<CanvasObject>> => {
      try {
        console.log('[Canvas Object Handler] Duplicating object:', id);

        if (!id) {
          return { success: false, error: 'Missing object ID' };
        }

        const duplicate = await repo.duplicate(id);
        return { success: true, data: duplicate };
      } catch (error) {
        console.error('[Canvas Object Handler] Duplicate error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CONVERT OBJECT TYPE
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.CONVERT_TYPE,
    async (
      _event,
      objectId: string,
      newType: CanvasObjectType
    ): Promise<ApiResponse<CanvasObject>> => {
      try {
        console.log('[Canvas Object Handler] Converting object type:', objectId, 'to', newType);

        if (!objectId || !newType) {
          return { success: false, error: 'Missing object ID or new type' };
        }

        const object = await repo.convertType(objectId, newType);
        return { success: true, data: object };
      } catch (error) {
        console.error('[Canvas Object Handler] Convert type error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET BUFFER PROPERTIES
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.GET_BUFFER_PROPS,
    async (_event, objectId: string): Promise<ApiResponse<BufferProperties | null>> => {
      try {
        console.log('[Canvas Object Handler] Getting buffer properties:', objectId);

        if (!objectId) {
          return { success: false, error: 'Missing object ID' };
        }

        const props = await repo.getBufferProperties(objectId);
        return { success: true, data: props };
      } catch (error) {
        console.error('[Canvas Object Handler] Get buffer props error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // SET BUFFER PROPERTIES
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.SET_BUFFER_PROPS,
    async (
      _event,
      objectId: string,
      props: {
        maxCapacity?: number;
        bufferTimeHours?: number;
        fifoEnforced?: boolean;
        overflowPolicy?: 'block' | 'overflow' | 'alert';
      }
    ): Promise<ApiResponse<BufferProperties>> => {
      try {
        console.log('[Canvas Object Handler] Setting buffer properties:', objectId);

        if (!objectId) {
          return { success: false, error: 'Missing object ID' };
        }

        const bufferProps = await repo.setBufferProperties(objectId, props);
        return { success: true, data: bufferProps };
      } catch (error) {
        console.error('[Canvas Object Handler] Set buffer props error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // LINK TO PRODUCTION LINE
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.LINK_TO_LINE,
    async (
      _event,
      objectId: string,
      productionLineId: string
    ): Promise<ApiResponse<ProcessLineLink>> => {
      try {
        console.log('[Canvas Object Handler] Linking to production line:', objectId, productionLineId);

        if (!objectId || !productionLineId) {
          return { success: false, error: 'Missing object ID or production line ID' };
        }

        const link = await repo.linkToLine(objectId, productionLineId);
        return { success: true, data: link };
      } catch (error) {
        console.error('[Canvas Object Handler] Link to line error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UNLINK FROM PRODUCTION LINE
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.UNLINK_FROM_LINE,
    async (_event, objectId: string): Promise<ApiResponse<void>> => {
      try {
        console.log('[Canvas Object Handler] Unlinking from production line:', objectId);

        if (!objectId) {
          return { success: false, error: 'Missing object ID' };
        }

        await repo.unlinkFromLine(objectId);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Canvas Object Handler] Unlink from line error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET LINKED PRODUCTION LINE
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.GET_LINKED_LINE,
    async (_event, objectId: string): Promise<ApiResponse<ProductionLine | null>> => {
      try {
        console.log('[Canvas Object Handler] Getting linked production line:', objectId);

        if (!objectId) {
          return { success: false, error: 'Missing object ID' };
        }

        const link = await repo.getLinkedLine(objectId);
        return { success: true, data: link };
      } catch (error) {
        console.error('[Canvas Object Handler] Get linked line error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // GET CONNECTIONS
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.GET_CONNECTIONS,
    async (_event, plantId: string): Promise<ApiResponse<CanvasConnection[]>> => {
      try {
        console.log('[Canvas Object Handler] Getting connections for plant:', plantId);

        if (!plantId) {
          return { success: false, error: 'Missing plant ID' };
        }

        const connections = await repo.getConnections(plantId);
        return { success: true, data: connections };
      } catch (error) {
        console.error('[Canvas Object Handler] Get connections error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // CREATE CONNECTION
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.CREATE_CONNECTION,
    async (
      _event,
      payload: {
        plantId: string;
        sourceObjectId: string;
        targetObjectId: string;
        sourceAnchor?: string;
        targetAnchor?: string;
        connectionType?: 'flow' | 'info' | 'material';
        label?: string;
      }
    ): Promise<ApiResponse<CanvasConnection>> => {
      try {
        console.log('[Canvas Object Handler] Creating connection:', payload.sourceObjectId, '→', payload.targetObjectId);

        if (!payload.plantId || !payload.sourceObjectId || !payload.targetObjectId) {
          return { success: false, error: 'Missing required fields: plantId, sourceObjectId, or targetObjectId' };
        }

        const connection = await repo.createConnection({
          plantId: payload.plantId,
          sourceObjectId: payload.sourceObjectId,
          targetObjectId: payload.targetObjectId,
          sourceAnchor: payload.sourceAnchor,
          targetAnchor: payload.targetAnchor,
          connectionType: payload.connectionType || 'flow',
          label: payload.label,
        });

        return { success: true, data: connection };
      } catch (error) {
        console.error('[Canvas Object Handler] Create connection error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // DELETE CONNECTION
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.DELETE_CONNECTION,
    async (_event, payload: { id: string }): Promise<ApiResponse<void>> => {
      try {
        const { id } = payload;
        console.log('[Canvas Object Handler] Deleting connection:', id);

        if (!id) {
          return { success: false, error: 'Missing connection ID' };
        }

        await repo.deleteConnection(id);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('[Canvas Object Handler] Delete connection error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============================================
  // UPDATE CONNECTION
  // ============================================

  ipcMain.handle(
    CANVAS_OBJECT_CHANNELS.UPDATE_CONNECTION,
    async (
      _event,
      payload: {
        id: string;
        label?: string;
        connectionType?: 'flow' | 'info' | 'material';
      }
    ): Promise<ApiResponse<CanvasConnection>> => {
      try {
        const { id, ...updates } = payload;
        console.log('[Canvas Object Handler] Updating connection:', id);

        if (!id) {
          return { success: false, error: 'Missing connection ID' };
        }

        const connection = await repo.updateConnection(id, updates);
        return { success: true, data: connection };
      } catch (error) {
        console.error('[Canvas Object Handler] Update connection error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Canvas Object Handler] Registered all canvas object IPC handlers');
}
