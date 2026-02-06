// ============================================
// WINDOW HANDLER
// Manages opening timeline in separate window
// ============================================

import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { WINDOW_CHANNELS, TIMELINE_EVENTS, RESULTS_EVENTS } from '../../../shared/constants';
import { OptimizationResult } from '../../../shared/types';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// ===== Types =====
export interface TimelineWindowData {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
}

export interface ResultsWindowData {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
}

// Store for timeline window and cached data
let timelineWindow: BrowserWindow | null = null;
let cachedTimelineData: TimelineWindowData | null = null;

// Store for results window and cached data
let resultsWindow: BrowserWindow | null = null;
let cachedResultsData: ResultsWindowData | null = null;

/**
 * Opens or updates the Timeline window with new data.
 * Called directly from analysis handler after optimization completes.
 */
export async function openOrUpdateTimelineWindow(data: TimelineWindowData): Promise<{
  success: boolean;
  action?: 'opened' | 'updated';
  error?: string;
}> {
  try {
    // Cache the data so timeline window can request it
    cachedTimelineData = data;

    // If window exists and not destroyed, update it
    if (timelineWindow && !timelineWindow.isDestroyed()) {
      // Send updated data to existing window
      timelineWindow.webContents.send(TIMELINE_EVENTS.DATA_UPDATED, data);
      timelineWindow.focus();
      console.log('[Window Handler] Timeline window updated with new data');
      return { success: true, action: 'updated' };
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

    // Cleanup on close - notify main window
    timelineWindow.on('closed', () => {
      // Send event to all windows that timeline is closed
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send(TIMELINE_EVENTS.WINDOW_CLOSED);
        }
      });
      timelineWindow = null;
      cachedTimelineData = null;
    });

    console.log('[Window Handler] Timeline window opened');
    return { success: true, action: 'opened' };
  } catch (error) {
    console.error('[Window Handler] Error opening timeline window:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open timeline window',
    };
  }
}

/**
 * Check if timeline window is currently open
 */
export function isTimelineWindowOpen(): boolean {
  return timelineWindow !== null && !timelineWindow.isDestroyed();
}

/**
 * Get the timeline window instance (for direct manipulation if needed)
 */
export function getTimelineWindow(): BrowserWindow | null {
  return timelineWindow;
}

/**
 * Opens or updates the Results window with new data.
 * Called directly from analysis handler after optimization completes.
 */
export async function openOrUpdateResultsWindow(data: ResultsWindowData): Promise<{
  success: boolean;
  action?: 'opened' | 'updated';
  error?: string;
}> {
  try {
    // Cache the data so results window can request it
    cachedResultsData = data;

    // If window exists and not destroyed, update it
    if (resultsWindow && !resultsWindow.isDestroyed()) {
      // Send updated data to existing window
      resultsWindow.webContents.send(RESULTS_EVENTS.DATA_UPDATED, data);
      resultsWindow.focus();
      console.log('[Window Handler] Results window updated with new data');
      return { success: true, action: 'updated' };
    }

    // Calculate position with offset from timeline window (cascade effect)
    let x: number | undefined;
    let y: number | undefined;

    if (timelineWindow && !timelineWindow.isDestroyed()) {
      const [timelineX, timelineY] = timelineWindow.getPosition();
      if (timelineX !== undefined && timelineY !== undefined) {
        x = timelineX + 60; // Offset 60px right
        y = timelineY + 60; // Offset 60px down
      }
    }

    // Create new results window
    resultsWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      x, // Position with cascade offset if timeline exists
      y,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      title: 'Optimization Results - Line Optimizer',
      backgroundColor: '#f9fafb',
      show: false,
    });

    // Show when ready
    resultsWindow.once('ready-to-show', () => {
      resultsWindow?.show();
    });

    // Load the same renderer but with a hash route
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      resultsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/results-window`);
    } else {
      resultsWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: '/results-window' }
      );
    }

    // Cleanup on close - notify main window
    resultsWindow.on('closed', () => {
      // Send event to all windows that results is closed
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send(RESULTS_EVENTS.WINDOW_CLOSED);
        }
      });
      resultsWindow = null;
      cachedResultsData = null;
    });

    console.log('[Window Handler] Results window opened');
    return { success: true, action: 'opened' };
  } catch (error) {
    console.error('[Window Handler] Error opening results window:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open results window',
    };
  }
}

/**
 * Check if results window is currently open
 */
export function isResultsWindowOpen(): boolean {
  return resultsWindow !== null && !resultsWindow.isDestroyed();
}

/**
 * Get the results window instance (for direct manipulation if needed)
 */
export function getResultsWindow(): BrowserWindow | null {
  return resultsWindow;
}

export function registerWindowHandlers(): void {
  console.log('[Window Handler] Registering handlers...');

  // ===== Timeline Window Handlers =====

  // Open timeline window (called from renderer)
  ipcMain.handle(WINDOW_CHANNELS.OPEN_TIMELINE_WINDOW, async (_event, data: TimelineWindowData) => {
    const result = await openOrUpdateTimelineWindow(data);
    return { success: result.success, data: { action: result.action }, error: result.error };
  });

  // Check if timeline window is open
  ipcMain.handle(WINDOW_CHANNELS.IS_TIMELINE_OPEN, async () => {
    return { success: true, data: isTimelineWindowOpen() };
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

  // ===== Results Window Handlers =====

  // Open results window (called from renderer)
  ipcMain.handle(WINDOW_CHANNELS.OPEN_RESULTS, async (_event, data: ResultsWindowData) => {
    const result = await openOrUpdateResultsWindow(data);
    return { success: result.success, data: { action: result.action }, error: result.error };
  });

  // Check if results window is open
  ipcMain.handle(WINDOW_CHANNELS.IS_RESULTS_OPEN, async () => {
    return { success: true, data: isResultsWindowOpen() };
  });

  // Get cached results data (called by results window on load)
  ipcMain.handle(WINDOW_CHANNELS.GET_RESULTS_DATA, async () => {
    if (!cachedResultsData) {
      return {
        success: false,
        error: 'No results data available',
      };
    }
    return {
      success: true,
      data: cachedResultsData,
    };
  });

  // Close results window
  ipcMain.handle(WINDOW_CHANNELS.CLOSE_RESULTS_WINDOW, async () => {
    if (resultsWindow && !resultsWindow.isDestroyed()) {
      resultsWindow.close();
      return { success: true };
    }
    return { success: true, data: { message: 'Window already closed' } };
  });

  console.log('[Window Handler] Handlers registered');
}
