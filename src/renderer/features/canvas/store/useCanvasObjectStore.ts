// ============================================
// CANVAS OBJECT STORE - Zustand
// State management for canvas objects (polymorphic shapes)
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { create } from 'zustand';
import {
  CanvasObjectWithDetails,
  CanvasConnection,
  CanvasObject,
  CreateCanvasObjectInput,
  UpdateCanvasObjectInput,
  CanvasObjectType,
  ProcessProperties,
  UpdateProcessPropertiesInput,
} from '@shared/types/canvas-object';
import { CANVAS_OBJECT_CHANNELS } from '@shared/constants';
import { useCanvasStore } from './useCanvasStore';

// ============================================
// TYPES
// ============================================

interface CanvasObjectStore {
  // State
  objects: CanvasObjectWithDetails[];
  connections: CanvasConnection[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setObjects: (objects: CanvasObjectWithDetails[]) => void;
  addObject: (object: CanvasObjectWithDetails) => void;
  setConnections: (connections: CanvasConnection[]) => void;
  loadObjectsForPlant: (plantId: string) => Promise<void>;
  loadConnectionsForPlant: (plantId: string) => Promise<void>;
  createObject: (input: CreateCanvasObjectInput) => Promise<string | null>;
  updateObject: (objectId: string, input: UpdateCanvasObjectInput) => Promise<void>;
  deleteObject: (objectId: string) => Promise<void>;
  duplicateObject: (objectId: string) => Promise<string | null>;
  convertObjectType: (objectId: string, newType: CanvasObjectType) => Promise<void>;
  convertType: (objectId: string, newType: CanvasObjectType) => Promise<void>; // Alias
  updatePosition: (objectId: string, x: number, y: number) => Promise<void>;

  // Buffer methods
  getBufferProps: (objectId: string) => Promise<unknown>;
  setBufferProps: (objectId: string, props: Record<string, unknown>) => Promise<void>;

  // Process methods
  getProcessProps: (objectId: string) => Promise<ProcessProperties | null>;
  setProcessProps: (objectId: string, props: UpdateProcessPropertiesInput) => Promise<void>;
  linkToLine: (objectId: string, lineId: string) => Promise<void>;
  unlinkFromLine: (objectId: string) => Promise<void>;

  // Conversion
  convertFromLine: (lineId: string, newType: CanvasObjectType, shapeId: string, plantId: string) => Promise<CanvasObject | null>;

  // Helpers
  getObjectById: (id: string) => CanvasObjectWithDetails | undefined;
  getObjectsByType: (type: CanvasObjectType) => CanvasObjectWithDetails[];
}

// ============================================
// STORE
// ============================================

export const useCanvasObjectStore = create<CanvasObjectStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  objects: [],
  connections: [],
  isLoading: false,
  error: null,

  /**
   * Set objects directly (used by useLoadLines)
   */
  setObjects: (objects: CanvasObjectWithDetails[]) => {
    set({ objects });
  },

  /**
   * Add a single object (used when creating new objects)
   */
  addObject: (object: CanvasObjectWithDetails) => {
    set((state) => ({ objects: [...state.objects, object] }));
  },

