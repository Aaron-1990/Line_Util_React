// ============================================
// PRODUCTION CANVAS
// Componente principal del canvas con ReactFlow
// ============================================

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  SelectionMode,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  OnSelectionChangeParams,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom animation for edge flow direction (source → target)
const edgeAnimationStyles = `
  @keyframes dashdraw {
    from {
      stroke-dashoffset: 10;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
`;

// Default node dimensions (used for bounding box calculation)
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 120;

// Absolute minimum zoom (can zoom out to 0.1% if needed)
const ABSOLUTE_MIN_ZOOM = 0.001;
const MAX_ZOOM = 2;

import { useCanvasStore } from './store/useCanvasStore';
import { useToolStore } from './store/useToolStore';
import { useShapeCatalogStore } from './store/useShapeCatalogStore';
import { useCanvasObjectStore } from './store/useCanvasObjectStore';
import { useClipboardStore } from './store/useClipboardStore';
import { useLoadLines } from './hooks/useLoadLines';
import { useSelectionState } from './hooks/useSelectionState';
import { GenericShapeNode } from './components/nodes/GenericShapeNode';
import { CanvasToolbar } from './components/toolbar/CanvasToolbar';
import { ObjectPalette } from './components/toolbar/ObjectPalette';
import { UnifiedPropertiesPanel } from './components/panels/UnifiedPropertiesPanel';
import { YearNavigator } from './components/YearNavigator';
import { CanvasEmptyState } from './components/CanvasEmptyState';
import { ContextMenu } from './components/ContextMenu';
import { ConnectionContextMenu } from './components/ConnectionContextMenu';
import { GhostPreview } from './components/GhostPreview';
import { AnalysisControlBar, useAnalysisStore } from '../analysis';
import { ChangeoverMatrixModal } from '../changeover';
import { TIMELINE_EVENTS, WINDOW_CHANNELS, CANVAS_OBJECT_CHANNELS } from '@shared/constants';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { isPlaceTool, isPasteTool, CanvasConnection, ConnectionType, CanvasObjectWithDetails } from '@shared/types';
import { useNavigationStore } from '../../store/useNavigationStore';

// Phase 7.5: All nodes now use GenericShapeNode (unified)
// Keep productionLine key for backward compatibility with any cached state
const nodeTypes = {
  productionLine: GenericShapeNode,  // Deprecated - uses same component
  genericShape: GenericShapeNode,
};

