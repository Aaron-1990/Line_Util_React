// ============================================
// RENDERER ENTRY POINT
// React Application
// ============================================

import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  // TEMPORARY FIX: StrictMode disabled to prevent ReactFlow selection clearing
  // StrictMode's double-invoke of effects causes ReactFlow to clear selection
  // See: docs/fixes/three-critical-bugs-found.md - Bug #7
  // NOTE: React import removed since StrictMode is disabled
  // If re-enabling StrictMode, add: import React from 'react';
  // <React.StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  // </React.StrictMode>
);
