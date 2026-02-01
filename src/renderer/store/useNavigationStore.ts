// ============================================
// NAVIGATION STORE - Zustand
// State management for app navigation and sidebar
// ============================================

import { create } from 'zustand';

// ===== Types =====

export type AppView = 'canvas' | 'models' | 'routings' | 'areas' | 'preferences';

interface NavigationState {
  // Current view
  currentView: AppView;

  // Sidebar state
  sidebarCollapsed: boolean;

  // Actions - View Navigation
  setView: (view: AppView) => void;

  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

// ===== Store =====

export const useNavigationStore = create<NavigationState>((set) => ({
  // Initial State
  currentView: 'canvas',
  sidebarCollapsed: false,

  // ===== View Navigation Actions =====

  setView: (view) => set({ currentView: view }),

  // ===== Sidebar Actions =====

  toggleSidebar: () => set((state) => ({
    sidebarCollapsed: !state.sidebarCollapsed
  })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
