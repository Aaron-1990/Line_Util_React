// ============================================
// CANVAS STORE - Zustand
// State management para el canvas de produccion
// Phase 7.6: Single Source of Truth - nodes only contain objectId reference
// ============================================

import { create } from 'zustand';
import { Node, Edge } from 'reactflow';
import { CanvasNodeData } from '@shared/types';

interface CanvasState {
  // State - Phase 7.6: nodes only contain { objectId } reference
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  selectedNode: string | null;

  // Actions - Nodes
  setNodes: (nodes: Node<CanvasNodeData>[]) => void;
  addNode: (node: Node<CanvasNodeData>) => void;
  deleteNode: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;

  // Actions - Edges
  setEdges: (edges: Edge[]) => void;
  addEdge: (edge: Edge) => void;
  deleteEdge: (id: string) => void;

  // Actions - Selection
  setSelectedNode: (nodeId: string | null) => void;

  // Actions - Bulk
  reset: () => void;
}

const initialState: Pick<CanvasState, 'nodes' | 'edges' | 'selectedNode'> = {
  nodes: [],
  edges: [],
  selectedNode: null,
};

/**
 * Canvas Store
 *
 * Phase 7.6: Single Source of Truth
 * - Nodes contain only { objectId } reference
 * - Business data (name, area, processProperties, etc.) is in useCanvasObjectStore.objects[]
 * - GenericShapeNode retrieves data via Zustand selector
 */
export const useCanvasStore = create<CanvasState>((set) => ({
  ...initialState,

  // ===== Nodes =====

  setNodes: (nodes) => set({ nodes }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      selectedNode: state.selectedNode === id ? null : state.selectedNode,
    })),

  updateNodePosition: (id, x, y) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, position: { x, y } }
          : node
      ),
    })),

  // ===== Edges =====

  setEdges: (edges) => set({ edges }),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  deleteEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    })),

  // ===== Selection =====

  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),

  // ===== Bulk =====

  reset: () => set(initialState),
}));
