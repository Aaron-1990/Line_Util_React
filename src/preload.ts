// ============================================
// PRELOAD SCRIPT
// Bridge seguro entre Main y Renderer Process
// ============================================

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, EXCEL_CHANNELS, MODELS_V2_CHANNELS, COMPATIBILITY_CHANNELS, PRODUCT_VOLUME_CHANNELS, ANALYSIS_CHANNELS, WINDOW_CHANNELS, TIMELINE_EVENTS, CHANGEOVER_CHANNELS, ROUTING_CHANNELS, PLANT_CHANNELS, SHAPE_CATALOG_CHANNELS, CANVAS_OBJECT_CHANNELS, CANVAS_OBJECT_COMPATIBILITY_CHANNELS, PROJECT_CHANNELS, PROJECT_EVENTS } from './shared/constants';
import { ApiResponse } from './shared/types';

/**
 * API expuesta al Renderer Process
 *
 * Principios de Seguridad:
 * - Solo exponemos funciones especificas, no todo ipcRenderer
 * - Type-safe: Todo esta tipado
 * - No exponemos Node.js APIs directamente
 */

// Collect all valid channels from all channel constants (for invoke)
const ALL_VALID_CHANNELS = [
  ...Object.values(IPC_CHANNELS),
  ...Object.values(EXCEL_CHANNELS),
  ...Object.values(MODELS_V2_CHANNELS),
  ...Object.values(COMPATIBILITY_CHANNELS),
  ...Object.values(PRODUCT_VOLUME_CHANNELS),
  ...Object.values(ANALYSIS_CHANNELS),
  ...Object.values(WINDOW_CHANNELS),
  ...Object.values(CHANGEOVER_CHANNELS),
  ...Object.values(ROUTING_CHANNELS),
  ...Object.values(PLANT_CHANNELS),
  ...Object.values(SHAPE_CATALOG_CHANNELS),
  ...Object.values(CANVAS_OBJECT_CHANNELS),
  ...Object.values(CANVAS_OBJECT_COMPATIBILITY_CHANNELS),
  ...Object.values(PROJECT_CHANNELS),
] as const;

// Event channels for push notifications from main to renderer
const ALL_EVENT_CHANNELS = [
  ...Object.values(TIMELINE_EVENTS),
  ...Object.values(PROJECT_EVENTS),
] as const;

const electronAPI = {
  invoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<ApiResponse<T>> => {
    if (!ALL_VALID_CHANNELS.includes(channel as typeof ALL_VALID_CHANNELS[number])) {
      console.error(`Invalid IPC channel: ${channel}`);
      return {
        success: false,
        error: 'Invalid IPC channel',
      };
    }

    try {
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      console.error(`IPC invoke error on channel ${channel}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    // Check if channel is valid for invoke channels or event channels
    const isValidInvokeChannel = ALL_VALID_CHANNELS.includes(channel as typeof ALL_VALID_CHANNELS[number]);
    const isValidEventChannel = ALL_EVENT_CHANNELS.includes(channel as typeof ALL_EVENT_CHANNELS[number]);

    if (!isValidInvokeChannel && !isValidEventChannel) {
      console.error(`Invalid IPC channel for listener: ${channel}`);
      return;
    }

    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };

    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
