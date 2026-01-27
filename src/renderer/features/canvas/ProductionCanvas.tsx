// ============================================
// PRODUCTION CANVAS
// Componente principal del canvas con ReactFlow
// ============================================

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useCanvasStore } from './store/useCanvasStore';
import { useLoadLines } from './hooks/useLoadLines';
import { ProductionLineNode } from './components/nodes/ProductionLineNode';
import { CanvasToolbar } from './components/toolbar/CanvasToolbar';
import { LinePropertiesPanel } from './components/panels/LinePropertiesPanel';
import { AnalysisControlBar, useAnalysisStore } from '../analysis';
import { ChangeoverMatrixModal } from '../changeover';
import { TIMELINE_EVENTS, WINDOW_CHANNELS } from '@shared/constants';
import { ExternalLink, CheckCircle } from 'lucide-react';

const nodeTypes = {
  productionLine: ProductionLineNode,
};

export const ProductionCanvas = () => {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    updateNodePosition,
    setSelectedNode,
  } = useCanvasStore();

  useLoadLines();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);

      changes.forEach((change) => {
        if (change.type === 'position' && !change.dragging && change.id) {
          const updatedNode = updatedNodes.find(n => n.id === change.id);
          
          if (updatedNode) {
            updateNodePosition(change.id, updatedNode.position.x, updatedNode.position.y);

            window.electronAPI
              .invoke('lines:update-position', change.id, updatedNode.position.x, updatedNode.position.y)
              .catch((error) => {
                console.error('[ProductionCanvas] Error updating line position:', error);
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
    (connection: Connection) => {
      const updatedEdges = addEdge(connection, edges);
      setEdges(updatedEdges);
    },
    [edges, setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      <CanvasToolbar />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        className="bg-gray-50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d1d5db"
        />

        <Controls
          position="bottom-left"
          showInteractive={false}
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
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
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
        />
      </ReactFlow>

      <LinePropertiesPanel />

      {/* Analysis Control Bar - Fixed at bottom */}
      <AnalysisControlBar />

      {/* Status Badge - Shows when results are available in Timeline Window */}
      <TimelineStatusBadge />

      {/* Changeover Matrix Modal */}
      <ChangeoverMatrixModal />
    </div>
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
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-gray-700">
            Analysis Complete
          </span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <button
          onClick={handleFocusTimeline}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          {isTimelineOpen ? 'Focus Timeline' : 'Open Timeline'}
        </button>
        <button
          onClick={resetAnalysis}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
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
