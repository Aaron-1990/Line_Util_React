// ============================================
// USE WINDOW TITLE HOOK
// Syncs native window title + macOS indicators
// (grey dot in close button, proxy icon) with
// project save/unsaved state.
// ============================================

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../store/useProjectStore';
import { WINDOW_CHANNELS } from '@shared/constants';

/**
 * Derives the display name for the current project.
 * - Untitled → "Untitled Project"
 * - Saved    → basename of file path (e.g. "MyFactory.lop")
 */
function deriveProjectLabel(
  projectType: string,
  projectFilePath: string | null,
  projectName: string | null | undefined
): string {
  if (projectType === 'saved' && projectFilePath) {
    // Extract basename without full Node.js path (renderer context)
    const parts = projectFilePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] ?? 'Untitled Project';
  }
  return projectName || 'Untitled Project';
}

/**
 * Hook that keeps the native Electron window title and macOS
 * document-edited indicator in sync with the project store.
 *
 * Mounts once in AppLayout; no cleanup needed (IPC is fire-and-forget).
 */
export const useWindowTitle = () => {
  const { projectType, hasUnsavedChanges, projectFilePath, projectName } =
    useProjectStore(
      useShallow((s) => ({
        projectType: s.projectType,
        hasUnsavedChanges: s.hasUnsavedChanges,
        projectFilePath: s.projectFilePath,
        projectName: s.projectInfo?.metadata.projectName,
      }))
    );

  useEffect(() => {
    const label = deriveProjectLabel(projectType, projectFilePath, projectName);
    const prefix = hasUnsavedChanges ? '* ' : '';
    const title = `${prefix}${label} - Line Optimizer`;

    window.electronAPI.invoke(WINDOW_CHANNELS.UPDATE_WINDOW_TITLE, title, hasUnsavedChanges, projectFilePath ?? '');
  }, [projectType, hasUnsavedChanges, projectFilePath, projectName]);
};
