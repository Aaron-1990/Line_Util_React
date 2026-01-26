// ============================================
// WINDOW HANDLER
// Manages opening timeline in separate window
// ============================================

import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { WINDOW_CHANNELS } from '../../../shared/constants';
import { OptimizationResult } from '../../../shared/types';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Store for timeline window and cached data
let timelineWindow: BrowserWindow | null = null;
let cachedTimelineData: {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
} | null = null;

export function registerWindowHandlers(): void {
  console.log('Registering Window handlers...');

  // Open timeline window
  ipcMain.handle(WINDOW_CHANNELS.OPEN_TIMELINE_WINDOW, async (_event, data: {
    results: OptimizationResult;
    areaSequences: { code: string; sequence: number }[];
  }) => {
    try {
      // Cache the data so timeline window can request it
      cachedTimelineData = data;

      // If window exists and not destroyed, focus it
      if (timelineWindow && !timelineWindow.isDestroyed()) {
        timelineWindow.focus();
        // Send updated data to existing window
        timelineWindow.webContents.send('timeline-data-updated', data);
        return { success: true, data: { action: 'focused' } };
      }

      // Create new timeline window
      timelineWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
        title: 'Multi-Year Capacity Analysis - Line Optimizer',
        backgroundColor: '#f9fafb',
        show: false,
      });

      // Show when ready
      timelineWindow.once('ready-to-show', () => {
        timelineWindow?.show();
      });

      // Load the same renderer but with a hash route
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        timelineWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/timeline-window`);
      } else {
        timelineWindow.loadFile(
          path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
          { hash: '/timeline-window' }
        );
      }

      // Cleanup on close
      timelineWindow.on('closed', () => {
        timelineWindow = null;
        cachedTimelineData = null;
      });

      return { success: true, data: { action: 'opened' } };
    } catch (error) {
      console.error('Error opening timeline window:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open timeline window',
      };
    }
  });

  // Get cached timeline data (called by timeline window on load)
  ipcMain.handle(WINDOW_CHANNELS.GET_TIMELINE_DATA, async () => {
    if (!cachedTimelineData) {
      return {
        success: false,
        error: 'No timeline data available',
      };
    }
    return {
      success: true,
      data: cachedTimelineData,
    };
  });

  // Close timeline window
  ipcMain.handle(WINDOW_CHANNELS.CLOSE_TIMELINE_WINDOW, async () => {
    if (timelineWindow && !timelineWindow.isDestroyed()) {
      timelineWindow.close();
      return { success: true };
    }
    return { success: true, data: { message: 'Window already closed' } };
  });

  console.log('Window handlers registered');
}
