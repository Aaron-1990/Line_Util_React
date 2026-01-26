# Architecture Design: ConstraintTimeline Separate Window

## Overview

Design for converting ConstraintTimeline from an in-window modal to a separate Electron BrowserWindow that can be moved to a second monitor.

---

## Current Architecture

```
ProductionCanvas (Main Window)
  └── ResultsPanelWrapper
        └── ConstraintTimeline (Modal Overlay)
              ├── onClose={() => resetAnalysis()}
              └── onViewDetails={() => setViewMode('details')}
```

**Current Flow:**
1. User runs optimization via AnalysisControlBar
2. Results stored in `useAnalysisStore.results`
3. ResultsPanelWrapper renders ConstraintTimeline as modal overlay
4. "View Details" button toggles to ResultsPanel in same modal space

---

## Proposed Architecture

```
Main Process (Node.js)
  ├── mainWindow (existing)
  └── constraintTimelineWindow (new)
        ├── Created on-demand
        ├── Receives results via IPC
        └── Can send actions back to main window

IPC Channels (new)
  ├── 'window:open-constraint-timeline'  → Open window with results
  ├── 'window:close-constraint-timeline' → Close window
  ├── 'window:view-details'              → Signal main window to show ResultsPanel
  └── 'window:constraint-timeline-data'  → Push results to timeline window
```

---

## Implementation Plan

### 1. Window Manager Service

**File:** `/src/main/services/window/WindowManager.ts`

```typescript
// ============================================
// WINDOW MANAGER
// Manages multiple BrowserWindows
// ============================================

import { BrowserWindow } from 'electron';
import path from 'path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

export class WindowManager {
  private static mainWindow: BrowserWindow | null = null;
  private static constraintTimelineWindow: BrowserWindow | null = null;

  static setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  static getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  static createConstraintTimelineWindow(): BrowserWindow | null {
    // Prevent multiple instances
    if (this.constraintTimelineWindow && !this.constraintTimelineWindow.isDestroyed()) {
      this.constraintTimelineWindow.focus();
      return this.constraintTimelineWindow;
    }

    this.constraintTimelineWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      title: 'Constraint Timeline - Line Optimizer',
      backgroundColor: '#ffffff',
      show: false,
      parent: this.mainWindow || undefined, // Set parent for proper task switching
      modal: false, // Not modal - can interact with both windows
    });

    this.constraintTimelineWindow.once('ready-to-show', () => {
      this.constraintTimelineWindow?.show();
    });

    // Load the same renderer but with a different route
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.constraintTimelineWindow.loadURL(
        `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/constraint-timeline`
      );
    } else {
      this.constraintTimelineWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: '/constraint-timeline' }
      );
    }

    // Cleanup on close
    this.constraintTimelineWindow.on('closed', () => {
      this.constraintTimelineWindow = null;
    });

    return this.constraintTimelineWindow;
  }

  static getConstraintTimelineWindow(): BrowserWindow | null {
    if (this.constraintTimelineWindow && !this.constraintTimelineWindow.isDestroyed()) {
      return this.constraintTimelineWindow;
    }
    return null;
  }

  static closeConstraintTimelineWindow(): void {
    if (this.constraintTimelineWindow && !this.constraintTimelineWindow.isDestroyed()) {
      this.constraintTimelineWindow.close();
    }
    this.constraintTimelineWindow = null;
  }

  static focusConstraintTimelineWindow(): void {
    const window = this.getConstraintTimelineWindow();
    if (window) {
      window.focus();
    }
  }
}
```

---

### 2. IPC Handlers for Window Management

**File:** `/src/main/ipc/handlers/window.handler.ts`

