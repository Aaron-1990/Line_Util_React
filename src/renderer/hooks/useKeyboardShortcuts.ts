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
      // Support both Ctrl (Windows/Linux) and Cmd (macOS)
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd+N: New Project
      if (mod && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        newProject();
      }

      // Ctrl/Cmd+O: Open Project
      if (mod && !e.shiftKey && e.key === 'o') {
        e.preventDefault();
        openProject();
      }

      // Ctrl/Cmd+S: Save Project
      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveProject();
      }

      // Ctrl/Cmd+Shift+S: Save Project As
      if (mod && e.shiftKey && e.key === 's') {
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
