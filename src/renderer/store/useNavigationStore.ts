// ============================================
// NAVIGATION STORE - Zustand
// State management for app navigation and sidebar
// Phase 7: Added plant context for multi-plant support
// ============================================

import { create } from 'zustand';

// ===== Types =====

export type AppView = 'canvas' | 'models' | 'routings' | 'areas' | 'plants' | 'global-analysis' | 'preferences';

// Storage key for persisted plant selection
const PLANT_STORAGE_KEY = 'lineOptimizer_currentPlantId';

interface NavigationState {
  // Current view
  currentView: AppView;

  // Sidebar state
  sidebarCollapsed: boolean;

  // Phase 7: Plant context
  currentPlantId: string | null;

  // Actions - View Navigation
  setView: (view: AppView) => void;

  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Actions - Plant Context (Phase 7)
  setCurrentPlant: (plantId: string | null) => void;
  initializePlantFromStorage: () => void;
  clearPersistedPlantId: () => void;
}

// ===== Helper Functions =====

/**
 * Load persisted plant selection from localStorage
 */
function loadPersistedPlantId(): string | null {
  try {
    const stored = localStorage.getItem(PLANT_STORAGE_KEY);
    return stored || null;
  } catch {
    console.warn('[NavigationStore] Failed to load plant from localStorage');
    return null;
  }
}

/**
 * Persist plant selection to localStorage
 */
function persistPlantId(plantId: string | null): void {
  try {
    if (plantId) {
      localStorage.setItem(PLANT_STORAGE_KEY, plantId);
    } else {
      localStorage.removeItem(PLANT_STORAGE_KEY);
    }
  } catch {
    console.warn('[NavigationStore] Failed to persist plant to localStorage');
  }
}

// ===== Store =====

export const useNavigationStore = create<NavigationState>((set) => ({
  // Initial State
  currentView: 'canvas',
  sidebarCollapsed: false,
  currentPlantId: null, // Will be initialized from storage or default plant

  // ===== View Navigation Actions =====

  setView: (view) => set({ currentView: view }),

  // ===== Sidebar Actions =====

  toggleSidebar: () => set((state) => ({
    sidebarCollapsed: !state.sidebarCollapsed
  })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // ===== Plant Context Actions (Phase 7) =====

  setCurrentPlant: (plantId) => {
    persistPlantId(plantId);
    set({ currentPlantId: plantId });
  },

  initializePlantFromStorage: () => {
    const stored = loadPersistedPlantId();
    if (stored) {
      set({ currentPlantId: stored });
    }
  },

  /**
   * Clear persisted plant ID from localStorage.
   * Called when switching database instances (project open, new, save as).
   * This ensures the plant ID is not stale when a new database is loaded.
   */
  clearPersistedPlantId: () => {
    try {
      localStorage.removeItem(PLANT_STORAGE_KEY);
      set({ currentPlantId: null });
      console.log('[NavigationStore] Cleared persisted plant ID');
    } catch (error) {
      console.warn('[NavigationStore] Failed to clear plant from localStorage:', error);
    }
  },
}));