```typescript
// ============================================
// IPC HANDLER: Window Management
// Handles window creation and communication
// ============================================

import { ipcMain, BrowserWindow } from 'electron';
import { WINDOW_CHANNELS } from '@shared/constants';
import { ApiResponse, OptimizationResult } from '@shared/types';
import { WindowManager } from '../../services/window/WindowManager';

export function registerWindowHandlers(): void {
  // ===== OPEN CONSTRAINT TIMELINE WINDOW =====
  ipcMain.handle(
    WINDOW_CHANNELS.OPEN_CONSTRAINT_TIMELINE,
    async (_event, results: OptimizationResult): Promise<ApiResponse<void>> => {
      try {
        console.log('[Window Handler] Opening constraint timeline window');

        const window = WindowManager.createConstraintTimelineWindow();

        if (!window) {
          return {
            success: false,
            error: 'Failed to create window',
          };
        }

        // Wait for window to be ready, then send data
        window.webContents.once('did-finish-load', () => {
          window.webContents.send(WINDOW_CHANNELS.CONSTRAINT_TIMELINE_DATA, results);
        });

        return { success: true };
      } catch (error) {
        console.error('[Window Handler] Error opening constraint timeline:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CLOSE CONSTRAINT TIMELINE WINDOW =====
  ipcMain.handle(
    WINDOW_CHANNELS.CLOSE_CONSTRAINT_TIMELINE,
    async (): Promise<ApiResponse<void>> => {
      try {
        WindowManager.closeConstraintTimelineWindow();
        return { success: true };
      } catch (error) {
        console.error('[Window Handler] Error closing constraint timeline:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== VIEW DETAILS (from timeline window to main window) =====
  ipcMain.on(WINDOW_CHANNELS.VIEW_DETAILS, () => {
    console.log('[Window Handler] View details requested from timeline window');

    const mainWindow = WindowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Send message to main window to show ResultsPanel
      mainWindow.webContents.send(WINDOW_CHANNELS.SHOW_RESULTS_PANEL);
      mainWindow.focus();
    }
  });

  console.log('[Window Handler] Registered window handlers');
}
```

**Update:** `/src/main/ipc/handlers/index.ts`

```typescript
import { registerWindowHandlers } from './window.handler';

export function registerAllHandlers(): void {
  console.log('Registering IPC handlers...');

  registerProductionLinesHandlers();
  registerProductModelsHandlers();
  registerModelProcessesHandlers();
  registerProductionVolumesHandlers();
  registerAreaCatalogHandlers();
  registerExcelHandlers();
  registerMultiSheetExcelHandlers();
  registerVolumeHandlers();
  registerModelsV2Handlers();
  registerCompatibilityHandlers();
  registerAnalysisHandlers();
  registerWindowHandlers(); // NEW

  console.log('IPC handlers registered successfully');
}
```

---

### 3. Update Main Process Entry Point

**File:** `/src/main/index.ts`

```typescript
import { WindowManager } from './services/window/WindowManager';

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    // ... existing config
  });

  // Register with WindowManager
  WindowManager.setMainWindow(mainWindow);

  // ... rest of existing code
}
```

---

### 4. Constants for IPC Channels

**File:** `/src/shared/constants/ipc-channels.ts`

```typescript
export const WINDOW_CHANNELS = {
  OPEN_CONSTRAINT_TIMELINE: 'window:open-constraint-timeline',
  CLOSE_CONSTRAINT_TIMELINE: 'window:close-constraint-timeline',
  CONSTRAINT_TIMELINE_DATA: 'window:constraint-timeline-data',
  VIEW_DETAILS: 'window:view-details',
  SHOW_RESULTS_PANEL: 'window:show-results-panel',
} as const;
```

**Update:** `/src/shared/constants/index.ts`

```typescript
export { WINDOW_CHANNELS } from './ipc-channels';
```

---

### 5. Update Preload Script

**File:** `/src/preload.ts`

```typescript
import { WINDOW_CHANNELS } from './shared/constants';

const ALL_VALID_CHANNELS = [
  // ... existing channels
  ...Object.values(WINDOW_CHANNELS),
] as const;

const electronAPI = {
  // ... existing methods

  // NEW: Send one-way message (for VIEW_DETAILS)
  send: (channel: string, ...args: unknown[]): void => {
    if (!ALL_VALID_CHANNELS.includes(channel as typeof ALL_VALID_CHANNELS[number])) {
      console.error(`Invalid IPC channel for send: ${channel}`);
      return;
    }
    ipcRenderer.send(channel, ...args);
  },
};
```

