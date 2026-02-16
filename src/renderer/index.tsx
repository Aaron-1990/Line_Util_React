// ============================================
// RENDERER ENTRY POINT
// React Application
// ============================================

import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './styles/globals.css';

// ============================================
// CRITICAL: DO NOT MODIFY THIS SECTION
// Bug 5 Fix (2025-02-15): Prevents deleted canvas objects from reappearing after Mac sleep/wake
// Documentation: docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md
//
// PREVENT VITE PAGE RELOAD ON MAC SLEEP/WAKE
// Bug 5: Vite's HMR WebSocket disconnects during sleep.
// On wake, Vite calls location.reload() which destroys
// all Zustand stores and breaks ReactFlow selection.
//
// Fix v3: Use beforeunload event to block the reload.
// - location.reload override (v2) fails: read-only in Chromium
// - beforeunload works: standard DOM event, Electron skips dialog
//
// WARNING: Removing this will cause:
// - Deleted objects reappear after Mac sleep/wake
// - User changes lost (stores destroyed)
// - See .claude/CLAUDE.md section "Mac Sleep/Wake & Store Persistence"
// ============================================
if ((import.meta as any).hot) {
  let blockNextReload = false;

  // Step 1: Detect WebSocket disconnect (fires SYNC before Vite's reload)
  (import.meta as any).hot.on('vite:ws:disconnect', () => {
    console.log('[HMR] WebSocket disconnected (likely Mac sleep) - will block next reload');
    blockNextReload = true;

    // Auto-expire flag after 10s (Vite's reload fires within 1-2s of wake)
    setTimeout(() => { blockNextReload = false; }, 10000);
  });

  // Step 2: Block the reload via beforeunload when flag is set
  window.addEventListener('beforeunload', (event) => {
    if (blockNextReload) {
      blockNextReload = false; // Consume flag (one-shot)
      event.preventDefault();
      event.returnValue = ''; // Required for Chromium compatibility
      console.log('[HMR] Blocked page reload after sleep/wake - app state preserved');
    }
  });
}

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
