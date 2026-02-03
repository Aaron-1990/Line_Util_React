// ============================================
// SHAPE CATALOG STORE - Zustand
// State management for shape catalog
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { create } from 'zustand';
import { ShapeDefinition, ShapeCategory } from '@shared/types/shape-catalog';
import { SHAPE_CATALOG_CHANNELS } from '@shared/constants';

// ============================================
// TYPES
// ============================================

interface ShapeCatalogStore {
  // State
  shapes: ShapeDefinition[];
  categories: ShapeCategory[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadShapes: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadCatalog: () => Promise<void>; // Alias for refreshCatalog
  getShapeById: (id: string) => ShapeDefinition | undefined;
  getShapesByCategory: (categoryId: string) => ShapeDefinition[];
  toggleFavorite: (shapeId: string) => Promise<void>;
  refreshCatalog: () => Promise<void>;

  // Helpers
  getFavorites: () => ShapeDefinition[];
  getBuiltInShapes: () => ShapeDefinition[];
}

// ============================================
// STORE
// ============================================

export const useShapeCatalogStore = create<ShapeCatalogStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  shapes: [],
  categories: [],
  isLoading: false,
  error: null,

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Load all shapes from database
   */
  loadShapes: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.invoke<ShapeDefinition[]>(
        SHAPE_CATALOG_CHANNELS.GET_ALL
      );

      if (response.success && response.data) {
        set({ shapes: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load shapes', isLoading: false });
      }
    } catch (error) {
      console.error('[ShapeCatalogStore] Error loading shapes:', error);
      set({ error: 'Failed to load shapes', isLoading: false });
    }
  },

  /**
   * Load all categories from database
   */
  loadCategories: async () => {
    // For now, we'll use hardcoded categories matching the migration
    // TODO: Implement GET_CATEGORIES channel if needed
    const defaultCategories: ShapeCategory[] = [
      { id: 'basic', name: 'Basic Shapes', displayOrder: 1, icon: 'Shapes' },
      { id: 'machines', name: 'Machines & Equipment', displayOrder: 2, icon: 'Cog' },
      { id: 'flow', name: 'Flow Control', displayOrder: 3, icon: 'GitBranch' },
      { id: 'custom', name: 'Custom', displayOrder: 99, icon: 'Sparkles' },
    ];

    set({ categories: defaultCategories });
  },

  /**
   * Get a specific shape by ID
   */
  getShapeById: (id: string) => {
    const { shapes } = get();
    return shapes.find((shape) => shape.id === id);
  },

  /**
   * Get shapes filtered by category
   */
  getShapesByCategory: (categoryId: string) => {
    const { shapes } = get();
    return shapes.filter((shape) => shape.categoryId === categoryId && shape.isActive);
  },

  /**
   * Toggle favorite status for a shape
   */
  toggleFavorite: async (shapeId: string) => {
    const { shapes } = get();
    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;

    const newFavoriteStatus = !shape.isFavorite;

    // Optimistic update
    set({
      shapes: shapes.map((s) =>
        s.id === shapeId ? { ...s, isFavorite: newFavoriteStatus } : s
      ),
    });

    try {
      await window.electronAPI.invoke(
        SHAPE_CATALOG_CHANNELS.UPDATE_FAVORITE,
        shapeId,
        newFavoriteStatus
      );
    } catch (error) {
      console.error('[ShapeCatalogStore] Error toggling favorite:', error);
      // Revert on error
      set({
        shapes: shapes.map((s) =>
          s.id === shapeId ? { ...s, isFavorite: !newFavoriteStatus } : s
        ),
      });
    }
  },

  /**
   * Refresh entire catalog
   */
  refreshCatalog: async () => {
    await Promise.all([get().loadShapes(), get().loadCategories()]);
  },

  /**
   * Load catalog (alias for refreshCatalog)
   */
  loadCatalog: async () => {
    await get().refreshCatalog();
  },

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Get all favorite shapes
   */
  getFavorites: () => {
    const { shapes } = get();
    return shapes.filter((shape) => shape.isFavorite && shape.isActive);
  },

  /**
   * Get all built-in shapes
   */
  getBuiltInShapes: () => {
    const { shapes } = get();
    return shapes.filter((shape) => shape.source === 'builtin' && shape.isActive);
  },
}));