// Inner component that has access to ReactFlow context
const CanvasInner = () => {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    updateNodePosition,
    setSelectedNode,
    addNode,
  } = useCanvasStore();

  const { fitView, screenToFlowPosition } = useReactFlow();
  const lastMiddleClickTime = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Track if user wants to bypass empty state and show canvas
  const [showCanvas, setShowCanvas] = useState(false);

  // Detect if properties panel is open (for MiniMap positioning)
  const selection = useSelectionState();
  const isPanelOpen = selection.type === 'line' || selection.type === 'object';

  // Get current plant ID for creating objects
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);

  // State for context menu (Phase 7.5)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId: string } | null>(null);

  // State for edge/connection context menu
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string; connectionType: string } | null>(null);

  // Tool store for placement and connect modes (Phase 7.5)
  const { activeTool, setGhostPosition, connectionSource, clearConnectionSource, clearSelection, setSelectTool, setPasteTool } = useToolStore();
  const { loadCatalog, getShapeById } = useShapeCatalogStore();
  const { createObject, addObject, connections, loadConnectionsForPlant } = useCanvasObjectStore();
  const { copyObject, copiedObject } = useClipboardStore();

  // Check if we're in connect mode
  const isConnectMode = activeTool === 'connect';

  // Check if we're in pan mode
  const isPanMode = activeTool === 'pan';

  // Load shape catalog on mount
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Connection type colors and styles
  const getConnectionStyle = (connectionType: string) => {
    switch (connectionType) {
      case 'flow':
        return { stroke: '#3B82F6', strokeWidth: 2 }; // Blue
      case 'material':
        return { stroke: '#10B981', strokeWidth: 3 }; // Green, thicker
      case 'info':
        return { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: '5,5' }; // Gray, dashed
      default:
        return { stroke: '#3B82F6', strokeWidth: 2 };
    }
  };

  // Convert stored connections to ReactFlow edges with directional arrows
  const connectionEdges = useMemo(() => {
    return connections.map((conn: CanvasConnection) => {
      const style = getConnectionStyle(conn.connectionType);
      const isAnimated = conn.connectionType === 'flow';

      return {
        id: conn.id,
        source: conn.sourceObjectId,
        sourceHandle: conn.sourceAnchor,
        target: conn.targetObjectId,
        targetHandle: conn.targetAnchor,
        type: 'smoothstep',
        animated: isAnimated,
        style: {
          ...style,
          // Reverse animation direction with negative offset animation
          ...(isAnimated && {
            animation: 'dashdraw 0.5s linear infinite',
            strokeDasharray: 5,
          }),
        },
        // Arrow marker at target to show flow direction
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: style.stroke,
          width: 20,
          height: 20,
        },
        label: conn.label,
        labelStyle: { fill: '#6B7280', fontSize: 12 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        labelBgPadding: [4, 2] as [number, number],
        // Store connection data for context menu
        data: { connectionType: conn.connectionType, connectionId: conn.id },
      };
    });
  }, [connections]);

  // Merge stored edges with connection edges
  const allEdges = useMemo(() => {
    return [...edges, ...connectionEdges];
  }, [edges, connectionEdges]);

  // Load lines for current plant
  const { isLoading, isEmpty } = useLoadLines();

  // Handlers for empty state actions
  const handleImportClick = useCallback(() => {
    navigate('/excel/import');
  }, [navigate]);

  const handleAddLineManually = useCallback(() => {
    setShowCanvas(true); // Show canvas with tools
  }, []);

  // Calculate dynamic minZoom based on node positions
  // This ensures we can always zoom out enough to see all nodes
  const dynamicMinZoom = useMemo(() => {
    if (nodes.length === 0) return 0.1; // Default when no nodes

    // Calculate bounding box of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const nodeWidth = node.width || DEFAULT_NODE_WIDTH;
      const nodeHeight = node.height || DEFAULT_NODE_HEIGHT;

      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    // Calculate the total spread of nodes
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Estimate viewport size (fallback to common screen size)
    const viewportWidth = containerRef.current?.clientWidth || 1920;
    const viewportHeight = containerRef.current?.clientHeight || 1080;

    // Calculate zoom needed to fit all content with padding
    const padding = 0.2; // 20% padding on each side
    const effectiveViewportWidth = viewportWidth * (1 - padding * 2);
    const effectiveViewportHeight = viewportHeight * (1 - padding * 2);

    const zoomToFitWidth = effectiveViewportWidth / contentWidth;
    const zoomToFitHeight = effectiveViewportHeight / contentHeight;
    const zoomToFit = Math.min(zoomToFitWidth, zoomToFitHeight);

    // Set minZoom to half of what's needed to fit (allows zooming out even more)
    // But never go below absolute minimum
    const calculatedMinZoom = Math.max(zoomToFit * 0.5, ABSOLUTE_MIN_ZOOM);

    // Don't exceed a reasonable default for small layouts
    return Math.min(calculatedMinZoom, 0.1);
  }, [nodes]);

  // AutoCAD-style: double-click middle mouse button = fit view (zoom extents)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMiddleClick = (event: MouseEvent) => {
      // Middle mouse button = 1
      if (event.button === 1) {
        const now = Date.now();
        const timeSinceLastClick = now - lastMiddleClickTime.current;

        // Double-click threshold: 400ms
        if (timeSinceLastClick < 400 && timeSinceLastClick > 50) {
          event.preventDefault();
          event.stopPropagation();
          fitView({
            padding: 0.1,
            duration: 300,
            includeHiddenNodes: true,
            minZoom: ABSOLUTE_MIN_ZOOM,
            maxZoom: 1.5,
          });
          lastMiddleClickTime.current = 0; // Reset to prevent triple-click
        } else {
          lastMiddleClickTime.current = now;
        }
      }
    };

    // Use capture phase to get the event before ReactFlow
    container.addEventListener('mousedown', handleMiddleClick, { capture: true });

    return () => {
      container.removeEventListener('mousedown', handleMiddleClick, { capture: true });
    };
  }, [fitView]);

  // Handle contextmenu event to prevent it from blocking right-click panning on Mac trackpads
  // Mac trackpads trigger 'contextmenu' event on two-finger click (right-click),
  // which prevents the mousedown event with button=2 from being processed for panning
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (event: MouseEvent) => {
      // Get the target element
      const target = event.target as HTMLElement;

      // Check if the click is on the pane (not on a node or edge)
      const isOnPane = target.classList.contains('react-flow__pane') ||
                       target.closest('.react-flow__pane') !== null;

      // Prevent context menu on pane to allow right-click panning
      // In both pan mode and normal mode, right-click (button 2) should pan, not show context menu
      if (isOnPane) {
        event.preventDefault();
        return;
      }
    };

    // Capture contextmenu events to prevent them from blocking panning
    container.addEventListener('contextmenu', handleContextMenu, { capture: false });

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu, { capture: false });
    };
  }, [isPanMode]);

  // Keyboard handler for selected objects (Delete, Escape)
  // Note: We get current state directly from stores to avoid stale closure issues
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Escape key - clear selection (AutoCAD-style)
      if (event.key === 'Escape') {
        event.preventDefault();
        // Clear our stores
        useToolStore.getState().clearSelection();
        useCanvasStore.getState().setSelectedNode(null);
        // Also clear ReactFlow's internal selection by updating all nodes
        const currentNodes = useCanvasStore.getState().nodes;
        const deselectedNodes = currentNodes.map(node => ({
          ...node,
          selected: false,
        }));
        useCanvasStore.getState().setNodes(deselectedNodes);
        return;
      }

      // Check for Delete or Backspace key (Mac uses Backspace for Delete)
      if (event.key === 'Delete' || event.key === 'Backspace') {

        // Get CURRENT state directly from stores to avoid stale closure
        const currentSelectedNode = useCanvasStore.getState().selectedNode;
        const currentSelectedObjectIds = useToolStore.getState().selectedObjectIds;
        const currentNodes = useCanvasStore.getState().nodes;

        // Combine BOTH selection sources (prioritize multi-select if available):
        // - selectedObjectIds from useToolStore (used for multi-select via onSelectionChange)
        // - selectedNode from useCanvasStore (fallback for single click selection)
        const objectsToDelete = currentSelectedObjectIds.length > 0
          ? currentSelectedObjectIds
          : currentSelectedNode
            ? [currentSelectedNode]
            : [];

        if (objectsToDelete.length > 0) {
          event.preventDefault();

          // Delete each selected object (Phase 7.5: all objects are canvas_objects)
          for (const objectId of objectsToDelete) {
            // Find the node
            const node = currentNodes.find((n) => n.id === objectId);

            if (node) {
              // All objects now use deleteObject from useCanvasObjectStore
              await useCanvasObjectStore.getState().deleteObject(objectId);
            } else {
              console.warn('[ProductionCanvas] Node not found for deletion:', objectId);
            }
          }

          // Clear selection after deletion
          useToolStore.getState().clearSelection();
          useCanvasStore.getState().setSelectedNode(null);
        }
      }
    };

    // Add event listener to document for keyboard events
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - we get current state directly from stores

  // Duplicate immediately (Ctrl+D)
  const handleDuplicateImmediate = useCallback(async (objectId: string) => {
    try {
      const response = await window.electronAPI.invoke<CanvasObjectWithDetails>(
        CANVAS_OBJECT_CHANNELS.DUPLICATE,
        { sourceObjectId: objectId, offset: { x: 20, y: 20 } }
      );

      if (response.success && response.data) {
        const newObjectWithDetails = response.data;

        // Add to canvas
        addNode({
          id: newObjectWithDetails.id,
          type: 'genericShape',
          position: { x: newObjectWithDetails.xPosition, y: newObjectWithDetails.yPosition },
          data: newObjectWithDetails,
        });

        // Add to store
        addObject(newObjectWithDetails);

        console.log('[Duplicate] Created:', newObjectWithDetails.name);
      }
    } catch (error) {
      console.error('[Duplicate] Error:', error);
    }
  }, [addNode, addObject, getShapeById]);

  // Keyboard shortcuts for copy/paste/duplicate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Get current state directly from stores
      const currentActiveTool = useToolStore.getState().activeTool;
      const currentSelectedNode = useCanvasStore.getState().selectedNode;
      const currentCopiedObject = useClipboardStore.getState().copiedObject;
      const currentObjects = useCanvasObjectStore.getState().objects;
      const currentPlantId = useNavigationStore.getState().currentPlantId;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // ESC - Cancel paste mode
      if (e.key === 'Escape' && isPasteTool(currentActiveTool)) {
        setSelectTool();
        return;
      }

      if (!isCtrlOrCmd) return;

      switch (e.key.toLowerCase()) {
        case 'c': // Copy
          if (currentSelectedNode) {
            e.preventDefault();
            const selectedObj = currentObjects.find(obj => obj.id === currentSelectedNode);
            if (selectedObj) {
              copyObject(selectedObj);
              console.log('[Copy] Copied to clipboard:', selectedObj.name);
            }
          }
          break;

        case 'v': // Paste (activate paste mode with ghost)
          if (currentCopiedObject && currentPlantId) {
            e.preventDefault();
            setPasteTool(currentCopiedObject.id);
            console.log('[Paste] Activated paste mode');
          }
          break;

        case 'd': // Duplicate (immediate with offset)
          if (currentSelectedNode && currentPlantId) {
            e.preventDefault();
            handleDuplicateImmediate(currentSelectedNode);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyObject, setPasteTool, setSelectTool, handleDuplicateImmediate]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);

      changes.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.id) {
          const updatedNode = updatedNodes.find(n => n.id === change.id);

          if (updatedNode) {
            updateNodePosition(change.id, updatedNode.position.x, updatedNode.position.y);

            // Phase 7.5: Use unified canvas object position update
            window.electronAPI
              .invoke(CANVAS_OBJECT_CHANNELS.UPDATE_POSITION, change.id, updatedNode.position.x, updatedNode.position.y)
              .catch((error) => {
                console.error('[ProductionCanvas] Error updating object position:', error);
              });
          }
        }
      });
    },
    [nodes, setNodes, updateNodePosition]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(updatedEdges);
    },
    [edges, setEdges]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!currentPlantId || !connection.source || !connection.target) return;

      // Persist connection to database
      try {
        const response = await window.electronAPI.invoke<CanvasConnection>(
          CANVAS_OBJECT_CHANNELS.CREATE_CONNECTION,
          {
            plantId: currentPlantId,
            sourceObjectId: connection.source,
            sourceAnchor: connection.sourceHandle,
            targetObjectId: connection.target,
            targetAnchor: connection.targetHandle,
            connectionType: 'flow',
          }
        );

        if (response.success) {
          // Reload connections to get the new one
          await loadConnectionsForPlant(currentPlantId);
          console.log('[ProductionCanvas] Connection created:', response.data?.id);
        } else {
          console.error('[ProductionCanvas] Failed to create connection:', response.error);
        }
      } catch (error) {
        console.error('[ProductionCanvas] Error creating connection:', error);
      }

      // Clear connection source if in connect mode
      if (isConnectMode) {
        clearConnectionSource();
      }
    },
    [currentPlantId, loadConnectionsForPlant, isConnectMode, clearConnectionSource]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  // Sync ReactFlow's multi-selection to useToolStore
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      const selectedIds = selectedNodes.map((n) => n.id);
      useToolStore.getState().setSelectedObjects(selectedIds);

      // If multiple nodes selected, clear single selection to avoid confusion
      if (selectedIds.length > 1) {
        setSelectedNode(null);
      }
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(async (event: React.MouseEvent) => {
    console.log('[onPaneClick] Fired - activeTool:', activeTool);

    setSelectedNode(null);
    clearSelection();
    setContextMenu(null);
    setEdgeContextMenu(null);

    // Clear connection source if in connect mode and clicking on pane
    if (isConnectMode && connectionSource) {
      clearConnectionSource();
      return;
    }

    // Handle PASTE mode (NEW)
    if (isPasteTool(activeTool) && currentPlantId && copiedObject) {
      console.log('[Paste] Pasting object:', copiedObject.name);

      try {
        // Get click position
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Duplicate object at click position
        const response = await window.electronAPI.invoke<CanvasObjectWithDetails>(
          CANVAS_OBJECT_CHANNELS.DUPLICATE,
          {
            sourceObjectId: copiedObject.id,
            offset: {
              x: position.x - copiedObject.xPosition,
              y: position.y - copiedObject.yPosition,
            },
          }
        );

        if (!response.success || !response.data) {
          console.error('[Paste] Failed:', response.error);
          return;
        }

        const newObjectWithDetails = response.data;

        // Add to canvas
        addNode({
          id: newObjectWithDetails.id,
          type: 'genericShape',
          position: { x: newObjectWithDetails.xPosition, y: newObjectWithDetails.yPosition },
          data: newObjectWithDetails,
        });

        // Add to store
        addObject(newObjectWithDetails);

        console.log('[Paste] ✓ Object pasted:', newObjectWithDetails.name);

        // KEEP in paste mode (allow multiple pastes)
        // User presses ESC to exit
      } catch (error) {
        console.error('[Paste] Error:', error);
      }
      return;
    }

    // Handle placement mode (Phase 7.5)
    if (isPlaceTool(activeTool) && currentPlantId) {
      console.log('[Placement] Conditions met - shapeId:', activeTool.shapeId, 'plantId:', currentPlantId);

      const shape = getShapeById(activeTool.shapeId);

      if (!shape) {
        console.error('[Placement] Shape not found in catalog:', activeTool.shapeId);
        return;
      }

      console.log('[Placement] Shape found:', shape.name);

      try {
        // Convert screen coordinates to flow (canvas) coordinates
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const xPos = position.x - shape.defaultWidth / 2;
        const yPos = position.y - shape.defaultHeight / 2;

        console.log('[Placement] Attempting to create object at position:', { xPos, yPos });

        // Create new object at click position
        const newObjectId = await createObject({
          plantId: currentPlantId,
          shapeId: activeTool.shapeId,
          name: `New ${shape.name}`,
          xPosition: xPos,
          yPosition: yPos,
        });

        if (!newObjectId) {
          console.error('[Placement] createObject returned null/undefined');
          return;
        }

        console.log('[Placement] Object created in DB with ID:', newObjectId);

        // Build the object data
        const objectData = {
          id: newObjectId,
          plantId: currentPlantId,
          shapeId: activeTool.shapeId,
          objectType: 'generic' as const,
          name: `New ${shape.name}`,
          xPosition: xPos,
          yPosition: yPos,
          rotation: 0,
          active: true,
          locked: false,
          zIndex: 0,
          shape: shape,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Add the new node directly to the canvas
        addNode({
          id: newObjectId,
          type: 'genericShape',
          position: { x: xPos, y: yPos },
          data: objectData,
        });

        // Also add to useCanvasObjectStore so ContextMenu can find it
        addObject(objectData);

        console.log('[Placement] ✓ Object successfully added to canvas');

        // KEEP tool in place mode - user can press ESC or click Select to exit
        // This allows placing multiple objects of the same type quickly
      } catch (error) {
        console.error('[Placement] Error creating object:', error);
      }
    } else {
      // Debug why placement didn't trigger
      if (!isPlaceTool(activeTool)) {
        console.log('[Placement] Skipped - not in place mode. activeTool:', activeTool);
      } else if (!currentPlantId) {
        console.error('[Placement] Skipped - no currentPlantId!');
      }
    }
  }, [setSelectedNode, clearSelection, activeTool, copiedObject, getShapeById, createObject, currentPlantId, screenToFlowPosition, addNode, addObject, isConnectMode, connectionSource, clearConnectionSource]);

  // Handle mouse move for ghost preview
  const onMouseMove = useCallback((event: React.MouseEvent) => {
    // Show ghost for place mode
    if (isPlaceTool(activeTool)) {
      setGhostPosition({ x: event.clientX, y: event.clientY });
    }

    // Show ghost for paste mode (NEW)
    if (isPasteTool(activeTool) && copiedObject) {
      setGhostPosition({ x: event.clientX, y: event.clientY });
    }
  }, [activeTool, copiedObject, setGhostPosition]);

  // Handle mouse leave to clear ghost
  const onMouseLeave = useCallback(() => {
    setGhostPosition(null);
  }, [setGhostPosition]);

  // Handle right-click for context menu (Phase 7.5)
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setEdgeContextMenu(null); // Close edge menu if open

    // Show context menu for both genericShape and productionLine nodes
    if (node.type === 'genericShape' || node.type === 'productionLine') {
      setContextMenu({ x: event.clientX, y: event.clientY, objectId: node.id });
    }
  }, []);

  // Handle right-click on edges/connections
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu(null); // Close node menu if open
    const connectionType = edge.data?.connectionType || 'flow';
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id, connectionType });
  }, []);

  // Handle pane context menu - prevent default to allow right-click panning
  const onPaneContextMenu = useCallback((_event: React.MouseEvent) => {
    // Don't prevent default - this allows ReactFlow's panOnDrag with button 2 to work
    // For Mac trackpads, we need to NOT prevent the contextmenu event
    // ReactFlow will handle the panning internally
  }, []);

  // Handle changing connection type
  const handleConnectionTypeChange = useCallback(async (edgeId: string, newType: ConnectionType) => {
    if (!currentPlantId) return;

    try {
      // Update connection type in database
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.UPDATE_CONNECTION,
        { id: edgeId, connectionType: newType }
      );
      // Reload connections to reflect change
      await loadConnectionsForPlant(currentPlantId);
    } catch (error) {
      console.error('[ProductionCanvas] Error updating connection type:', error);
    }
  }, [currentPlantId, loadConnectionsForPlant]);

  // Handle deleting connection
  const handleConnectionDelete = useCallback(async (edgeId: string) => {
    if (!currentPlantId) return;

    try {
      await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.DELETE_CONNECTION,
        { id: edgeId }
      );
      // Reload connections to reflect deletion
      await loadConnectionsForPlant(currentPlantId);
    } catch (error) {
      console.error('[ProductionCanvas] Error deleting connection:', error);
    }
  }, [currentPlantId, loadConnectionsForPlant]);

  // Show empty state when plant has no lines AND user hasn't chosen to show canvas
  if (isEmpty && !isLoading && !showCanvas) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-150"
      >
        <CanvasEmptyState
          onImportClick={handleImportClick}
          onAddLineManually={handleAddLineManually}
        />
      </div>
    );
  }

  // Get current tool type for cursor styling
  const currentToolType = isPlaceTool(activeTool) ? 'place' : activeTool;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-150 grid grid-rows-[1fr_auto]"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Custom CSS for edge animations */}
      <style>{edgeAnimationStyles}</style>

      {/* Main canvas area - takes available space (min-h-0 needed for grid to work) */}
      <div className="relative w-full min-h-0 h-full overflow-hidden">
        <CanvasToolbar />

        {/* Object Palette - Phase 7.5 */}
        <ObjectPalette />

        <ReactFlow
          nodes={nodes}
          edges={allEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          connectOnClick={isConnectMode}
          className="bg-gray-50 dark:bg-gray-900"
          data-tool={currentToolType}
          // Dynamic zoom limits - adapts to content spread
          minZoom={dynamicMinZoom}
          maxZoom={MAX_ZOOM}
          // AutoCAD-style selection: left-click drag = selection box (unless pan mode)
          selectionOnDrag={!isPanMode}
          selectionMode={SelectionMode.Partial}
          // Pan with middle mouse button (1) or right mouse button (2), OR left button (0) in pan mode
          panOnDrag={isPanMode ? [0, 1, 2] : [1, 2]}
          // Mouse wheel = zoom (not pan)
          zoomOnScroll={true}
          panOnScroll={false}
          // Disable node dragging in pan mode
          nodesDraggable={!isPanMode}
          // Allow multi-select with Ctrl/Cmd+click
          multiSelectionKeyCode="Meta"
          // Allow source-to-source connections (eliminates need for dual handles)
          connectionMode={ConnectionMode.Loose}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="[&>pattern>circle]:fill-gray-300 dark:[&>pattern>circle]:fill-gray-700"
          />

          <Controls
            position="bottom-left"
            showInteractive={false}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm [&>button]:bg-white [&>button]:dark:bg-gray-800 [&>button]:border-gray-200 [&>button]:dark:border-gray-700 [&>button]:text-gray-600 [&>button]:dark:text-gray-400 [&>button:hover]:bg-gray-100 [&>button:hover]:dark:bg-gray-700"
          />

          <MiniMap
            nodeColor={(node) => {
              const areaColors: Record<string, string> = {
                ICT: '#60a5fa',
                SMT: '#34d399',
                WAVE: '#fbbf24',
                ASSEMBLY: '#f472b6',
                TEST: '#a78bfa',
              };
              return areaColors[node.data.area as string] || '#9ca3af';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            position="bottom-right"
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-all duration-300"
            style={{
              // Shift MiniMap left when properties panel is open to avoid overlap
              // Panel width is 20rem (w-80) + 1rem (right-4) = 21rem
              right: isPanelOpen ? '22rem' : undefined,
            }}
          />
        </ReactFlow>

        {/* Year Navigator - Shows when multi-year results available */}
        <YearNavigator />

        {/* Status Badge - Shows when results are available in Timeline Window */}
        <TimelineStatusBadge />

        {/* Changeover Matrix Modal */}
        <ChangeoverMatrixModal />

        {/* Unified Properties Panel - Shows for both Lines and Canvas Objects */}
        <UnifiedPropertiesPanel />

        {/* Phase 7.5: Context Menu for Objects */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            objectId={contextMenu.objectId}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Phase 7.5: Context Menu for Connections */}
        {edgeContextMenu && (
          <ConnectionContextMenu
            x={edgeContextMenu.x}
            y={edgeContextMenu.y}
            edgeId={edgeContextMenu.edgeId}
            currentType={edgeContextMenu.connectionType}
            onClose={() => setEdgeContextMenu(null)}
            onTypeChange={handleConnectionTypeChange}
            onDelete={handleConnectionDelete}
          />
        )}

        {/* Phase 7.5: Ghost Preview for placement */}
        <GhostPreview />
      </div>

      {/* Analysis Control Bar - Auto-sized, always at bottom */}
      <AnalysisControlBar />
    </div>
  );
};

// Export wrapped with ReactFlowProvider so child components can use useReactFlow()
export const ProductionCanvas = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};

