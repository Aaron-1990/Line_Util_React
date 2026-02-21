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
import { useCanvasObjectCompatibilityStore } from './useCanvasObjectCompatibilityStore';
import { useProjectStore } from '../../../store/useProjectStore';

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
  deleteAllObjects: (plantId: string) => Promise<void>;
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
  convertFromLine: (lineId: string, newType: CanvasObjectType, shapeId: string, plantId: string) => Promise<CanvasObjectWithDetails | null>;

  // Helpers
  getObjectById: (id: string) => CanvasObjectWithDetails | undefined;
  getObjectsByType: (type: CanvasObjectType) => CanvasObjectWithDetails[];
}

// ============================================
// Helper: Mark Unsaved Changes
// ============================================

const markProjectUnsaved = () => {
  useProjectStore.getState().markUnsavedChanges();
};

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
    markProjectUnsaved(); // Track unsaved changes for project save prompt
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
        markProjectUnsaved(); // Track unsaved changes
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

    // Optimistic update - handle nested processProperties merge
    set({
      objects: objects.map((obj) => {
        if (obj.id !== objectId) return obj;

        // Extract processProperties from input to handle separately
        const { processProperties: inputProps, ...restInput } = input;

        // Start with base object and simple fields
        const updatedObj = { ...obj, ...restInput };

        // Deep merge for processProperties (keep all required fields from original)
        if (inputProps && obj.processProperties) {
          updatedObj.processProperties = {
            ...obj.processProperties,
            ...inputProps,
          } as typeof obj.processProperties;
        }

        return updatedObj;
      }),
    });

    try {
      await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.UPDATE, objectId, input);
      markProjectUnsaved(); // Track unsaved changes
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
        // Revert on error - add object back to BOTH stores
        set({ objects: [...get().objects, objectToDelete] });
        // Phase 7.6: Use objectId reference only
        useCanvasStore.getState().addNode({
          id: objectToDelete.id,
          type: 'genericShape',
          position: { x: objectToDelete.xPosition, y: objectToDelete.yPosition },
          data: { objectId: objectToDelete.id },  // Phase 7.6: Reference only
          selectable: true, // Enable ReactFlow selection
          draggable: true,  // Enable dragging
        });
        console.warn('[CanvasObjectStore] Object delete failed, reverted to both stores');
        alert(`Failed to delete object: ${response.error}`);
      } else {
        markProjectUnsaved(); // Track unsaved changes
        // NOTE: No reload needed - optimistic update already removed object from both stores
        // Reloading here causes ReactFlow to re-initialize, which triggers selection clearing
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error deleting object:', error);
      // Revert on error - add object back to BOTH stores
      set({ objects: [...get().objects, objectToDelete] });
      // Phase 7.6: Use objectId reference only
      useCanvasStore.getState().addNode({
        id: objectToDelete.id,
        type: 'genericShape',
        position: { x: objectToDelete.xPosition, y: objectToDelete.yPosition },
        data: { objectId: objectToDelete.id },  // Phase 7.6: Reference only
        selectable: true, // Enable ReactFlow selection
        draggable: true,  // Enable dragging
      });
      console.warn('[CanvasObjectStore] Object delete exception, reverted to both stores');
      alert('Failed to delete object. Please try again.');

      // Reload to ensure sync (defensive)
      await get().loadObjectsForPlant(objectToDelete.plantId);
    }
  },

  /**
   * Delete all canvas objects for a plant (Clear Canvas)
   */
  deleteAllObjects: async (plantId: string) => {
    // 1. Clear objects + connections in store
    set({ objects: [], connections: [] });

    // 2. Clear ReactFlow nodes/edges
    useCanvasStore.getState().reset();

    // 3. Clear compatibility store
    useCanvasObjectCompatibilityStore.setState({ compatibilitiesByObject: new Map() });

    try {
      // 4. IPC call to soft-delete all objects for plant
      const response = await window.electronAPI.invoke<number>(
        CANVAS_OBJECT_CHANNELS.DELETE_BY_PLANT,
        plantId
      );

      if (!response.success) {
        console.error('[CanvasObjectStore] Delete all failed:', response.error);
        // 5. On failure: reload from DB to revert
        await get().loadObjectsForPlant(plantId);
        alert(`Failed to clear canvas: ${response.error}`);
      } else {
        console.log(`[CanvasObjectStore] Deleted ${response.data} objects for plant ${plantId}`);
        markProjectUnsaved();
      }
    } catch (error) {
      console.error('[CanvasObjectStore] Error deleting all objects:', error);
      // Reload from DB to revert
      await get().loadObjectsForPlant(plantId);
      alert('Failed to clear canvas. Please try again.');
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
        // NOTE: Must reload to fetch the new duplicated object from backend
        // Backend returns only the new ID, not the full object
        // Trade-off: This reload can trigger ReactFlow selection clearing after tab navigation
        // TODO: Consider having backend return full object to avoid reload
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

    // Optimistic update — populate processProperties defaults when converting to 'process'
    set({
      objects: objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        const updated = { ...obj, objectType: newType };
        if (newType === 'process' && !obj.processProperties) {
          updated.processProperties = {
            id: '',
            canvasObjectId: obj.id,
            area: '',
            timeAvailableDaily: 0,  // 0 = unset, user must explicitly set value
            lineType: 'shared' as const,
            changeoverEnabled: true,
          };
        }
        return updated;
      }),
    });

    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.CONVERT_TYPE,
        objectId,
        newType
      );
      // NOTE: No reload needed - optimistic update already changed type
      // Reloading causes ReactFlow to re-initialize, triggering selection clearing
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
      // NOTE: No reload needed - properties don't affect canvas rendering
      // Reloading causes ReactFlow to re-initialize, triggering selection clearing
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
   * Uses optimistic update pattern (store first, IPC second) for instant UI feedback.
   */
  setProcessProps: async (objectId: string, props: UpdateProcessPropertiesInput) => {
    const { objects } = get();
    const existingObject = objects.find((obj) => obj.id === objectId);
    if (!existingObject) return;

    // Optimistic update — store FIRST so badge and panel re-render instantly
    set({
      objects: objects.map(obj =>
        obj.id === objectId
          ? { ...obj, processProperties: { ...obj.processProperties, ...props } as typeof obj.processProperties }
          : obj
      ),
    });

    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.SET_PROCESS_PROPS,
        objectId,
        props
      );
      markProjectUnsaved();
    } catch (error) {
      console.error('[CanvasObjectStore] Error setting process props:', error);
      // Revert on error
      set({ objects });
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
      // NOTE: No reload needed - link relationship doesn't affect canvas rendering
      // Reloading causes ReactFlow to re-initialize, triggering selection clearing
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
      // NOTE: No reload needed - link removal doesn't affect canvas rendering
      // Reloading causes ReactFlow to re-initialize, triggering selection clearing
    } catch (error) {
      console.error('[CanvasObjectStore] Error unlinking from line:', error);
    }
  },

  /**
   * Convert a production line to a canvas object
   * This creates a new canvas object with the line's data and deletes the line
   * Returns the full CanvasObjectWithDetails (including shape) from the updated store
   */
  convertFromLine: async (lineId: string, newType: CanvasObjectType, shapeId: string, plantId: string): Promise<CanvasObjectWithDetails | null> => {
    try {
      console.log('[CanvasObjectStore] Converting line to canvas object:', lineId, newType);

      const response = await window.electronAPI.invoke<CanvasObject>(
        CANVAS_OBJECT_CHANNELS.CONVERT_FROM_LINE,
        { lineId, newType, shapeId }
      );

      if (response.success && response.data) {
        // NOTE: Must reload to fetch the new canvas object created from line
        // Backend creates a NEW object and deletes the line
        // Trade-off: This reload can trigger ReactFlow selection clearing after tab navigation
        // TODO: Consider having backend return full object to avoid reload
        await get().loadObjectsForPlant(plantId);

        // Get the full object with shape details from the UPDATED store
        const fullObject = get().objects.find(obj => obj.id === response.data!.id);
        return fullObject || null;
      }

      console.error('[CanvasObjectStore] Convert from line failed:', response.error);
      return null;
    } catch (error) {
      console.error('[CanvasObjectStore] Error converting from line:', error);
      return null;
    }
  },
}));
