// ============================================
// HOOK: useLoadLines
// Carga canvas objects desde DB al canvas (plant-scoped)
// Phase 7.5: Unified - all objects are now canvas_objects
// Migration 017: production_lines migrated to canvas_objects
// ============================================

import { useEffect, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useCanvasObjectStore } from '../store/useCanvasObjectStore';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { CanvasObjectWithDetails, CanvasConnection } from '@shared/types';
import { CANVAS_OBJECT_CHANNELS } from '@shared/constants';

interface UseLoadLinesResult {
  isLoading: boolean;
  isEmpty: boolean;
  lineCount: number;  // Now counts process objects
  objectCount: number;
}

export function useLoadLines(): UseLoadLinesResult {
  const { addNode, setNodes } = useCanvasStore();
  const setCanvasObjects = useCanvasObjectStore((state) => state.setObjects);
  const setConnections = useCanvasObjectStore((state) => state.setConnections);
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);
  const [isLoading, setIsLoading] = useState(true);
  const [objectCount, setObjectCount] = useState(0);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);

      try {
        // Clear existing nodes
        setNodes([]);

        // If no plant selected, don't load anything
        if (!currentPlantId) {
          setObjectCount(0);
          setIsLoading(false);
          return;
        }

        // Load canvas objects and connections in parallel
        // Phase 7.5: All objects (including former production_lines) are now canvas_objects
        const [objectsResponse, connectionsResponse] = await Promise.all([
          window.electronAPI.invoke<CanvasObjectWithDetails[]>(
            CANVAS_OBJECT_CHANNELS.GET_BY_PLANT,
            currentPlantId
          ),
          window.electronAPI.invoke<CanvasConnection[]>(
            CANVAS_OBJECT_CHANNELS.GET_CONNECTIONS,
            currentPlantId
          ),
        ]);

        // Add canvas objects (unified structure)
        if (objectsResponse.success && objectsResponse.data) {
          setObjectCount(objectsResponse.data.length);

          // Store objects in useCanvasObjectStore for ContextMenu and panel access
          setCanvasObjects(objectsResponse.data);

          objectsResponse.data.forEach((obj) => {
            addNode({
              id: obj.id,
              type: 'genericShape',  // All objects now use GenericShapeNode
              position: { x: obj.xPosition, y: obj.yPosition },
              data: obj, // Pass the full CanvasObjectWithDetails
            });
          });
        } else {
          setObjectCount(0);
          setCanvasObjects([]);
        }

        // Store connections (Phase 7.5 - Connect Tool)
        if (connectionsResponse.success && connectionsResponse.data) {
          setConnections(connectionsResponse.data);
        } else {
          setConnections([]);
        }
      } catch (error) {
        console.error('Error loading canvas data:', error);
        setObjectCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, [addNode, setNodes, currentPlantId, setCanvasObjects, setConnections]);

  // Count process objects as "lines" for backward compatibility
  const processCount = useCanvasObjectStore.getState().objects.filter(
    obj => obj.objectType === 'process'
  ).length;

  return {
    isLoading,
    isEmpty: !isLoading && objectCount === 0,
    lineCount: processCount,  // Process objects count as lines
    objectCount,
  };
}
