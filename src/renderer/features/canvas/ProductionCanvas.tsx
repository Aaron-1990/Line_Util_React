// ============================================
// PRODUCTION CANVAS
// Componente principal del canvas con ReactFlow
// ============================================

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
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
import { useLayoutStore } from './store/useLayoutStore';
import { useLoadLines } from './hooks/useLoadLines';
import { GenericShapeNode } from './components/nodes/GenericShapeNode';
import { LayoutImageNode } from './components/nodes/LayoutImageNode';
import { CanvasToolbar } from './components/toolbar/CanvasToolbar';
import { ObjectPalette } from './components/toolbar/ObjectPalette';
import { UnifiedPropertiesPanel } from './components/panels/UnifiedPropertiesPanel';
import { YearNavigator } from './components/YearNavigator';
import { CanvasEmptyState } from './components/CanvasEmptyState';
import { ContextMenu } from './components/ContextMenu';
import { DraggableMiniMap, loadMinimapVisible, saveMinimapVisible } from './components/DraggableMiniMap';
import { ConnectionContextMenu } from './components/ConnectionContextMenu';
import { GhostPreview } from './components/GhostPreview';
import { AnalysisControlBar, useAnalysisStore } from '../analysis';
import { ChangeoverMatrixModal } from '../changeover';
import { TIMELINE_EVENTS, WINDOW_CHANNELS, CANVAS_OBJECT_CHANNELS, LAYOUT_CHANNELS } from '@shared/constants';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { isPlaceTool, isPasteTool, CanvasConnection, ConnectionType, CanvasObjectWithDetails } from '@shared/types';
import { useNavigationStore } from '../../store/useNavigationStore';

// Phase 7.5: All nodes now use GenericShapeNode (unified)
// Phase 8.5: Added layoutImage node type for background layout images
const nodeTypes = {
  productionLine: GenericShapeNode,  // Deprecated - uses same component
  genericShape: GenericShapeNode,
  layoutImage: LayoutImageNode,
};

