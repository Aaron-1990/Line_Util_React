// ============================================
// APP LAYOUT COMPONENT
// Main application layout with sidebar and content area
// Phase 7: Added plant initialization
// ============================================

import { useEffect } from 'react';
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

// ===== Component =====

/**
 * Main application layout with collapsible sidebar and content area.
 * Switches between different views based on navigation store state.
 */
export const AppLayout = () => {
  const { currentView } = useNavigationStore();
  const { initialize: initializePlants, isInitialized: plantsInitialized } = usePlantStore();
  const { refreshProjectInfo } = useProjectStore();

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