---

### 6. New Route for Timeline Window

**File:** `/src/renderer/pages/ConstraintTimelinePage.tsx`

```typescript
// ============================================
// CONSTRAINT TIMELINE PAGE
// Standalone page for separate window
// ============================================

import { useEffect, useState } from 'react';
import { ConstraintTimeline } from '../features/analysis/components/ConstraintTimeline';
import { OptimizationResult, AreaCatalogItem } from '@shared/types';
import { WINDOW_CHANNELS, IPC_CHANNELS } from '@shared/constants';

export const ConstraintTimelinePage = () => {
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [areaSequences, setAreaSequences] = useState<{ code: string; sequence: number }[]>([]);

  useEffect(() => {
    // Listen for results data from main process
    const unsubscribe = window.electronAPI.on(
      WINDOW_CHANNELS.CONSTRAINT_TIMELINE_DATA,
      (data: OptimizationResult) => {
        console.log('[ConstraintTimelinePage] Received results:', data);
        setResults(data);
      }
    );

    // Fetch area catalog for ordering
    window.electronAPI
      .invoke<AreaCatalogItem[]>(IPC_CHANNELS.CATALOG_AREAS_GET_ALL)
      .then(response => {
        if (response.success && response.data) {
          setAreaSequences(
            response.data.map(area => ({
              code: area.code,
              sequence: area.sequence,
            }))
          );
        }
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleClose = () => {
    window.electronAPI.invoke(WINDOW_CHANNELS.CLOSE_CONSTRAINT_TIMELINE);
  };

  const handleViewDetails = () => {
    // Send message to main window to show ResultsPanel
    window.electronAPI.send(WINDOW_CHANNELS.VIEW_DETAILS);
  };

  if (!results) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading constraint timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50">
      <ConstraintTimeline
        results={results}
        areaSequences={areaSequences}
        onClose={handleClose}
        onViewDetails={handleViewDetails}
      />
    </div>
  );
};
```

**Update Router:** `/src/renderer/router/index.tsx`

```typescript
import { ConstraintTimelinePage } from '../pages/ConstraintTimelinePage';

const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // ... existing routes
    ],
  },
  {
    path: '/constraint-timeline',
    element: <ConstraintTimelinePage />,
  },
]);
```

---

### 7. Update ProductionCanvas to Open Separate Window

**File:** `/src/renderer/features/canvas/ProductionCanvas.tsx`

```typescript
import { WINDOW_CHANNELS } from '@shared/constants';

const ResultsPanelWrapper = () => {
  const { results, resetAnalysis, areaCatalog } = useAnalysisStore();
  const [viewMode, setViewMode] = useState<'timeline' | 'details'>('timeline');
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  useEffect(() => {
    // Listen for signal from timeline window to show ResultsPanel
    const unsubscribe = window.electronAPI.on(
      WINDOW_CHANNELS.SHOW_RESULTS_PANEL,
      () => {
        console.log('[ResultsPanelWrapper] Show results panel requested');
        setViewMode('details');
        setShowResultsPanel(true);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (!results) return null;

  // Build area sequences for ordering
  const areaSequences = areaCatalog.map(area => ({
    code: area.code,
    sequence: area.sequence,
  }));

  const handleOpenTimelineWindow = async () => {
    // Open in separate window instead of modal
    const response = await window.electronAPI.invoke(
      WINDOW_CHANNELS.OPEN_CONSTRAINT_TIMELINE,
      results
    );

    if (!response.success) {
      console.error('Failed to open constraint timeline window:', response.error);
      // Fallback to modal if window creation fails
      setViewMode('timeline');
    } else {
      // Hide local timeline, keep only ResultsPanel available
      setViewMode('details');
      setShowResultsPanel(false);
    }
  };

  // Show button to open timeline window
  if (viewMode === 'details' && !showResultsPanel) {
    return (
      <div className="fixed bottom-24 right-6 z-40">
        <button
          onClick={handleOpenTimelineWindow}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
        >
          <BarChart3 className="w-5 h-5" />
          Open Constraint Timeline
        </button>
      </div>
    );
  }

  // Default: Show button to open timeline in separate window
  if (viewMode === 'timeline') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Analysis Complete
          </h3>
          <p className="text-gray-600 mb-6">
            Open the Constraint Timeline in a separate window to analyze capacity constraints.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleOpenTimelineWindow}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              Open Timeline Window
            </button>
            <button
              onClick={() => setViewMode('details')}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={resetAnalysis}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detailed view: ResultsPanel with tables (modal)
  if (viewMode === 'details' && showResultsPanel) {
    return (
      <ResultsPanel
        onClose={() => {
          setShowResultsPanel(false);
          setViewMode('timeline');
        }}
        onViewDashboard={handleOpenTimelineWindow}
      />
    );
  }

  return null;
};
```

