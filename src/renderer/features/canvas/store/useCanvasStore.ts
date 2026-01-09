// ============================================
// CANVAS STORE - Zustand
// State management para el canvas de produccion
// ============================================

import { create } from 'zustand';
import { Node, Edge } from 'reactflow';

interface CanvasState {
  // State
  nodes: Node[];
  edges: Edge[];
  selectedNode: string | null;
  
  // Actions - Nodes
  setNodes: (nodes: Node[]) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node['data']>) => void;
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

const initialState = {
  nodes: [],
  edges: [],
  selectedNode: null,
};

/**
 * Canvas Store
 * 
 * Maneja todo el estado del canvas:
 * - Nodes (lineas de produccion)
 * - Edges (conexiones)
 * - Seleccion actual
 */
export const useCanvasStore = create<CanvasState>((set) => ({
  ...initialState,

  // ===== Nodes =====
  
  setNodes: (nodes) => set({ nodes }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
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
