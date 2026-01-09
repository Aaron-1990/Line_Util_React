// ============================================
// PRELOAD SCRIPT
// Bridge seguro entre Main y Renderer Process
// ============================================

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/constants';
import { ApiResponse } from './shared/types';

/**
 * API expuesta al Renderer Process
 * 
 * Principios de Seguridad:
 * - Solo exponemos funciones especificas, no todo ipcRenderer
 * - Type-safe: Todo esta tipado
 * - No exponemos Node.js APIs directamente
 */
const electronAPI = {
  invoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<ApiResponse<T>> => {
    const validChannels = Object.values(IPC_CHANNELS);
    
    if (!validChannels.includes(channel as typeof validChannels[number])) {
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
    const validChannels = Object.values(IPC_CHANNELS);
    
    if (!validChannels.includes(channel as typeof validChannels[number])) {
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
