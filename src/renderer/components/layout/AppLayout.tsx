// ============================================
// APP LAYOUT COMPONENT
// Main application layout with sidebar and content area
// Phase 7: Added plant initialization
// Phase 8.1: Added Untitled Project Workflow listeners
// ============================================

import { useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { FileMenu } from './FileMenu';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useApplyTheme } from '../../hooks/useApplyTheme';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePlantStore } from '../../features/plants';
import { useProjectStore } from '../../store/useProjectStore';
import { ProductionCanvas } from '../../features/canvas';
import { ModelsPage } from '../../pages/ModelsPage';
import { RoutingsPage } from '../../pages/RoutingsPage';
import { AreasPage } from '../../pages/AreasPage';
import { PreferencesPage } from '../../pages/PreferencesPage';
import { PlantsPage } from '../../pages/PlantsPage';
import { GlobalAnalysisPage } from '../../pages/GlobalAnalysisPage';
import { PROJECT_CHANNELS, PROJECT_EVENTS } from '@shared/constants';
import { useModelStore } from '../../features/models';
import { useAreaStore } from '../../features/areas';
import { useAnalysisStore } from '../../features/analysis';
import { useChangeoverStore } from '../../features/changeover';
import { useRoutingStore } from '../../features/routings';
import { useCanvasStore } from '../../features/canvas';
import { useShapeCatalogStore } from '../../features/canvas/store/useShapeCatalogStore';

// ===== Helpers =====

/**
 * Refresh all stores after database instance change (e.g., opening a .lop file).
 * This is the proper alternative to window.location.reload() which has issues in Electron.
 */
async function refreshAllStores(): Promise<void> {
  console.log('[AppLayout] Refreshing all stores after database change...');

  try {
    // Refresh all stores in parallel for performance
    await Promise.all([
      useProjectStore.getState().refreshProjectInfo(),
      usePlantStore.getState().loadPlants(),
      useModelStore.getState().loadModels(),
      useAreaStore.getState().loadAreas(),
      useAnalysisStore.getState().refreshData(),
      useChangeoverStore.getState().loadFamilyDefaults(),
      useChangeoverStore.getState().loadGlobalSettings(),
      useRoutingStore.getState().loadData(),
      useCanvasStore.getState().refreshNodes(),
      useShapeCatalogStore.getState().refreshCatalog(),
    ]);

    // Refresh navigation store (synchronous - uses localStorage, not DB)
    useNavigationStore.getState().initializePlantFromStorage();

    console.log('[AppLayout] All stores refreshed successfully');
  } catch (error) {
    console.error('[AppLayout] Error refreshing stores:', error);
    throw error;
  }
}

// ===== Component =====

/**
 * Main application layout with collapsible sidebar and content area.
 * Switches between different views based on navigation store state.
 */
