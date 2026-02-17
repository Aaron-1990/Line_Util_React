// ============================================
// HOOK: useLoadLines
// Carga canvas objects desde DB al canvas (plant-scoped)
// Phase 7.5: Unified - all objects are now canvas_objects
// Migration 017: production_lines migrated to canvas_objects
// ============================================

import { useEffect, useState } from 'react';
import { Node } from 'reactflow';
import { useCanvasStore } from '../store/useCanvasStore';
import { useCanvasObjectStore } from '../store/useCanvasObjectStore';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { CanvasObjectWithDetails, CanvasConnection, CanvasNodeData } from '@shared/types';
import { CANVAS_OBJECT_CHANNELS } from '@shared/constants';

interface UseLoadLinesResult {
  isLoading: boolean;
  isEmpty: boolean;
  lineCount: number;  // Now counts process objects
  objectCount: number;
}

export function useLoadLines(): UseLoadLinesResult {
  // CRITICAL: Use specific selectors to prevent infinite reload loop
  // Subscribing to the entire store causes re-execution every time nodes change
  const setNodes = useCanvasStore((state) => state.setNodes);
  const setCanvasObjects = useCanvasObjectStore((state) => state.setObjects);
  const setConnections = useCanvasObjectStore((state) => state.setConnections);
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);
  const [isLoading, setIsLoading] = useState(true);
  const [objectCount, setObjectCount] = useState(0);

  useEffect(() => {
    const loadAll = async () => {
      // CRITICAL: Only load if plant actually changed (prevents redundant loads on remount)
      if (!currentPlantId) {
        setObjectCount(0);
        setNodes([]);
        setCanvasObjects([]);
        setIsLoading(false);
        return;
      }

      // Skip if store already has objects loaded for this plant
      // This survives component unmount/remount unlike useRef
      const currentObjects = useCanvasObjectStore.getState().objects;
      const hasObjectsForPlant = currentObjects.length > 0 &&
        currentObjects.every(obj => obj.plantId === currentPlantId);

      if (hasObjectsForPlant) {
        console.log('[useLoadLines] Store already has', currentObjects.length, 'objects for plant:', currentPlantId, '- syncing nodes');
        // Phase 7.6: Rebuild ReactFlow nodes with minimal data (objectId reference only)
        // GenericShapeNode retrieves full data via Zustand selector from objects[]
        const currentNodes = useCanvasStore.getState().nodes;
        const currentSelection = new Set(currentNodes.filter(n => n.selected).map(n => n.id));
        const updatedNodes: Node<CanvasNodeData>[] = currentObjects.map(obj => {
          const existingNode = currentNodes.find(n => n.id === obj.id);
          return {
            id: obj.id,
            type: 'genericShape',
            position: existingNode?.position ?? { x: obj.xPosition, y: obj.yPosition },
            data: { objectId: obj.id },  // Phase 7.6: Reference only
            selectable: true,
            draggable: true,
            selected: currentSelection.has(obj.id),
          };
        });
        setNodes(updatedNodes);
        setObjectCount(currentObjects.length);
        setIsLoading(false);
        return;
      }

      console.log('[useLoadLines] EXECUTING loadAll - currentPlantId:', currentPlantId);
      setIsLoading(true);

      try {

        // If no plant selected, don't load anything (redundant check, but keeping for safety)
        if (!currentPlantId) {
          setObjectCount(0);
          setNodes([]); // Clear nodes atomically
          setCanvasObjects([]);
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

          // STANDARD ReactFlow Pattern: Preserve selection state when updating nodes
          // Get current selection state from ReactFlow (source of truth)
          const currentNodes = useCanvasStore.getState().nodes;
          const currentSelection = new Set(currentNodes.filter(n => n.selected).map(n => n.id));

          // Phase 7.6: Build nodes with minimal data (objectId reference only)
          // GenericShapeNode retrieves full data via Zustand selector from objects[]
          const newNodes: Node<CanvasNodeData>[] = objectsResponse.data.map((obj) => ({
            id: obj.id,
            type: 'genericShape',  // All objects now use GenericShapeNode
            position: { x: obj.xPosition, y: obj.yPosition },
            data: { objectId: obj.id },  // Phase 7.6: Reference only
            selectable: true,  // Enable ReactFlow selection
            draggable: true,   // Enable dragging
            // CRITICAL: Preserve selection - if this node was selected before reload, keep it selected
            // This follows ReactFlow's controlled component pattern correctly
            selected: currentSelection.has(obj.id),
          }));

          // Set all nodes at once (atomic update)
          setNodes(newNodes);
        } else {
          setObjectCount(0);
          setNodes([]); // Clear nodes atomically
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
        // On error, store is already cleared (no objects), so retry will work automatically
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlantId]);
  // NOTE: setNodes, setCanvasObjects, setConnections are stable Zustand methods
  // and don't need to be in the dependency array. Including them causes spurious
  // re-executions after store updates, which clears ReactFlow selection.

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
