// ============================================
// PRELOAD SCRIPT
// Bridge seguro entre Main y Renderer Process
// ============================================

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, EXCEL_CHANNELS, MODELS_V2_CHANNELS, COMPATIBILITY_CHANNELS } from './shared/constants';
import { ApiResponse } from './shared/types';

/**
 * API expuesta al Renderer Process
 *
 * Principios de Seguridad:
 * - Solo exponemos funciones especificas, no todo ipcRenderer
 * - Type-safe: Todo esta tipado
 * - No exponemos Node.js APIs directamente
 */

// Collect all valid channels from all channel constants
const ALL_VALID_CHANNELS = [
  ...Object.values(IPC_CHANNELS),
  ...Object.values(EXCEL_CHANNELS),
  ...Object.values(MODELS_V2_CHANNELS),
  ...Object.values(COMPATIBILITY_CHANNELS),
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
    if (!ALL_VALID_CHANNELS.includes(channel as typeof ALL_VALID_CHANNELS[number])) {
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
