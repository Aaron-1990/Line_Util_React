import { useEffect } from 'react';
import { useProjectStore } from '@renderer/store/useProjectStore';

/**
 * Hook to handle global keyboard shortcuts for project operations.
 * Ctrl+N: New Project
 * Ctrl+O: Open Project
 * Ctrl+S: Save Project
 * Ctrl+Shift+S: Save Project As
 */
export function useKeyboardShortcuts() {
  const { newProject, openProject, saveProject, saveProjectAs } = useProjectStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N: New Project
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        newProject();
      }

      // Ctrl+O: Open Project
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        openProject();
      }

      // Ctrl+S: Save Project
      if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveProject();
      }

      // Ctrl+Shift+S: Save Project As
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveProjectAs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [newProject, openProject, saveProject, saveProjectAs]);
}
