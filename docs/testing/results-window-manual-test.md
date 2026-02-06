# Optimization Results Window - Manual Testing Guide

**Feature:** Independent Electron BrowserWindow for Optimization Results
**Implementation Date:** 2026-02-06
**Framework:** Framework Híbrido v2.0
**Scope:** Main process only (backend-architect)

---

## Implementation Summary

### Files Modified

| File | Changes |
|------|---------|
| `src/shared/constants/index.ts` | Added `WINDOW_CHANNELS` (OPEN_RESULTS, GET_RESULTS_DATA, CLOSE_RESULTS_WINDOW, IS_RESULTS_OPEN) and `RESULTS_EVENTS` (DATA_UPDATED, WINDOW_CLOSED) |
| `src/main/ipc/handlers/window.handler.ts` | Added `openOrUpdateResultsWindow()`, `isResultsWindowOpen()`, `getResultsWindow()`, and 4 IPC handlers |
| `src/main/ipc/handlers/analysis.handler.ts` | Added auto-open call after optimization completes |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN WINDOW                          │
│  (User runs optimization)                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│          ANALYSIS HANDLER (Main Process)                │
│  1. Export data                                         │
│  2. Write JSON input                                    │
│  3. Run Python optimizer                                │
│  4. Auto-open Timeline window ──────────┐               │
│  5. Auto-open Results window ───────┐   │               │
└─────────────────────────────────────┼───┼───────────────┘
                                      │   │
                    ┌─────────────────┘   └─────────────────┐
                    ▼                                       ▼
      ┌──────────────────────────┐        ┌──────────────────────────┐
      │   RESULTS WINDOW         │        │   TIMELINE WINDOW        │
      │   (BrowserWindow)        │        │   (BrowserWindow)        │
      │                          │        │                          │
      │   Route: /results-window │        │   Route: /timeline-window│
      │   Size: 1400x900         │        │   Size: 1400x900         │
      │   Resizable: ✓           │        │   Resizable: ✓           │
      │   Maximizable: ✓         │        │   Maximizable: ✓         │
      └──────────────────────────┘        └──────────────────────────┘
```

### IPC Channels Added

```typescript
// Channel Constants
WINDOW_CHANNELS.OPEN_RESULTS = 'window:open-results'
WINDOW_CHANNELS.GET_RESULTS_DATA = 'window:get-results-data'
WINDOW_CHANNELS.CLOSE_RESULTS_WINDOW = 'window:close-results'
WINDOW_CHANNELS.IS_RESULTS_OPEN = 'window:is-results-open'

