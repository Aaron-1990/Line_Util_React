// ============================================
// ELECTRON API TYPE DECLARATIONS
// Extiende Window con electronAPI
// ============================================

import { ElectronAPI } from '../../preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
