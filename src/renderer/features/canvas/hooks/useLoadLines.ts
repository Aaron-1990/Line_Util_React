// ============================================
// HOOK: useLoadLines
// Carga lineas y canvas objects desde DB al canvas (plant-scoped)
// Phase 7: Lines are now filtered by current plant
// Phase 7.5: Also loads canvas objects (generic shapes)
// ============================================

import { useEffect, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useCanvasObjectStore } from '../store/useCanvasObjectStore';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { ProductionLine, CanvasObjectWithDetails, CanvasConnection } from '@shared/types';
import { IPC_CHANNELS, CANVAS_OBJECT_CHANNELS } from '@shared/constants';

interface UseLoadLinesResult {
  isLoading: boolean;
  isEmpty: boolean;
  lineCount: number;
  objectCount: number;
}

export function useLoadLines(): UseLoadLinesResult {
  const { addNode, setNodes } = useCanvasStore();
  const setCanvasObjects = useCanvasObjectStore((state) => state.setObjects);
  const setConnections = useCanvasObjectStore((state) => state.setConnections);
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);
  const [isLoading, setIsLoading] = useState(true);
  const [lineCount, setLineCount] = useState(0);
  const [objectCount, setObjectCount] = useState(0);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);

      try {
        // Clear existing nodes
        setNodes([]);

        // If no plant selected, don't load anything
        if (!currentPlantId) {
          setLineCount(0);
          setObjectCount(0);
          setIsLoading(false);
          return;
        }

        // Load lines, canvas objects, and connections in parallel
        const [linesResponse, objectsResponse, connectionsResponse] = await Promise.all([
          window.electronAPI.invoke<ProductionLine[]>(
            IPC_CHANNELS.LINES_GET_BY_PLANT,
            currentPlantId
          ),
          window.electronAPI.invoke<CanvasObjectWithDetails[]>(
            CANVAS_OBJECT_CHANNELS.GET_BY_PLANT,
            currentPlantId
          ),
          window.electronAPI.invoke<CanvasConnection[]>(
            CANVAS_OBJECT_CHANNELS.GET_CONNECTIONS,
            currentPlantId
          ),
        ]);

        // Add production lines
        if (linesResponse.success && linesResponse.data) {
          setLineCount(linesResponse.data.length);

          linesResponse.data.forEach((line) => {
            addNode({
              id: line.id,
              type: 'productionLine',
              position: { x: line.xPosition, y: line.yPosition },
              data: {
                id: line.id,
                name: line.name,
                area: line.area,
                timeAvailableDaily: line.timeAvailableDaily,
                changeoverEnabled: line.changeoverEnabled,
                changeoverExplicit: line.changeoverExplicit,
                assignedModelsCount: 0,
              },
            });
          });
        } else {
          setLineCount(0);
        }

        // Add canvas objects (Phase 7.5)
        if (objectsResponse.success && objectsResponse.data) {
          setObjectCount(objectsResponse.data.length);

          // Store objects in useCanvasObjectStore for ContextMenu access
          setCanvasObjects(objectsResponse.data);

          objectsResponse.data.forEach((obj) => {
            addNode({
              id: obj.id,
              type: 'genericShape',
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
        setLineCount(0);
        setObjectCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, [addNode, setNodes, currentPlantId, setCanvasObjects, setConnections]);

  return {
    isLoading,
    isEmpty: !isLoading && lineCount === 0 && objectCount === 0,
    lineCount,
    objectCount,
  };
}
