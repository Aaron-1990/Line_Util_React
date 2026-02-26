import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { FileIcon, FolderOpenIcon, SaveIcon, FileTextIcon, CheckCircle, ImageIcon } from 'lucide-react';
import { useProjectStore } from '@renderer/store/useProjectStore';
import { useNavigationStore } from '@renderer/store/useNavigationStore';
import { useLayoutStore } from '@renderer/features/canvas/store/useLayoutStore';

// Platform-aware shortcut hint: ⌘ on macOS, Ctrl+ elsewhere
const isMac = navigator.platform.toUpperCase().includes('MAC');
const mod = isMac ? '⌘' : 'Ctrl+';

/** Extracts the filename (basename) from an absolute path. */
function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

export const FileMenu = () => {
  const { newProject, openProject, saveProject, saveProjectAs } = useProjectStore();
  const { projectType, hasUnsavedChanges, projectFilePath, projectName } = useProjectStore(
    useShallow((s) => ({
      projectType: s.projectType,
      hasUnsavedChanges: s.hasUnsavedChanges,
      projectFilePath: s.projectFilePath,
      projectName: s.projectInfo?.metadata.projectName,
    }))
  );
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);
  const importLayout = useLayoutStore((state) => state.importLayout);

  const handleNew = useCallback(async () => {
    await newProject();
  }, [newProject]);

  const handleOpen = useCallback(async () => {
    await openProject();
  }, [openProject]);

  const handleSave = useCallback(async () => {
    await saveProject();
  }, [saveProject]);

  const handleSaveAs = useCallback(async () => {
    await saveProjectAs();
  }, [saveProjectAs]);

  const handleImportLayout = useCallback(async () => {
    if (!currentPlantId) return;
    await importLayout(currentPlantId);
  }, [currentPlantId, importLayout]);

  // Derive display label for the current project
  const displayLabel =
    projectType === 'saved' && projectFilePath
      ? basename(projectFilePath)
      : projectName ?? 'Untitled Project';

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
      {/* File Menu Dropdown */}
      <div className="relative group">
        <button className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded">
          File
        </button>

        <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="py-1">
            {/* New Project */}
            <button
              onClick={handleNew}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <FileTextIcon className="w-4 h-4" />
              <span>New Project</span>
              <span className="ml-auto text-xs text-gray-400">{mod}N</span>
            </button>

            {/* Open Project */}
            <button
              onClick={handleOpen}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <FolderOpenIcon className="w-4 h-4" />
              <span>Open Project...</span>
              <span className="ml-auto text-xs text-gray-400">{mod}O</span>
            </button>

            <div className="border-t border-gray-200 my-1" />

            {/* Save Project */}
            <button
              onClick={handleSave}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <SaveIcon className="w-4 h-4" />
              <span>Save Project</span>
              <span className="ml-auto text-xs text-gray-400">{mod}S</span>
            </button>

            {/* Save Project As */}
            <button
              onClick={handleSaveAs}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <FileIcon className="w-4 h-4" />
              <span>Save Project As...</span>
              <span className="ml-auto text-xs text-gray-400">{mod}⇧S</span>
            </button>

            {/* Phase 8.5: Import Layout Image */}
            {currentPlantId && (
              <>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={handleImportLayout}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Import Layout Image...</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Project Status Indicator */}
      <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
        <FileIcon className="w-4 h-4 text-gray-400" />
        <span className="font-medium">{displayLabel}</span>

        {hasUnsavedChanges ? (
          <span className="flex items-center gap-1 text-orange-600 font-medium">
            <span className="text-orange-500">•</span>
            Edited
          </span>
        ) : projectType === 'saved' ? (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Saved
          </span>
        ) : null}
      </div>
    </div>
  );
};
