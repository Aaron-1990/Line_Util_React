// ============================================
// ROUTER CONFIGURATION
// React Router setup
// ============================================

import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout';
import { ExcelImportPage } from '../pages/ExcelImportPage';
import { TimelineWindowPage } from '../pages/TimelineWindowPage';

/**
 * Router principal de la aplicacion
 *
 * Usa HashRouter para compatibilidad con Electron
 * (file:// protocol no soporta BrowserRouter)
 */
export const router = createHashRouter(
  [
    {
      // Main app layout with sidebar navigation
      path: '/',
      element: <AppLayout />,
    },
    {
      // Excel import wizard (separate from main layout)
      path: '/excel/import',
      element: <ExcelImportPage />,
    },
    {
      // Standalone timeline window - opens in separate Electron window
      path: '/timeline-window',
      element: <TimelineWindowPage />,
    },
    {
      // Redirect all unknown routes to home
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);
