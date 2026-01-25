// ============================================
// PRODUCTION CANVAS
// Componente principal del canvas con ReactFlow
// ============================================

import { useCallback } from 'react';
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
import { AnalysisControlBar, ResultsPanel, useAnalysisStore } from '../analysis';

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

      {/* Results Panel - Modal when analysis is complete */}
      <ResultsPanelWrapper />
    </div>
  );
};

// Wrapper component to conditionally render ResultsPanel
const ResultsPanelWrapper = () => {
  const { results } = useAnalysisStore();

  if (!results) return null;

  return <ResultsPanel />;
};
