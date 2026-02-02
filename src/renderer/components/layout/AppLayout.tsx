// ============================================
// APP LAYOUT COMPONENT
// Main application layout with sidebar and content area
// Phase 7: Added plant initialization
// ============================================

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useApplyTheme } from '../../hooks/useApplyTheme';
import { usePlantStore } from '../../features/plants';
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

  // Apply theme to document
  useApplyTheme();

  // Initialize plant store on app startup
  useEffect(() => {
    if (!plantsInitialized) {
      initializePlants();
    }
  }, [initializePlants, plantsInitialized]);

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
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden" role="main">
        {renderView()}
      </main>
    </div>
  );
};
