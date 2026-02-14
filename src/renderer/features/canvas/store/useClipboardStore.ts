// ============================================
// CLIPBOARD STORE - Zustand
// State management for copy/paste operations
// Phase: Copy/Paste/Duplicate Workflow
// ============================================

import { create } from 'zustand';
import type { CanvasObject } from '@shared/types';

// ============================================
// TYPES
// ============================================

interface ClipboardStore {
  // State
  copiedObject: CanvasObject | null;

  // Actions
  copyObject: (object: CanvasObject) => void;
  clearClipboard: () => void;
  hasCopiedObject: () => boolean;
}

// ============================================
// STORE
// ============================================

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  copiedObject: null,

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Copy object to clipboard
   * Stores the full CanvasObject for later paste/duplicate operations
   */
  copyObject: (object: CanvasObject) => {
    set({ copiedObject: object });
    console.log('[Clipboard] Copied object:', object.id, object.name);
  },

  /**
   * Clear clipboard
   * Remove copied object from clipboard
   */
  clearClipboard: () => {
    set({ copiedObject: null });
    console.log('[Clipboard] Cleared');
  },

  /**
   * Check if clipboard has object
   * @returns true if clipboard contains an object
   */
  hasCopiedObject: () => {
    return get().copiedObject !== null;
  },
}));
