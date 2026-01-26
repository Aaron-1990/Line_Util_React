# ConstraintTimeline Separate Window - Quick Reference

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIN WINDOW                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ProductionCanvas                                    │   │
│  │  └── ResultsPanelWrapper                             │   │
│  │      └── [Open Timeline Window Button]              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ IPC: window:open-constraint-timeline
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   MAIN PROCESS                               │
│  WindowManager.createConstraintTimelineWindow()             │
│  └── Creates new BrowserWindow                              │
│  └── Loads #/constraint-timeline route                      │
│  └── Sends optimization results via IPC                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ IPC: window:constraint-timeline-data
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  TIMELINE WINDOW                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ConstraintTimelinePage                              │   │
│  │  └── ConstraintTimeline (standalone mode)           │   │
│  │      ├── Multi-year matrix                           │   │
│  │      ├── Constraint drill-down                       │   │
│  │      └── [View Details Button]                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ IPC: window:view-details
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     MAIN WINDOW                              │
│  └── Shows ResultsPanel modal                               │
│  └── Focuses window                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files to Create/Modify

### NEW FILES (3)

1. **`/src/main/services/window/WindowManager.ts`**
   - Manages BrowserWindow instances
   - Prevents duplicate timeline windows
   - 150 lines

2. **`/src/main/ipc/handlers/window.handler.ts`**
   - IPC handlers for window operations
   - Open, close, view details
   - 80 lines

3. **`/src/renderer/pages/ConstraintTimelinePage.tsx`**
   - Standalone page for timeline window
   - Receives data via IPC
   - 100 lines

### MODIFIED FILES (7)

1. **`/src/main/index.ts`**
   - Register WindowManager with main window
   - +3 lines

2. **`/src/main/ipc/handlers/index.ts`**
   - Register window handlers
   - +2 lines

3. **`/src/shared/constants/ipc-channels.ts`**
   - Add WINDOW_CHANNELS constant
   - +7 lines

4. **`/src/preload.ts`**
   - Add `send()` method for one-way IPC
   - Add WINDOW_CHANNELS to validation
   - +10 lines

5. **`/src/renderer/router/index.tsx`**
   - Add /constraint-timeline route
   - +5 lines

6. **`/src/renderer/features/analysis/components/ConstraintTimeline.tsx`**
   - Add `isStandalone` prop
   - Conditional styling for window vs modal
   - +10 lines

7. **`/src/renderer/features/canvas/ProductionCanvas.tsx`**
   - Replace modal with window open logic
   - Listen for show-results-panel event
   - +60 lines

---

## IPC Channel Design

```typescript
export const WINDOW_CHANNELS = {
  // Renderer → Main: Open timeline window with results
  OPEN_CONSTRAINT_TIMELINE: 'window:open-constraint-timeline',

  // Renderer → Main: Close timeline window
  CLOSE_CONSTRAINT_TIMELINE: 'window:close-constraint-timeline',

  // Main → Timeline Window: Send optimization results
  CONSTRAINT_TIMELINE_DATA: 'window:constraint-timeline-data',

  // Timeline Window → Main: Request to show ResultsPanel
  VIEW_DETAILS: 'window:view-details',

  // Main → Main Window: Signal to show ResultsPanel
  SHOW_RESULTS_PANEL: 'window:show-results-panel',
} as const;
```

---

## Communication Patterns

### 1. Open Timeline Window

```typescript
// Renderer (ProductionCanvas)
const response = await window.electronAPI.invoke(
  WINDOW_CHANNELS.OPEN_CONSTRAINT_TIMELINE,
  results
);

// Main Process (window.handler.ts)
const window = WindowManager.createConstraintTimelineWindow();
window.webContents.once('did-finish-load', () => {
  window.webContents.send(WINDOW_CHANNELS.CONSTRAINT_TIMELINE_DATA, results);
});
```

### 2. Receive Data in Timeline Window

```typescript
// Renderer (ConstraintTimelinePage)
useEffect(() => {
  const unsubscribe = window.electronAPI.on(
    WINDOW_CHANNELS.CONSTRAINT_TIMELINE_DATA,
    (data: OptimizationResult) => {
      setResults(data);
    }
  );
  return () => unsubscribe?.();
}, []);
```

### 3. View Details (Timeline → Main)

```typescript
// Timeline Window
const handleViewDetails = () => {
  window.electronAPI.send(WINDOW_CHANNELS.VIEW_DETAILS);
};

// Main Process
ipcMain.on(WINDOW_CHANNELS.VIEW_DETAILS, () => {
  const mainWindow = WindowManager.getMainWindow();
  mainWindow.webContents.send(WINDOW_CHANNELS.SHOW_RESULTS_PANEL);
  mainWindow.focus();
});

// Main Window
useEffect(() => {
  const unsubscribe = window.electronAPI.on(
    WINDOW_CHANNELS.SHOW_RESULTS_PANEL,
    () => {
      setViewMode('details');
      setShowResultsPanel(true);
    }
  );
  return () => unsubscribe?.();
}, []);
```

---

