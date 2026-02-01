// ============================================
// THEME STORE
// Manages theme preference with localStorage persistence
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ===== Types =====

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// ===== Store =====

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'line-optimizer-theme',
    }
  )
);