// Inner component that has access to ReactFlow context
const CanvasInner = () => {
  // STANDARD PATTERN: Use specific Zustand selectors to prevent unnecessary re-renders
  // State values: Individual selectors (subscribe to specific fields only)
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  // Phase 8.5: selectedNode needed to drive `selected` prop on layout nodes
  const selectedNode = useCanvasStore((state) => state.selectedNode);

  // Function refs: useShallow for stable references (Zustand 4.5+ best practice)
  // This prevents callback recreation on every render
  const { setNodes, setEdges, updateNodePosition, setSelectedNode, addNode } = useCanvasStore(
    useShallow((state) => ({
      setNodes: state.setNodes,
      setEdges: state.setEdges,
      updateNodePosition: state.updateNodePosition,
      setSelectedNode: state.setSelectedNode,
      addNode: state.addNode,
    }))
  );

  const { fitView, screenToFlowPosition, getNodes } = useReactFlow();
  const lastMiddleClickTime = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Track if user wants to bypass empty state and show canvas
  const [showCanvas, setShowCanvas] = useState(false);

  // MiniMap visibility state (persisted to localStorage)
  const [showMiniMap, setShowMiniMap] = useState(() => loadMinimapVisible());

  // Get current plant ID for creating objects
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);

  // Phase 8.5: Layout store - subscribe to layouts and actions
  const layouts = useLayoutStore((state) => state.layouts);
  const cropModeLayoutId = useLayoutStore((state) => state.cropModeLayoutId);
  const { loadLayoutsForPlant, updateLayout: updateLayoutStore } = useLayoutStore(
    useShallow((state) => ({
      loadLayoutsForPlant: state.loadLayoutsForPlant,
      updateLayout: state.updateLayout,
    }))
  );

  // Load layouts when plant changes (plant-scoped, same pattern as useLoadLines)
  useEffect(() => {
    if (currentPlantId) {
      loadLayoutsForPlant(currentPlantId);
    } else {
      // Clear layouts when no plant selected
      useLayoutStore.setState({ layouts: [] });
    }
  }, [currentPlantId, loadLayoutsForPlant]);

  // Phase 8.5: Build ReactFlow nodes for layout images
  // layoutImage nodes use very low zIndex so they render BEHIND process objects
  const layoutNodes = useMemo((): Node[] => {
    return layouts
      .filter((l) => l.active)
      .map((l) => {
        // Pass-through: when locked and not currently selected, set pointerEvents: 'none'
        // so mousedown on the node area reaches the pane layer and starts box selection.
        // When selected (user clicked the lock badge), remove pass-through so overlay
        // buttons (unlock, visibility) become interactive.
        const isPassThrough = l.locked && selectedNode !== l.id;
        return {
          id: l.id,
          type: 'layoutImage',
          position: { x: l.xPosition, y: l.yPosition },
          data: { layoutId: l.id },
          // Drive ReactFlow's `selected` prop from the canvas store so NodeResizer renders
          selected: selectedNode === l.id,
          // Pass-through nodes are not selectable via normal RF interaction
          selectable: !isPassThrough,
          focusable: !isPassThrough,
          // Phase 8.5c: Disable dragging while in crop mode for this node
          draggable: !l.locked && cropModeLayoutId !== l.id,
          // Very low zIndex: renders behind all process objects
          // Layout nodes render BEHIND process nodes via DOM order (allNodes = [...layoutNodes, ...nodes])
          // Do NOT use negative zIndex: it hides nodes behind the ReactFlow pane layer
          zIndex: 0,
          // Prevent connections from being created to/from layout nodes
          connectable: false,
          // ReactFlow needs explicit width/height for NodeResizer to work correctly
          width: l.width,
          height: l.height,
          // pointerEvents: 'none' lets mousedown pass through to the pane (box selection)
          style: isPassThrough ? { pointerEvents: 'none' as const } : undefined,
        };
      });
  }, [layouts, selectedNode, cropModeLayoutId]);

  // State for context menu (Phase 7.5)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId: string } | null>(null);

  // State for edge/connection context menu
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string; connectionType: string } | null>(null);

  // Tool store - State value
  const activeTool = useToolStore((state) => state.activeTool);
  const connectionSource = useToolStore((state) => state.connectionSource);

  // Tool store - Function refs with useShallow
  const { setGhostPosition, clearConnectionSource, clearSelection, setSelectTool, setPasteTool } = useToolStore(
    useShallow((state) => ({
      setGhostPosition: state.setGhostPosition,
      clearConnectionSource: state.clearConnectionSource,
      clearSelection: state.clearSelection,
      setSelectTool: state.setSelectTool,
      setPasteTool: state.setPasteTool,
    }))
  );

  // Shape catalog store - Function refs with useShallow
  const { loadCatalog, getShapeById } = useShapeCatalogStore(
    useShallow((state) => ({
      loadCatalog: state.loadCatalog,
      getShapeById: state.getShapeById,
    }))
  );

  // Canvas object store - State value
  const connections = useCanvasObjectStore((state) => state.connections);

  // Canvas object store - Function refs with useShallow
  const { createObject, addObject, loadConnectionsForPlant } = useCanvasObjectStore(
    useShallow((state) => ({
      createObject: state.createObject,
      addObject: state.addObject,
      loadConnectionsForPlant: state.loadConnectionsForPlant,
    }))
  );

  // Bug 1 Fix: Analysis store - refreshData to update status bar counts
  const refreshData = useAnalysisStore((state) => state.refreshData);

  // Clipboard store - State value
  const copiedObject = useClipboardStore((state) => state.copiedObject);

  // Clipboard store - Function ref with useShallow
  const { copyObject } = useClipboardStore(
    useShallow((state) => ({
      copyObject: state.copyObject,
    }))
  );

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

  // Phase 8.5: Merge layout nodes (background) with process nodes (foreground)
  // Layout nodes use lower zIndex so they render BEHIND process objects
  const allNodes = useMemo(() => {
    return [...layoutNodes, ...nodes];
  }, [layoutNodes, nodes]);

  // Load lines for current plant
  const { isLoading, isEmpty } = useLoadLines();

  // FitView on initial load (when nodes first appear)
  // Using the function instead of the prop prevents interference with selection state
  useEffect(() => {
    if (!isLoading && nodes.length > 0) {
      // Delay fitView to ensure nodes are fully rendered with dimensions
      const timeoutId = setTimeout(() => {
        fitView({
          padding: 0.1,
          duration: 300,
          includeHiddenNodes: true,
          minZoom: ABSOLUTE_MIN_ZOOM,
          maxZoom: 1.5,
        });
      }, 50);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isLoading, fitView]);
  // NOTE: Only depends on isLoading, NOT nodes.length
  // This ensures fitView runs once when data loads, not on every node update

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

      // Escape key - exit crop mode if active, otherwise clear selection (AutoCAD-style)
      if (event.key === 'Escape') {
        event.preventDefault();
        // Phase 8.5c: If crop mode is active, exit it (keep layout selected)
        if (useLayoutStore.getState().cropModeLayoutId !== null) {
          useLayoutStore.getState().setCropMode(null);
          return;
        }
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
        // CRITICAL FIX: Get selection directly from ReactFlow (source of truth)
        // This bypasses async callback sync issues with useToolStore/useCanvasStore
        const reactFlowNodes = getNodes();
        console.log('[Delete] Total nodes:', reactFlowNodes.length);
        console.log('[Delete] Nodes with selected=true:', reactFlowNodes.filter(n => n.selected).length);
        console.log('[Delete] Node details:', reactFlowNodes.map(n => ({ id: n.id, selected: n.selected, selectable: n.selectable })));

        const selectedNodes = reactFlowNodes.filter((node) => node.selected);
        const allSelectedIds = selectedNodes.map((node) => node.id);

        if (allSelectedIds.length === 0) {
          return; // Early return if nothing selected
        }

        event.preventDefault();

        // Phase 8.5: Separate layout node IDs from canvas object IDs
        // Layout nodes live in useLayoutStore and use LAYOUT_CHANNELS.DELETE
        const layoutIds = new Set(useLayoutStore.getState().layouts.map((l) => l.id));
        const layoutsToDelete = allSelectedIds.filter((id) => layoutIds.has(id));
        const objectsToDelete = allSelectedIds.filter((id) => !layoutIds.has(id));

        console.log('[Delete] layouts:', layoutsToDelete.length, 'canvas objects:', objectsToDelete.length);

        // BATCH DELETE stores atomically (single React render cycle)
        if (objectsToDelete.length > 0) {
          useCanvasStore.setState(state => ({
            nodes: state.nodes.filter(n => !objectsToDelete.includes(n.id)),
            selectedNode: objectsToDelete.includes(state.selectedNode || '') ? null : state.selectedNode,
          }));
          useCanvasObjectStore.setState(state => ({
            objects: state.objects.filter(obj => !objectsToDelete.includes(obj.id)),
          }));
        }

        if (layoutsToDelete.length > 0) {
          useLayoutStore.setState(state => ({
            layouts: state.layouts.filter(l => !layoutsToDelete.includes(l.id)),
          }));
          // Clear selectedNode if a layout was the active selection
          const currentSelected = useCanvasStore.getState().selectedNode;
          if (currentSelected && layoutsToDelete.includes(currentSelected)) {
            useCanvasStore.getState().setSelectedNode(null);
          }
        }

        console.log('[Delete] UI updated, now persisting to backend...');

        // BACKEND DELETES: Route each ID to the correct channel
        const deleteResults = await Promise.all([
          ...objectsToDelete.map(id =>
            window.electronAPI
              .invoke(CANVAS_OBJECT_CHANNELS.DELETE, id)
              .then(result => ({ id, success: result.success, error: null }))
              .catch(error => ({ id, success: false, error: error.message }))
          ),
          ...layoutsToDelete.map(id =>
            window.electronAPI
              .invoke(LAYOUT_CHANNELS.DELETE, id)
              .then(result => ({ id, success: result.success, error: null }))
              .catch(error => ({ id, success: false, error: error.message }))
          ),
        ]);

        // Check for failures
        const failures = deleteResults.filter(r => !r.success);
        if (failures.length > 0) {
          console.error('[Delete] Some deletions failed:', failures);
          alert(`Failed to delete ${failures.length} object(s). Check console for details.`);
        }

        console.log('[Delete] All deletions completed successfully');

        // Bug 1 Fix: Refresh status bar counts after deleting objects
        if (objectsToDelete.length > 0) {
          refreshData().catch(err => console.error('[Delete] Failed to refresh status bar:', err));
        }

        // Clear selection after deletion
        useToolStore.getState().clearSelection();
        useCanvasStore.getState().setSelectedNode(null);
      }
    };

    // Add event listener to document for keyboard events
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [getNodes]); // IMPORTANT: Only stable ref here. DO NOT add 'nodes' - it causes infinite re-execution loop because nodes array reference changes on every position/selection update, creating race conditions where Delete key has no handler attached

  // Duplicate immediately (Ctrl+D)
  const handleDuplicateImmediate = useCallback(async (objectId: string) => {
    try {
      const response = await window.electronAPI.invoke<CanvasObjectWithDetails>(
        CANVAS_OBJECT_CHANNELS.DUPLICATE,
        { sourceObjectId: objectId, offset: { x: 20, y: 20 } }
      );

      if (response.success && response.data) {
        const newObjectWithDetails = response.data;

        // Add to canvas - Phase 7.6: Use objectId reference only
        addNode({
          id: newObjectWithDetails.id,
          type: 'genericShape',
          position: { x: newObjectWithDetails.xPosition, y: newObjectWithDetails.yPosition },
          data: { objectId: newObjectWithDetails.id },  // Phase 7.6: Reference only
          selectable: true, // Enable ReactFlow selection
          draggable: true,  // Enable dragging
        });

        // Add to store
        addObject(newObjectWithDetails);

        console.log('[Duplicate] Created:', newObjectWithDetails.name);

        // Bug 1 Fix: Refresh status bar counts after duplicating object
        refreshData().catch(err => console.error('[Duplicate] Failed to refresh status bar:', err));
      }
    } catch (error) {
      console.error('[Duplicate] Error:', error);
    }
  }, [addNode, addObject, getShapeById, refreshData]);

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
      // STANDARD PATTERN: Read current nodes from store to avoid stale closure
      const currentNodes = useCanvasStore.getState().nodes;
      const updatedNodes = applyNodeChanges(changes, currentNodes);
      setNodes(updatedNodes);

      // Phase 8.5: Layout nodes live in useLayoutStore (not useCanvasStore.nodes).
      // We must handle their position changes separately and optimistically so drag works.
      const currentLayouts = useLayoutStore.getState().layouts;
      const layoutNodeIds = new Set(currentLayouts.map((l) => l.id));

      changes.forEach((change) => {
        if (change.type === 'position' && change.id && change.position) {
          const isLayoutNode = layoutNodeIds.has(change.id);

          if (isLayoutNode) {
            // Optimistic in-memory update so layoutNodes memo recomputes on EVERY drag tick.
            // This keeps the node following the cursor (equivalent to applyNodeChanges for useCanvasStore).
            useLayoutStore.setState((state) => ({
              layouts: state.layouts.map((l) =>
                l.id === change.id
                  ? { ...l, xPosition: change.position!.x, yPosition: change.position!.y }
                  : l
              ),
            }));

            // Persist to DB only on drag end (dragging === false or undefined)
            if (!change.dragging) {
              updateLayoutStore(change.id, {
                xPosition: change.position.x,
                yPosition: change.position.y,
              });
            }
          } else if (!change.dragging) {
            // Process/generic canvas object: persist via existing mechanism (drag end only)
            const updatedNode = updatedNodes.find(n => n.id === change.id);
            if (updatedNode) {
              updateNodePosition(change.id, updatedNode.position.x, updatedNode.position.y);

              window.electronAPI
                .invoke(CANVAS_OBJECT_CHANNELS.UPDATE_POSITION, change.id, updatedNode.position.x, updatedNode.position.y)
                .catch((error) => {
                  console.error('[ProductionCanvas] Error updating object position:', error);
                });
            }
          }
        }
      });
    },
    [setNodes, updateNodePosition, updateLayoutStore]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // STANDARD PATTERN: Read current edges from store to avoid stale closure
      const currentEdges = useCanvasStore.getState().edges;
      const updatedEdges = applyEdgeChanges(changes, currentEdges);
      setEdges(updatedEdges);
    },
    [setEdges] // Stable Zustand ref only - NO `edges` (prevents ReactFlow effect remount)
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
      console.log('[onNodeClick] Clicked node:', node.id, 'selectable:', node.selectable);
      // Phase 8.5c: Exit crop mode if user clicks a different node
      const currentCropId = useLayoutStore.getState().cropModeLayoutId;
      if (currentCropId !== null && currentCropId !== node.id) {
        useLayoutStore.getState().setCropMode(null);
      }
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  // Sync ReactFlow's multi-selection to useToolStore
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      console.log('[onSelectionChange] Selection changed:', selectedNodes.length, 'nodes selected');
      console.log('[onSelectionChange] Selected IDs:', selectedNodes.map(n => n.id));

      // Add stack trace to see what triggered this
      if (selectedNodes.length === 0) {
        console.log('[onSelectionChange] ⚠️ Selection cleared! Stack trace:');
        console.trace();
      }

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

    // CRITICAL FIX: Only clear selection if clicking on the actual pane, not on nodes
    // Without this check, clicking on nodes clears selection due to event bubbling
    const target = event.target as HTMLElement;
    const isClickOnPane = target.classList.contains('react-flow__pane');

    if (isClickOnPane) {
      // Phase 8.5c: Exit crop mode on pane click (keep layout selected)
      if (useLayoutStore.getState().cropModeLayoutId !== null) {
        useLayoutStore.getState().setCropMode(null);
        // Do NOT clear selectedNode — keep the layout selected so panel stays open
      }

      // When a locked layout image has pointerEvents: none, clicks on it pass through
      // to the pane. Use position-based hit detection to select it instead of clearing.
      // Only applies in default select mode — paste/place/connect modes behave as before.
      if (!isPasteTool(activeTool) && !isPlaceTool(activeTool) && !isConnectMode) {
        const clickPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const lockedLayouts = useLayoutStore.getState().layouts.filter((l) => l.active && l.locked);
        const clickedLayout = lockedLayouts.find(
          (l) =>
            clickPosition.x >= l.xPosition &&
            clickPosition.x <= l.xPosition + l.width &&
            clickPosition.y >= l.yPosition &&
            clickPosition.y <= l.yPosition + l.height
        );
        if (clickedLayout) {
          // Select the locked layout — do NOT clear selection, but still close context menus below
          setSelectedNode(clickedLayout.id);
        } else {
          setSelectedNode(null);
          clearSelection();
        }
      } else {
        setSelectedNode(null);
        clearSelection();
      }
    }

    // Context menus should always close on any click
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

        // Add to canvas - Phase 7.6: Use objectId reference only
        addNode({
          id: newObjectWithDetails.id,
          type: 'genericShape',
          position: { x: newObjectWithDetails.xPosition, y: newObjectWithDetails.yPosition },
          data: { objectId: newObjectWithDetails.id },  // Phase 7.6: Reference only
          selectable: true, // Enable ReactFlow selection
          draggable: true,  // Enable dragging
        });

        // Add to store
        addObject(newObjectWithDetails);

        console.log('[Paste] Object pasted:', newObjectWithDetails.name);

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

        // Add the new node directly to the canvas - Phase 7.6: Use objectId reference only
        addNode({
          id: newObjectId,
          type: 'genericShape',
          position: { x: xPos, y: yPos },
          data: { objectId: newObjectId },  // Phase 7.6: Reference only
          selectable: true, // Enable ReactFlow selection
          draggable: true,  // Enable dragging
        });

        // Also add to useCanvasObjectStore so ContextMenu can find it
        addObject(objectData);

        console.log('[Placement] Object successfully added to canvas');

        // Bug 1 Fix: Refresh status bar counts after creating object
        refreshData().catch(err => console.error('[Placement] Failed to refresh status bar:', err));

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
  }, [setSelectedNode, clearSelection, activeTool, copiedObject, getShapeById, createObject, currentPlantId, screenToFlowPosition, addNode, addObject, isConnectMode, connectionSource, clearConnectionSource, refreshData]);

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
        <CanvasToolbar
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => {
            const newValue = !showMiniMap;
            setShowMiniMap(newValue);
            saveMinimapVisible(newValue);
          }}
        />

        {/* Object Palette - Phase 7.5 */}
        <ObjectPalette />

        <ReactFlow
          nodes={allNodes}
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
          // CRITICAL: Disable ReactFlow's internal delete key handler.
          // ReactFlow's handler updates its internal Zustand store synchronously BEFORE
          // the event bubbles to document. When our custom handleKeyDown fires, getNodes()
          // already returns empty selection (node already removed from RF internal state).
          // Result: objects[] never gets updated → object reappears from cache-hit rebuild.
          // Our custom handleKeyDown (document listener) handles delete correctly for both stores.
          deleteKeyCode={null}
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

        </ReactFlow>

        {/* Draggable MiniMap — outside ReactFlow, inside ReactFlowProvider so store context is available */}
        {showMiniMap && (
          <DraggableMiniMap
            onClose={() => {
              setShowMiniMap(false);
              saveMinimapVisible(false);
            }}
          />
        )}

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

// CRITICAL FIX: Memoize CanvasInner to prevent unnecessary remounts
// This prevents parent re-renders from destroying and recreating the component
// (React.memo is standard React optimization - documented at https://react.dev/reference/react/memo)
const CanvasInnerMemoized = React.memo(CanvasInner);

// Export wrapped with ReactFlowProvider so child components can use useReactFlow()
export const ProductionCanvas = () => {
  return (
    <ReactFlowProvider>
      <CanvasInnerMemoized />
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