## Window Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "Open Timeline Window"                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Check if window already exists                          │
│     ├── Yes: Focus existing window, send updated data       │
│     └── No: Create new BrowserWindow                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Load renderer with #/constraint-timeline route          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Wait for did-finish-load event                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Send CONSTRAINT_TIMELINE_DATA to window                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. ConstraintTimelinePage receives data and renders        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. User interacts with timeline                            │
│     ├── View Details: Signal main window                    │
│     └── Close: Cleanup and destroy window                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Patterns

### WindowManager Singleton Pattern

```typescript
export class WindowManager {
  private static constraintTimelineWindow: BrowserWindow | null = null;

  static createConstraintTimelineWindow(): BrowserWindow | null {
    // Prevent duplicates
    if (this.constraintTimelineWindow && !this.constraintTimelineWindow.isDestroyed()) {
      this.constraintTimelineWindow.focus();
      return this.constraintTimelineWindow;
    }

    // Create new window
    this.constraintTimelineWindow = new BrowserWindow({ /* config */ });

    // Cleanup on close
    this.constraintTimelineWindow.on('closed', () => {
      this.constraintTimelineWindow = null;
    });

    return this.constraintTimelineWindow;
  }
}
```

### IPC Handler Pattern

```typescript
ipcMain.handle(
  WINDOW_CHANNELS.OPEN_CONSTRAINT_TIMELINE,
  async (_event, results: OptimizationResult): Promise<ApiResponse<void>> => {
    try {
      const window = WindowManager.createConstraintTimelineWindow();

      window.webContents.once('did-finish-load', () => {
        window.webContents.send(WINDOW_CHANNELS.CONSTRAINT_TIMELINE_DATA, results);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

### Standalone Page Pattern

```typescript
export const ConstraintTimelinePage = () => {
  const [results, setResults] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.on(
      WINDOW_CHANNELS.CONSTRAINT_TIMELINE_DATA,
      (data: OptimizationResult) => setResults(data)
    );
    return () => unsubscribe?.();
  }, []);

  if (!results) return <LoadingSpinner />;

  return (
    <ConstraintTimeline
      results={results}
      isStandalone={true}
      onClose={handleClose}
      onViewDetails={handleViewDetails}
    />
  );
};
```

---

## Testing Checklist

### Window Creation
- [ ] Window opens on first click
- [ ] Duplicate prevention (focus existing on second click)
- [ ] Window appears on correct screen
- [ ] Window has correct dimensions (1600x1000)

### Data Transfer
- [ ] Results passed correctly to timeline window
- [ ] Area catalog fetched and applied
- [ ] No data loss during serialization

### Inter-Window Communication
- [ ] "View Details" focuses main window
- [ ] ResultsPanel shows in main window
- [ ] Both windows remain interactive

### Cleanup
- [ ] Window closes properly
- [ ] Memory released (no leaks)
- [ ] Main window continues working after close

### Edge Cases
- [ ] Main window closed with timeline open
- [ ] Timeline closed then reopened
- [ ] Multiple rapid open/close cycles
- [ ] Window moved to second monitor persists

---

## Benefits Summary

| Aspect | Before (Modal) | After (Separate Window) |
|--------|---------------|------------------------|
| Multi-monitor | ❌ Overlays main window | ✅ Can move to second screen |
| Interaction | ❌ Blocks canvas | ✅ Both windows interactive |
| Screen space | ❌ Limited by modal size | ✅ Full screen available |
| Task switching | ❌ Hidden in main window | ✅ Separate taskbar entry |
| UX | ❌ Must close to interact | ✅ Parallel workflows |

---

## Implementation Order

1. **Create WindowManager service** (30 min)
   - Singleton pattern
   - Create/focus/close methods

2. **Add IPC handlers** (30 min)
   - Open/close/view-details channels
   - Register in main process

3. **Create ConstraintTimelinePage** (45 min)
   - Data reception via IPC
   - Routing setup
   - Loading states

4. **Update ConstraintTimeline component** (20 min)
   - Add isStandalone prop
   - Conditional styling

5. **Update ProductionCanvas** (45 min)
   - Window open logic
   - Listen for show-results-panel
   - Button UI

6. **Testing** (2-3 hours)
   - All scenarios
   - Edge cases
   - Memory checks

**Total: 7-10 hours**

---

## Next Steps

1. Review this design with team
2. Create feature branch: `feature/constraint-timeline-window`
3. Implement Phase 1 (WindowManager + IPC)
4. Test window creation
5. Implement Phase 2 (Routing + Page)
6. Test data transfer
7. Implement Phase 3 (Integration)
8. Full system testing
9. Merge to main

---

## Questions to Consider

1. **Window Position**: Should we persist window position between sessions?
2. **Multiple Windows**: Allow multiple timeline windows for comparison?
3. **Keyboard Shortcuts**: Cmd/Ctrl+T to toggle timeline window?
4. **Print/Export**: Add print button to standalone timeline?
5. **Auto-Refresh**: Update timeline window when new optimization runs?

---

## Related Files Reference

- Current implementation: `/src/renderer/features/canvas/ProductionCanvas.tsx` (lines 147-189)
- ConstraintTimeline: `/src/renderer/features/analysis/components/ConstraintTimeline.tsx`
- Main entry: `/src/main/index.ts`
- IPC handlers: `/src/main/ipc/handlers/index.ts`
- Preload: `/src/preload.ts`