// Event Constants
RESULTS_EVENTS.DATA_UPDATED = 'results:data-updated'
RESULTS_EVENTS.WINDOW_CLOSED = 'results:window-closed'
```

### Data Contract

```typescript
interface ResultsWindowData {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
}
```

---

## Prerequisites for Testing

### 1. Database Setup
Ensure you have:
- At least 1 production line in database
- At least 1 product model with volume data
- Line-model compatibility configured
- Area catalog populated

### 2. Start Application
```bash
npm start
```

### 3. Verify HMR Status
- Changes to `src/main/*` require app restart
- Changes to `src/renderer/*` will auto-reload

---

## Test Plan

### TEST 1: Happy Path - First Optimization

**Objective:** Verify Results window opens automatically after optimization

**Steps:**
1. Launch application (`npm start`)
2. Navigate to Analysis tab
3. Select at least one year
4. Click "Run Optimization" button
5. Wait for optimization to complete (~17ms)

**Expected Results:**
- ✅ Console log: `[Analysis Handler] Optimization complete`
- ✅ Console log: `[Analysis Handler] Timeline window opened/updated with results`
- ✅ Console log: `[Analysis Handler] Results window opened/updated with results`
- ✅ Console log: `[Window Handler] Results window opened`
- ✅ Two new windows appear:
  - Timeline window (Multi-Year Capacity Analysis)
  - Results window (Optimization Results)
- ✅ Results window title: "Optimization Results - Line Optimizer"
- ✅ Results window size: 1400x900 (approximately)
- ✅ Results window is resizable
- ✅ Results window is maximizable
- ✅ Window shows `/results-window` route (will show "Not Found" until frontend implements)

**Acceptance Criteria:**
- Results window opens automatically
- No console errors
- Window has correct title and dimensions

---

### TEST 2: Window Exists - Update Data

**Objective:** Verify window updates when already open

**Steps:**
1. Complete TEST 1 (Results window is open)
2. Switch back to main window
3. Run optimization again (same or different years)

**Expected Results:**
- ✅ Console log: `[Window Handler] Results window updated with new data`
- ✅ Results window receives focus (comes to front)
- ✅ Results window does NOT create duplicate
- ✅ Event sent: `RESULTS_EVENTS.DATA_UPDATED` to window

**Acceptance Criteria:**
- Only one Results window exists
- Window focuses and updates
- No duplicate windows created

---

### TEST 3: Window Resize & Maximize

**Objective:** Verify window can be resized and maximized

**Steps:**
1. Results window is open
2. Drag window corner to resize smaller
3. Drag window corner to resize larger
4. Click maximize button (macOS: green button)
5. Click restore button

**Expected Results:**
- ✅ Window resizes smoothly in all directions
- ✅ Minimum size enforced: 1000x700
- ✅ Maximize button works
- ✅ Restore button works
- ✅ No console errors

**Acceptance Criteria:**
- Window respects min dimensions
- All resize operations work correctly

---

### TEST 4: Window Close - User Initiated

**Objective:** Verify cleanup when user closes window

**Steps:**
1. Results window is open
2. Click close button (X) on Results window
3. Check console logs
4. Run optimization again

**Expected Results:**
- ✅ Console log: `[Window Handler] Results window opened` (on re-open)
- ✅ Event broadcasted: `RESULTS_EVENTS.WINDOW_CLOSED` to all windows
- ✅ Window reference set to null
- ✅ Cached data cleared
- ✅ New optimization creates fresh window

**Acceptance Criteria:**
- Window closes cleanly
- No memory leaks
- Can re-open window

---

### TEST 5: Programmatic Close via IPC

**Objective:** Verify window can be closed programmatically

**Steps:**
1. Open DevTools for main window (View → Toggle Developer Tools)
2. Results window is open
3. In console, run:
```javascript
await window.api.invoke('window:close-results')
```

**Expected Results:**
- ✅ Results window closes
- ✅ Returns: `{ success: true }`
- ✅ Cleanup triggers (same as TEST 4)

**Acceptance Criteria:**
- IPC handler closes window correctly
- Cleanup executes

---

### TEST 6: Check Window State

**Objective:** Verify state check works correctly

**Steps:**
1. Results window is closed
2. In main window DevTools console:
```javascript
await window.api.invoke('window:is-results-open')
```
3. Run optimization (opens window)
4. Run same command again

**Expected Results:**
- ✅ First call returns: `{ success: true, data: false }`
- ✅ Second call returns: `{ success: true, data: true }`

**Acceptance Criteria:**
- State check accurately reflects window status

---

### TEST 7: Get Cached Data

**Objective:** Verify window can retrieve cached optimization data

**Steps:**
1. Run optimization (window opens automatically)
2. In Results window DevTools (if frontend implemented):
```javascript
await window.api.invoke('window:get-results-data')
```

**Expected Results:**
- ✅ Returns: `{ success: true, data: { results: {...}, areaSequences: [...] } }`
- ✅ Data includes:
  - `results.metadata` (version, timestamp, inputYears)
  - `results.yearResults` (array of year data)
  - `areaSequences` (area codes with sequence numbers)

**Acceptance Criteria:**
- Cached data retrievable
- Data structure matches contract

---

### TEST 8: Multi-Monitor Support

**Objective:** Verify window can be moved to second monitor

**Prerequisites:** Multiple monitors connected

**Steps:**
1. Run optimization (Results window opens)
2. Drag Results window to second monitor
3. Maximize window on second monitor
4. Close and re-open window

**Expected Results:**
- ✅ Window moves to second monitor
- ✅ Maximizes correctly on second monitor
- ✅ Electron handles multi-monitor correctly

**Acceptance Criteria:**
- Window functions correctly on all monitors

---

### TEST 9: Window Focus Management

**Objective:** Verify focus behavior when updating existing window

**Steps:**
1. Run optimization (windows open)
2. Click on main window (Results window loses focus)
3. Run optimization again
4. Observe Results window

**Expected Results:**
- ✅ Results window comes to front
- ✅ Results window has focus
- ✅ User sees updated data immediately

**Acceptance Criteria:**
- Window focus works correctly
- User doesn't have to manually find window

---

### TEST 10: Error Handling - Window Creation Failure

**Objective:** Verify graceful handling if window creation fails

**Steps:**
1. Simulate failure (would require code modification for testing)
2. Run optimization

**Expected Results:**
- ✅ Console error: `[Window Handler] Error opening results window:`
- ✅ Optimization does NOT fail
- ✅ Main window receives optimization results
- ✅ User can still see results in main window panel

**Acceptance Criteria:**
- Window failure doesn't break optimization
- Error logged but not thrown

---

### TEST 11: Parent Window Cleanup

**Objective:** Verify child window closes when main window closes

**Steps:**
1. Run optimization (Results window opens)
2. Close main application window
3. Check if Results window also closes

**Expected Results:**
- ✅ Results window closes automatically
- ✅ Application exits cleanly
- ✅ No orphaned processes

**Acceptance Criteria:**
- All windows close properly
- Clean shutdown

---

### TEST 12: Concurrent Window Operations

**Objective:** Verify both Timeline and Results windows work together

**Steps:**
1. Run optimization (both windows open)
2. Interact with Timeline window (navigate years)
3. Interact with Results window
4. Close Timeline window
5. Verify Results window still works
6. Close Results window
7. Verify Timeline window still works

**Expected Results:**
- ✅ Both windows operate independently
- ✅ Closing one doesn't affect the other
- ✅ Each window maintains its own state

**Acceptance Criteria:**
- Windows are truly independent
- No cross-window interference

---

## Known Limitations (Expected)

### Frontend Not Implemented Yet
- Route `/results-window` will show "Not Found" or blank page
- This is EXPECTED - frontend agent will create the page component
- Window infrastructure is complete and ready for frontend

### Test with Real Frontend
Once frontend implements `/results-window` route:
1. Window should display optimization results
2. Data should load via `window:get-results-data` IPC call
3. Window should update when receiving `RESULTS_EVENTS.DATA_UPDATED`

---

## Console Log Reference

### Successful Optimization Flow

```
[Analysis Handler] Exporting data for years: [2025, 2026]
[Analysis Handler] Export complete: { lines: 5, models: 10, volumes: 20, compatibilities: 25 }
[Analysis Handler] Input data written to: /path/to/input.json
[Python Bridge] Running optimization...
[Analysis Handler] Optimization complete
[Window Handler] Timeline window opened
[Analysis Handler] Timeline window opened/updated with results
[Window Handler] Results window opened
[Analysis Handler] Results window opened/updated with results
```

### Window Update Flow (Second Run)

```
[Analysis Handler] Optimization complete
[Window Handler] Timeline window updated with new data
[Analysis Handler] Timeline window opened/updated with results
[Window Handler] Results window updated with new data
[Analysis Handler] Results window opened/updated with results
```

---

## Troubleshooting

### Issue: Window doesn't open
**Check:**
- Console for errors
- Type-check passes: `npm run type-check`
- IPC handlers registered: Look for `[Window Handler] Handlers registered`

### Issue: Window opens but blank
**Expected:** Route `/results-window` not implemented yet in frontend
**Solution:** Wait for frontend agent to implement page component

### Issue: Window opens but shows DevTools error
**Check:**
- Preload script loaded correctly
- IPC channels exposed in preload

### Issue: Duplicate windows created
**Check:**
- `isDestroyed()` check in `openOrUpdateResultsWindow()`
- Window reference not being set to null

---

## Type-Check Validation

```bash
npm run type-check
```

**Expected:** No errors

---

## Next Steps (Frontend Agent)

The frontend agent (`frontend-developer`) needs to:

1. Create page component: `src/renderer/pages/ResultsWindow.tsx`
2. Add route in router: `/results-window`
3. Implement data fetching via `window:get-results-data` IPC
4. Listen for `RESULTS_EVENTS.DATA_UPDATED` to refresh data
5. Display optimization results in table/chart format
6. Handle `RESULTS_EVENTS.WINDOW_CLOSED` if needed

**Reference implementation:** `src/renderer/pages/TimelineWindow.tsx`

---

## Success Criteria Summary

- ✅ Type-check passes
- ✅ Window opens automatically after optimization
- ✅ Window has correct title: "Optimization Results - Line Optimizer"
- ✅ Window size: 1400x900, resizable, maximizable
- ✅ Window updates when already open (no duplicates)
- ✅ Window cleanup works (close, null reference, clear cache)
- ✅ All 4 IPC handlers work correctly
- ✅ Events broadcast correctly
- ✅ No console errors
- ✅ No memory leaks
- ✅ Follows Timeline window pattern exactly
- ✅ NO WORKAROUNDS used

---

**Implementation Status:** ✅ COMPLETE (Main Process)
**Frontend Status:** ⏳ PENDING (frontend-developer agent)
**Ready for Handoff:** ✅ YES