---

### 8. Update ConstraintTimeline Component Styling

**File:** `/src/renderer/features/analysis/components/ConstraintTimeline.tsx`

**Current:** Uses `fixed inset-0` modal overlay
**Change:** Conditional styling based on context (modal vs. window)

```typescript
export const ConstraintTimeline = ({
  results,
  areaSequences,
  onClose,
  onViewDetails,
  isStandalone = false, // NEW PROP
}: ConstraintTimelineProps) => {
  // ... existing logic

  const containerClass = isStandalone
    ? "h-full bg-white flex flex-col" // Full window
    : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"; // Modal

  const contentClass = isStandalone
    ? "h-full flex flex-col" // No max height, no rounded corners
    : "bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col"; // Modal style

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {/* Rest of component */}
      </div>
    </div>
  );
};
```

**Update ConstraintTimelinePage:** Pass `isStandalone={true}`

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Window (ProductionCanvas)                             │
│  ├── User completes optimization                            │
│  ├── Results stored in useAnalysisStore                     │
│  └── ResultsPanelWrapper shows completion dialog            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User clicks "Open Timeline Window"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  IPC: OPEN_CONSTRAINT_TIMELINE                              │
│  └── Payload: OptimizationResult                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Process (WindowManager)                               │
│  ├── Create new BrowserWindow                               │
│  ├── Load #/constraint-timeline route                       │
│  └── Wait for did-finish-load                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  IPC: CONSTRAINT_TIMELINE_DATA (send to new window)         │
│  └── Payload: OptimizationResult                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Timeline Window (ConstraintTimelinePage)                   │
│  ├── Receives results                                       │
│  ├── Fetches area catalog                                   │
│  └── Renders ConstraintTimeline component                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User clicks "View Details"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  IPC: VIEW_DETAILS (send from timeline to main)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Process                                               │
│  └── Forward SHOW_RESULTS_PANEL to main window              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Window                                                │
│  ├── Listen for SHOW_RESULTS_PANEL                          │
│  ├── Switch viewMode to 'details'                           │
│  ├── Show ResultsPanel modal                                │
│  └── Focus main window                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Window State Management

### Prevent Multiple Instances

```typescript
// In WindowManager.createConstraintTimelineWindow()
if (this.constraintTimelineWindow && !this.constraintTimelineWindow.isDestroyed()) {
  this.constraintTimelineWindow.focus(); // Just focus existing window
  return this.constraintTimelineWindow;
}
```

### Close Handling

```typescript
// In WindowManager
this.constraintTimelineWindow.on('closed', () => {
  this.constraintTimelineWindow = null;
});
```

### Window Persistence (Optional Enhancement)

Save and restore window position/size:

```typescript
// Save on close
this.constraintTimelineWindow.on('close', () => {
  const bounds = this.constraintTimelineWindow?.getBounds();
  // Save to config file or localStorage
  saveWindowBounds('constraint-timeline', bounds);
});

// Restore on create
const savedBounds = loadWindowBounds('constraint-timeline');
if (savedBounds) {
  this.constraintTimelineWindow = new BrowserWindow({
    ...savedBounds,
    // ... other config
  });
}
```

---

## Security Considerations

1. **IPC Channel Validation**: All channels validated in preload script
2. **Context Isolation**: Enabled (already configured)
3. **No Direct Node Access**: Renderer has no direct Node.js access
4. **Parent Window Reference**: Timeline window has parent reference for proper window management

