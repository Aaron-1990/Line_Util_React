// ============================================
// ROUTER CONFIGURATION
// React Router setup
// ============================================

import { createHashRouter, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { CanvasPage } from '../pages/CanvasPage';
import { DashboardPage } from '../pages/DashboardPage';
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
      path: '/',
      element: <HomePage />,
    },
    {
      path: '/canvas',
      element: <CanvasPage />,
    },
    {
      path: '/dashboard',
      element: <DashboardPage />,
    },
    {
      path: '/excel/import',
      element: <ExcelImportPage />,
    },
    {
      // Standalone timeline window - opens in separate Electron window
      path: '/timeline-window',
      element: <TimelineWindowPage />,
    },
    {
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
