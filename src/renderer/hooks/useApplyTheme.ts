// ============================================
// USE APPLY THEME HOOK
// Applies theme class to HTML element based on store state
// Handles system preference detection and changes
// ============================================

import { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';

/**
 * Hook that applies the current theme to the document.
 * - Adds/removes 'dark' class on <html> element
 * - Handles 'system' theme by watching OS preference
 * - Cleans up listeners on unmount
 */
export const useApplyTheme = () => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    // Function to apply the resolved theme
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // Handle system theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // Apply initial system preference
      applyTheme(mediaQuery.matches);

      // Listen for system theme changes
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    // Handle explicit light/dark theme
    applyTheme(theme === 'dark');

    // No cleanup needed for explicit themes
    return undefined;
  }, [theme]);
};