  /**
   * Set connections directly (used by useLoadLines)
   */
  setConnections: (connections: CanvasConnection[]) => {
    set({ connections });
  },

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Load all canvas objects for a specific plant
   */
  loadObjectsForPlant: async (plantId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<CanvasObjectWithDetails[]>(
        CANVAS_OBJECT_CHANNELS.GET_BY_PLANT,
        plantId
      );

      if (response.success && response.data) {
        set({ objects: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load objects', isLoading: false });
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error loading objects:', error);
      set({ error: 'Failed to load objects', isLoading: false });
    }
  },

  /**
   * Load all connections for a specific plant
   */
  loadConnectionsForPlant: async (plantId: string) => {
    try {
      const response = await window.electronAPI.invoke<CanvasConnection[]>(
        CANVAS_OBJECT_CHANNELS.GET_CONNECTIONS,
        plantId
      );

      if (response.success && response.data) {
        set({ connections: response.data });
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error loading connections:', error);
    }
  },

  /**
   * Create a new canvas object
   * Returns the new object ID or null on error
   */
  createObject: async (input: CreateCanvasObjectInput) => {
    try {
      // Handler returns full CanvasObject, we extract the ID
      const response = await window.electronAPI.invoke<{ id: string }>(
        CANVAS_OBJECT_CHANNELS.CREATE,
        input
      );

      if (response.success && response.data) {
        // Return just the ID (response.data is the full CanvasObject)
        return response.data.id;
      }

      return null;
    } catch (error) {
      console.error('[CanvasObjectStore] Error creating object:', error);
      return null;
    }
  },

  /**
   * Update an existing canvas object
   */
  updateObject: async (objectId: string, input: UpdateCanvasObjectInput) => {
    const { objects } = get();
    const existingObject = objects.find((obj) => obj.id === objectId);
    if (!existingObject) return;

    // Optimistic update
    set({
      objects: objects.map((obj) =>
        obj.id === objectId ? { ...obj, ...input } : obj
      ),
    });

    try {
      await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.UPDATE, objectId, input);
    } catch (error) {
      console.error('[CanvasObjectStore] Error updating object:', error);
      // Revert on error
      set({ objects });
    }
  },

  /**
   * Delete a canvas object
   */
  deleteObject: async (objectId: string) => {
    const { objects } = get();
    const objectToDelete = objects.find((obj) => obj.id === objectId);

    if (!objectToDelete) {
      return;
    }

    // Optimistic update - remove from objects array
    set({
      objects: objects.filter((obj) => obj.id !== objectId),
    });

    // Also remove the ReactFlow node immediately (optimistic)
    useCanvasStore.getState().deleteNode(objectId);

    try {
      const response = await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, objectId);

      if (!response.success) {
        console.error('[CanvasObjectStore] Delete failed:', response.error);
        // Revert on error - add object back
        set({ objects: [...get().objects, objectToDelete] });
        alert(`Failed to delete object: ${response.error}`);
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error deleting object:', error);
      // Revert on error
      set({ objects: [...get().objects, objectToDelete] });
      alert('Failed to delete object. Please try again.');
    }
  },

  /**
   * Duplicate a canvas object
   * Returns the new object ID or null on error
   */
  duplicateObject: async (objectId: string) => {
    try {
      const response = await window.electronAPI.invoke<string>(
        CANVAS_OBJECT_CHANNELS.DUPLICATE,
        objectId
      );

      if (response.success && response.data) {
        // Reload objects
        const { objects } = get();
        const originalObject = objects.find((obj) => obj.id === objectId);
        if (originalObject) {
          await get().loadObjectsForPlant(originalObject.plantId);
        }
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('[CanvasObjectStore] Error duplicating object:', error);
      return null;
    }
  },

  /**
   * Convert an object to a different type
   */
  convertObjectType: async (objectId: string, newType: CanvasObjectType) => {
    const { objects } = get();
    const existingObject = objects.find((obj) => obj.id === objectId);
    if (!existingObject) return;

    // Optimistic update
    set({
      objects: objects.map((obj) =>
        obj.id === objectId ? { ...obj, objectType: newType } : obj
      ),
    });

    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.CONVERT_TYPE,
        objectId,
        newType
      );

      // Reload to get updated properties
      await get().loadObjectsForPlant(existingObject.plantId);
    } catch (error) {
      console.error('[CanvasObjectStore] Error converting object type:', error);
      // Revert on error
      set({ objects });
    }
  },

  /**
   * Update object position
   */
  updatePosition: async (objectId: string, x: number, y: number) => {
    const { objects } = get();

    // Optimistic update
    set({
      objects: objects.map((obj) =>
        obj.id === objectId ? { ...obj, xPosition: x, yPosition: y } : obj
      ),
    });

    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.UPDATE_POSITION,
        objectId,
        x,
        y
      );
    } catch (error) {
      console.error('[CanvasObjectStore] Error updating position:', error);
      // Revert on error
      set({ objects });
    }
  },

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Get a specific object by ID
   */
  getObjectById: (id: string) => {
    const { objects } = get();
    return objects.find((obj) => obj.id === id);
  },

  /**
   * Get objects filtered by type
   */
  getObjectsByType: (type: CanvasObjectType) => {
    const { objects } = get();
    return objects.filter((obj) => obj.objectType === type && obj.active);
  },

  /**
   * Convert type (alias for convertObjectType)
   */
  convertType: async (objectId: string, newType: CanvasObjectType) => {
    await get().convertObjectType(objectId, newType);
  },

  /**
   * Get buffer properties for an object
   */
  getBufferProps: async (objectId: string) => {
    try {
      const response = await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.GET_BUFFER_PROPS,
        objectId
      );
      return response.success ? response.data : null;
    } catch (error) {
      console.error('[CanvasObjectStore] Error getting buffer props:', error);
      return null;
    }
  },

  /**
   * Set buffer properties for an object
   */
  setBufferProps: async (objectId: string, props: Record<string, unknown>) => {
    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.SET_BUFFER_PROPS,
        objectId,
        props
      );
      // Reload to get updated properties
      const { objects } = get();
      const obj = objects.find((o) => o.id === objectId);
      if (obj) {
        await get().loadObjectsForPlant(obj.plantId);
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error setting buffer props:', error);
    }
  },

  /**
   * Get process properties for an object
   */
  getProcessProps: async (objectId: string): Promise<ProcessProperties | null> => {
    try {
      const response = await window.electronAPI.invoke<ProcessProperties>(
        CANVAS_OBJECT_CHANNELS.GET_PROCESS_PROPS,
        objectId
      );
      return response.success ? response.data ?? null : null;
    } catch (error) {
      console.error('[CanvasObjectStore] Error getting process props:', error);
      return null;
    }
  },

  /**
   * Set process properties for an object
   */
  setProcessProps: async (objectId: string, props: UpdateProcessPropertiesInput) => {
    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.SET_PROCESS_PROPS,
        objectId,
        props
      );
      // Reload to get updated properties
      const { objects } = get();
      const obj = objects.find((o) => o.id === objectId);
      if (obj) {
        await get().loadObjectsForPlant(obj.plantId);
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error setting process props:', error);
    }
  },

  /**
   * Link a process object to a production line
   */
  linkToLine: async (objectId: string, lineId: string) => {
    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.LINK_TO_LINE,
        objectId,
        lineId
      );
      // Reload to get updated link
      const { objects } = get();
      const obj = objects.find((o) => o.id === objectId);
      if (obj) {
        await get().loadObjectsForPlant(obj.plantId);
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error linking to line:', error);
    }
  },

  /**
   * Unlink a process object from its production line
   */
  unlinkFromLine: async (objectId: string) => {
    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.UNLINK_FROM_LINE,
        objectId
      );
      // Reload to get updated state
      const { objects } = get();
      const obj = objects.find((o) => o.id === objectId);
      if (obj) {
        await get().loadObjectsForPlant(obj.plantId);
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error unlinking from line:', error);
    }
  },

  /**
   * Convert a production line to a canvas object
   * This creates a new canvas object with the line's data and deletes the line
   */
  convertFromLine: async (lineId: string, newType: CanvasObjectType, shapeId: string, plantId: string): Promise<CanvasObject | null> => {
    try {
      console.log('[CanvasObjectStore] Converting line to canvas object:', lineId, newType);

      const response = await window.electronAPI.invoke<CanvasObject>(
        CANVAS_OBJECT_CHANNELS.CONVERT_FROM_LINE,
        { lineId, newType, shapeId }
      );

      if (response.success && response.data) {
        // Reload objects for the plant to get the new canvas object
        await get().loadObjectsForPlant(plantId);
        return response.data;
      }

      console.error('[CanvasObjectStore] Convert from line failed:', response.error);
      return null;
    } catch (error) {
      console.error('[CanvasObjectStore] Error converting from line:', error);
      return null;
    }
  },
}));
