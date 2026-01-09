// ============================================
// ROUTER CONFIGURATION
// React Router setup
// ============================================

import { createHashRouter, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { CanvasPage } from '../pages/CanvasPage';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Router principal de la aplicacion
 * 
 * Usa HashRouter para compatibilidad con Electron
 * (file:// protocol no soporta BrowserRouter)
 */
export const router = createHashRouter([
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
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