// Status badge component that shows when Timeline window has results
const TimelineStatusBadge = () => {
  const { results, status, resetAnalysis } = useAnalysisStore();
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // Check if timeline window is open on mount and when results change
  useEffect(() => {
    const checkTimelineWindow = async () => {
      if (results) {
        const response = await window.electronAPI.invoke<boolean>(WINDOW_CHANNELS.IS_TIMELINE_OPEN);
        setIsTimelineOpen(response.success && response.data === true);
      }
    };

    checkTimelineWindow();
  }, [results]);

  // Listen for timeline window close event
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(TIMELINE_EVENTS.WINDOW_CLOSED, () => {
      setIsTimelineOpen(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Don't show if no results or still running
  if (!results || status === 'running') return null;

  // Handler to focus the timeline window
  const handleFocusTimeline = async () => {
    const { areaCatalog } = useAnalysisStore.getState();
    const areaSequences = areaCatalog.map(area => ({
      code: area.code,
      sequence: area.sequence,
    }));

    await window.electronAPI.invoke(WINDOW_CHANNELS.OPEN_TIMELINE_WINDOW, {
      results,
      areaSequences,
    });
    setIsTimelineOpen(true);
  };

  return (
    <div className="absolute top-4 right-4 z-20">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Analysis Complete
          </span>
        </div>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
        <button
          onClick={handleFocusTimeline}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          {isTimelineOpen ? 'Focus Timeline' : 'Open Timeline'}
        </button>
        <button
          onClick={resetAnalysis}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