---

## Testing Strategy

### Unit Tests

1. WindowManager singleton behavior
2. IPC handler message formatting
3. ConstraintTimelinePage data reception

### Integration Tests

1. Window creation from main window
2. Data passing between windows
3. "View Details" communication flow
4. Window cleanup on close

### Manual Testing Checklist

- [ ] Window opens on button click
- [ ] Data displays correctly in timeline window
- [ ] Window can be moved to second monitor
- [ ] Window can be resized
- [ ] Close button works
- [ ] "View Details" focuses main window and shows ResultsPanel
- [ ] Clicking "Open Timeline" again focuses existing window (no duplicate)
- [ ] Main window remains interactive while timeline is open
- [ ] Timeline window closes properly
- [ ] No memory leaks after multiple open/close cycles

---

## Performance Considerations

1. **Data Serialization**: OptimizationResult passed via IPC (JSON serialization)
   - Current results are ~17ms execution time with small payload
   - IPC overhead negligible (< 1ms)

2. **Window Creation**: ~100-200ms for new BrowserWindow
   - Acceptable UX with loading spinner

3. **Memory**: Second window adds ~50-100MB RAM
   - Reasonable for desktop app with separate monitor use case

---

## Rollback Strategy

If issues arise, keep original modal implementation:

```typescript
const useTimelineWindow = true; // Feature flag

if (useTimelineWindow) {
  // New: Open separate window
  handleOpenTimelineWindow();
} else {
  // Original: Show modal
  return <ConstraintTimeline ... />;
}
```

---

## Future Enhancements

1. **Multiple Timeline Windows**: Compare different year ranges side-by-side
2. **Window Sync**: Update timeline window when new optimization runs
3. **Print/Export from Timeline**: PDF export from separate window
4. **Keyboard Shortcuts**: Cmd/Ctrl+T to open timeline window
5. **Remember Last Position**: Save window bounds between sessions

---

## File Structure

```
src/
├── main/
│   ├── index.ts (updated: register WindowManager)
│   ├── services/
│   │   └── window/
│   │       └── WindowManager.ts (NEW)
│   └── ipc/
│       └── handlers/
│           ├── index.ts (updated: register window handlers)
│           └── window.handler.ts (NEW)
├── renderer/
│   ├── pages/
│   │   └── ConstraintTimelinePage.tsx (NEW)
│   ├── router/
│   │   └── index.tsx (updated: add timeline route)
│   └── features/
│       ├── analysis/
│       │   └── components/
│       │       └── ConstraintTimeline.tsx (updated: isStandalone prop)
│       └── canvas/
│           └── ProductionCanvas.tsx (updated: window open logic)
├── shared/
│   └── constants/
│       └── ipc-channels.ts (updated: WINDOW_CHANNELS)
└── preload.ts (updated: send method, WINDOW_CHANNELS)
```

---

## Implementation Phases

### Phase 1: Core Window Management
- [ ] Create WindowManager service
- [ ] Add window IPC handlers
- [ ] Register handlers in main process
- [ ] Update constants and preload

### Phase 2: Routing and Page
- [ ] Create ConstraintTimelinePage
- [ ] Add route to router
- [ ] Update ConstraintTimeline component for standalone mode

### Phase 3: Integration
- [ ] Update ProductionCanvas with window open logic
- [ ] Implement "View Details" communication
- [ ] Test window lifecycle

### Phase 4: Polish
- [ ] Add loading states
- [ ] Error handling
- [ ] Window position persistence
- [ ] Documentation

---

## Estimated Effort

- **Core Implementation**: 4-6 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour
- **Total**: 7-10 hours

---

## Key Benefits

1. **Multi-Monitor Support**: Primary use case - move timeline to second screen
2. **Better Focus**: Analyze timeline while interacting with canvas
3. **Larger View**: Timeline can use full screen without overlaying main window
4. **Better UX**: Windows taskbar shows both windows separately
5. **Extensible**: Foundation for other standalone windows (e.g., reports, charts)