export const AppLayout = () => {
  const { currentView } = useNavigationStore();
  const { initialize: initializePlants, isInitialized: plantsInitialized } = usePlantStore();
  const {
    refreshProjectInfo,
    saveProjectAs,
    setProjectType,
    clearUnsavedChanges,
    projectType,
    hasUnsavedChanges,
    projectFilePath,
  } = useProjectStore();

  // Apply theme to document
  useApplyTheme();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize plant store on app startup
  useEffect(() => {
    if (!plantsInitialized) {
      initializePlants();
    }
  }, [initializePlants, plantsInitialized]);

  // Initialize project info on app startup
  useEffect(() => {
    refreshProjectInfo();
  }, [refreshProjectInfo]);

  // ============================================
  // BLOQUE 5: Save As Integration (Untitled Project Workflow)
  // ============================================

  /**
   * Handle Save As triggered from main process (during close with unsaved changes).
   * Calls existing Save As functionality, updates project state, and quits app on success.
   */
  const handleTriggerSaveAs = useCallback(async () => {
    console.log('[AppLayout] Triggered Save As from main process');

    try {
      // Get default global DB path BEFORE Save As (Save As will change active DB)
      const defaultDbPathResult = await window.electronAPI.invoke(PROJECT_CHANNELS.GET_DEFAULT_DB_PATH);
      const globalDbPath = defaultDbPathResult.data;
      console.log('[AppLayout] Global DB path:', globalDbPath);

      // Call existing Save As functionality via store
      // This will export current data to .lop and switch active DB
      await saveProjectAs();

      // Refresh project info to get updated state
      await refreshProjectInfo();

      // Get latest project state after save
      const storeState = useProjectStore.getState();

      // If save was successful (projectInfo shows a file path), update state and quit
      if (storeState.projectInfo?.currentFilePath) {
        console.log('[AppLayout] Save As successful, updating state and quitting');

        // Update project state to 'saved'
        setProjectType('saved', storeState.projectInfo.currentFilePath);
        clearUnsavedChanges();

        // Clear the global DB (not the .lop we just created)
        // This ensures next Untitled starts empty
        console.log('[AppLayout] Clearing global DB for next Untitled project');
        await window.electronAPI.invoke(PROJECT_CHANNELS.CLEAR_DATABASE_AT_PATH, globalDbPath);

        // Signal main process to quit (save completed successfully)
        await window.electronAPI.invoke(PROJECT_CHANNELS.QUIT_AFTER_SAVE);
      } else {
        console.log('[AppLayout] Save As was cancelled or failed');
        // User cancelled save dialog - stay in app
      }
    } catch (error) {
      console.error('[AppLayout] Save As failed:', error);
      // Error occurred - stay in app
    }
  }, [saveProjectAs, refreshProjectInfo, setProjectType, clearUnsavedChanges]);

  // ============================================
  // BLOQUE 8: Save As Then Open/New Integration
  // ============================================

  /**
   * Handle Save As then Open triggered from main process.
   * Saves current project, then opens the specified file.
   */
  const handleTriggerSaveAsThenOpen = useCallback(async (...args: unknown[]) => {
    const filePathToOpen = (args[0] as string | null) ?? null;
    console.log('[AppLayout] Triggered Save As then Open:', filePathToOpen);

    try {
      // Get default global DB path BEFORE Save As (Save As will change active DB)
      const defaultDbPathResult = await window.electronAPI.invoke(PROJECT_CHANNELS.GET_DEFAULT_DB_PATH);
      const globalDbPath = defaultDbPathResult.data;
      console.log('[AppLayout] Global DB path:', globalDbPath);

      // Save current Untitled project first
      // This will export current data to .lop and switch active DB
      await saveProjectAs();

      // Refresh project info to get updated state
      await refreshProjectInfo();

      // Get latest project state after save
      const storeState = useProjectStore.getState();

      // If save was successful, now open the requested file
      if (storeState.projectInfo?.currentFilePath) {
        console.log('[AppLayout] Save As successful, clearing global DB and opening file');

        // Clear the global DB (not the .lop we just created)
        // This ensures next Untitled starts empty
        await window.electronAPI.invoke(PROJECT_CHANNELS.CLEAR_DATABASE_AT_PATH, globalDbPath);

        // Open the requested file (will trigger file dialog if filePathToOpen is null)
        await window.electronAPI.invoke(PROJECT_CHANNELS.OPEN, filePathToOpen);
      } else {
        console.log('[AppLayout] Save As was cancelled - staying with current project');
      }
    } catch (error) {
      console.error('[AppLayout] Save As then Open failed:', error);
    }
  }, [saveProjectAs, refreshProjectInfo]);

  /**
   * Handle Save As then New triggered from main process.
   * Saves current project, then creates a new project.
   */
  const handleTriggerSaveAsThenNew = useCallback(async () => {
    console.log('[AppLayout] Triggered Save As then New');

    try {
      // Get default global DB path BEFORE Save As (Save As will change active DB)
      const defaultDbPathResult = await window.electronAPI.invoke(PROJECT_CHANNELS.GET_DEFAULT_DB_PATH);
      const globalDbPath = defaultDbPathResult.data;
      console.log('[AppLayout] Global DB path:', globalDbPath);

      // Save current project first
      // This will export current data to .lop and switch active DB
      await saveProjectAs();

      // Refresh project info to get updated state
      await refreshProjectInfo();

      // Get latest project state after save
      const storeState = useProjectStore.getState();

      // If save was successful, now create a new project
      if (storeState.projectInfo?.currentFilePath) {
        console.log('[AppLayout] Save As successful, clearing global DB and creating new project');

        // Clear the global DB (not the .lop we just created)
        // This ensures the new project starts empty
        await window.electronAPI.invoke(PROJECT_CHANNELS.CLEAR_DATABASE_AT_PATH, globalDbPath);

        // Create new project
        const newProjectResponse = await window.electronAPI.invoke(PROJECT_CHANNELS.NEW);

        // Show success message if new project created successfully
        if (newProjectResponse.success) {
          alert('New project created successfully!\n\nProject name: Untitled Project');
        }
      } else {
        console.log('[AppLayout] Save As was cancelled - staying with current project');
      }
    } catch (error) {
      console.error('[AppLayout] Save As then New failed:', error);
    }
  }, [saveProjectAs, refreshProjectInfo]);

  /**
   * Handle project opened event from main process.
   * Updates project state to 'saved' and reloads data from new database.
   */
  const handleProjectOpened = useCallback(async (...args: unknown[]) => {
    const data = args[0] as { projectType: 'saved'; filePath: string | null } | undefined;
    console.log('[AppLayout] Project opened:', data);

    try {
      // Update project state
      setProjectType('saved', data?.filePath || undefined);
      clearUnsavedChanges();

      // Refresh all stores to load data from new database
      await refreshAllStores();

      console.log('[AppLayout] Project opened successfully');
    } catch (error) {
      console.error('[AppLayout] Failed to refresh stores after project open:', error);
    }
  }, [setProjectType, clearUnsavedChanges]);

  /**
   * Handle project reset event from main process (File > New Project completed).
   * Resets project state to 'untitled' and reloads data from empty database.
   */
  const handleProjectReset = useCallback(async (..._args: unknown[]) => {
    // _args[0] would be { projectType: 'untitled'; filePath: null }, but we don't need to read it
    console.log('[AppLayout] Project reset to Untitled');

    try {
      // Update project state
      setProjectType('untitled', undefined);
      clearUnsavedChanges();

      // Refresh all stores to load data from empty database
      await refreshAllStores();

      console.log('[AppLayout] Project reset successfully');
    } catch (error) {
      console.error('[AppLayout] Failed to refresh stores after project reset:', error);
    }
  }, [setProjectType, clearUnsavedChanges]);

  /**
   * Respond to main process state query (during before-quit check).
   * Sends current project state back to main process.
   */
  const handleGetProjectStateRequest = useCallback(() => {
    console.log('[AppLayout] Main process requesting project state');

    // Send current state back to main process
    window.electronAPI.send(PROJECT_EVENTS.PROJECT_STATE_RESPONSE, {
      projectType,
      hasUnsavedChanges,
      projectFilePath,
    });
  }, [projectType, hasUnsavedChanges, projectFilePath]);

  // ============================================
  // IPC Event Listeners for Untitled Project Workflow
  // ============================================

  useEffect(() => {
    // Listen for Save As trigger from main process (close with unsaved changes)
    const unsubscribeSaveAs = window.electronAPI.on(
      PROJECT_EVENTS.TRIGGER_SAVE_AS,
      handleTriggerSaveAs
    );

    // Listen for project state query from main process
    const unsubscribeStateRequest = window.electronAPI.on(
      PROJECT_EVENTS.GET_PROJECT_STATE_REQUEST,
      handleGetProjectStateRequest
    );

    // ============================================
    // BLOQUE 8: New listeners for Open/New with unsaved changes
    // ============================================

    // Listen for Save As then Open trigger from main process
    const unsubscribeSaveAsThenOpen = window.electronAPI.on(
      PROJECT_EVENTS.TRIGGER_SAVE_AS_THEN_OPEN,
      handleTriggerSaveAsThenOpen
    );

    // Listen for Save As then New trigger from main process
    const unsubscribeSaveAsThenNew = window.electronAPI.on(
      PROJECT_EVENTS.TRIGGER_SAVE_AS_THEN_NEW,
      handleTriggerSaveAsThenNew
    );

    // Listen for project opened event (after opening .lop file)
    const unsubscribeProjectOpened = window.electronAPI.on(
      PROJECT_EVENTS.PROJECT_OPENED,
      handleProjectOpened
    );

    // Listen for project reset event (after File > New Project)
    const unsubscribeProjectReset = window.electronAPI.on(
      PROJECT_EVENTS.PROJECT_RESET,
      handleProjectReset
    );

    return () => {
      unsubscribeSaveAs?.();
      unsubscribeStateRequest?.();
      unsubscribeSaveAsThenOpen?.();
      unsubscribeSaveAsThenNew?.();
      unsubscribeProjectOpened?.();
      unsubscribeProjectReset?.();
    };
  }, [
    handleTriggerSaveAs,
    handleGetProjectStateRequest,
    handleTriggerSaveAsThenOpen,
    handleTriggerSaveAsThenNew,
    handleProjectOpened,
    handleProjectReset,
  ]);

  // Render view based on current selection with exhaustive type checking
  const renderView = () => {
    switch (currentView) {
      case 'canvas':
        return <ProductionCanvas />;
      case 'models':
        return <ModelsPage />;
      case 'routings':
        return <RoutingsPage />;
      case 'areas':
        return <AreasPage />;
      case 'plants':
        return <PlantsPage />;
      case 'global-analysis':
        return <GlobalAnalysisPage />;
      case 'preferences':
        return <PreferencesPage />;
      default: {
        // TypeScript exhaustiveness check - this should never be reached
        const _exhaustive: never = currentView;
        console.warn(`Unknown view: ${_exhaustive}`);
        return <ProductionCanvas />;
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* File Menu Bar */}
      <FileMenu />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden" role="main">
          {renderView()}
        </main>
      </div>
    </div>
  );
};
