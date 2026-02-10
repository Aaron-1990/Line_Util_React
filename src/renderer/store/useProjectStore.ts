import { create } from 'zustand';
import { PROJECT_CHANNELS, PROJECT_EVENTS } from '@shared/constants';
import { ProjectState } from '@shared/types';

// ============================================
// Project Type for Untitled/Saved distinction
// ============================================
export type ProjectType = 'untitled' | 'saved';

interface ProjectStore {
  projectInfo: ProjectState | null;
  isProcessing: boolean;

  // NEW: Project state tracking (Phase: Untitled Project Workflow)
  projectType: ProjectType;
  projectFilePath: string | null;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;

  // Actions
  newProject: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  refreshProjectInfo: () => Promise<void>;

  // NEW: Actions for unsaved changes tracking
  markUnsavedChanges: () => void;
  clearUnsavedChanges: () => void;
  setProjectType: (type: ProjectType, filePath?: string) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectInfo: null,
  isProcessing: false,

  // NEW: Default to Untitled Project with no unsaved changes
  projectType: 'untitled',
  projectFilePath: null,
  hasUnsavedChanges: false,
  lastSavedAt: null,

  newProject: async () => {
    const state = get();
    if (state.isProcessing) {
      console.log('[ProjectStore] Already processing, ignoring duplicate call');
      return;
    }

    console.log('[ProjectStore] Creating new project...');
    set({ isProcessing: true });
    try {
      const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.NEW);

      console.log('[ProjectStore] New project response:', response);

      if (response.success) {
        console.log('[ProjectStore] Refreshing project info...');
        await get().refreshProjectInfo();
        console.log('[ProjectStore] New project created successfully');

        // Show success message
        alert('New project created successfully!\n\nProject name: Untitled Project');
      } else {
        console.error('[ProjectStore] New project failed:', response.error);
        alert(`Failed to create new project:\n\n${response.error || 'Unknown error'}`);
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  openProject: async () => {
    const state = get();
    if (state.isProcessing) {
      console.log('[ProjectStore] Already processing, ignoring duplicate call');
      return;
    }

    console.log('[ProjectStore] Opening project...');
    set({ isProcessing: true });
    try {
      const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.OPEN);

      console.log('[ProjectStore] Open project response:', response);

      if (response.success) {
        console.log('[ProjectStore] Refreshing project info after open...');
        await get().refreshProjectInfo();
        const info = get().projectInfo;
        console.log('[ProjectStore] Project opened, name:', info?.metadata.projectName);
      } else {
        console.error('[ProjectStore] Open project failed:', response.error);
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  saveProject: async () => {
    const state = get();
    if (state.isProcessing) return; // Prevent duplicate calls

    set({ isProcessing: true });
    try {
      const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.SAVE);

      if (response.success) {
        await get().refreshProjectInfo();
      } else {
        // Show error to user
        alert(`Failed to save project:\n\n${response.error || 'Unknown error'}`);
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  saveProjectAs: async () => {
    const state = get();
    if (state.isProcessing) {
      console.log('[ProjectStore] Already processing, ignoring duplicate call');
      return;
    }

    console.log('[ProjectStore] Saving project as...');
    set({ isProcessing: true });
    try {
      const response = await window.electronAPI.invoke<void>(PROJECT_CHANNELS.SAVE_AS);

      console.log('[ProjectStore] Save As response:', response);

      if (response.success) {
        console.log('[ProjectStore] Refreshing project info after save as...');
        await get().refreshProjectInfo();
        const info = get().projectInfo;
        console.log('[ProjectStore] Project saved as, name:', info?.metadata.projectName);
      } else {
        // Show error to user
        alert(`Failed to save project:\n\n${response.error || 'Unknown error'}`);
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  refreshProjectInfo: async () => {
    console.log('[ProjectStore] Fetching project info...');
    const response = await window.electronAPI.invoke<ProjectState>(PROJECT_CHANNELS.GET_INFO);

    console.log('[ProjectStore] Project info response:', response);

    if (response.success && response.data) {
      console.log('[ProjectStore] Setting projectInfo, name:', response.data.metadata.projectName);
      set({ projectInfo: response.data });
    } else {
      console.error('[ProjectStore] Failed to get project info:', response.error);
    }
  },

  // ============================================
  // NEW: Unsaved Changes Tracking Actions
  // ============================================

  /**
   * Mark that the project has unsaved changes.
   * Called by all data stores after mutations (create, update, delete).
   */
  markUnsavedChanges: () => {
    set({ hasUnsavedChanges: true });
  },

  /**
   * Clear the unsaved changes flag.
   * Called after successful save operations.
   */
  clearUnsavedChanges: () => {
    set({
      hasUnsavedChanges: false,
      lastSavedAt: new Date(),
    });
  },

  /**
   * Set the project type and optionally the file path.
   * Called when opening a .lop file or creating a new project.
   */
  setProjectType: (type: ProjectType, filePath?: string) => {
    set({
      projectType: type,
      projectFilePath: filePath || null,
      hasUnsavedChanges: false,
      lastSavedAt: type === 'saved' ? new Date() : null,
    });
  },
}));

// Listen for project events
// NOTE: PROJECT_OPENED and PROJECT_RESET are handled in AppLayout.tsx via refreshAllStores()
// to avoid duplicate event handling. Only listen to PROJECT_SAVED here.
if (window.electronAPI) {
  window.electronAPI.on(PROJECT_EVENTS.PROJECT_SAVED, () => {
    useProjectStore.getState().refreshProjectInfo();
    useProjectStore.getState().clearUnsavedChanges();
  });

  window.electronAPI.on(PROJECT_EVENTS.PROJECT_CLOSED, () => {
    useProjectStore.getState().refreshProjectInfo();
  });
}
