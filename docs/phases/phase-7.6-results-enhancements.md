# Phase 7.6: Results Validation & Independent Results Window

> **Implementation Date:** 2026-02-06
> **Developer:** Aaron Zapata
> **Framework:** Framework Híbrido v2.0
> **Agents:** `frontend-developer`, `backend-architect`

---

## Overview

Phase 7.6 introduces two major enhancements to the Optimization Results system:

1. **Validation Rows**: Multi-year data quality verification in Results table
2. **Independent Results Window**: Conversion from CSS modal to Electron BrowserWindow

Both features align with engineering workflow patterns: persistent visual management, multi-monitor support, and scenario comparison capabilities.

---

## Feature 1: Optimization Results Validation

### Context

The Results table displays allocated units per model per year, but lacked verification that:
- All demand was properly distributed to production lines
- Optimizer's allocation matched database volumes
- Coverage percentage met acceptable thresholds

### Solution

Added four validation rows below each area's allocation table:

| Row | Purpose | Calculation |
|-----|---------|-------------|
| **Σ DISTRIBUIDO** | Sum of allocated units | Sum(allocated units per model per year) |
| **VOLUMEN (BD)** | Expected volume from database | From product_volumes table |
| **COBERTURA** | Coverage percentage | (Σ DISTRIBUIDO / VOLUMEN) × 100 |
| **ESTADO** | Status indicator | Threshold-based color coding |

### Status Thresholds

```typescript
OK        ≥95%   Green   Full coverage
UNDER   80-95%   Yellow  Slight undercoverage
ALERT   50-80%   Orange  Significant undercoverage
CRITICAL <50%    Red     Severe undercoverage
```

### Architecture

**Multi-Year Data Structure**:
```typescript
// Nested Map for O(1) lookups
Map<area: string, Map<year: number, AreaValidationSummary>>

interface AreaValidationSummary {
  totalDistributed: number;  // Sum from optimizer results
  totalVolume: number;       // Sum from database
  coveragePercent: number;   // (distributed / volume) × 100
  status: ValidationStatus;  // OK, UNDER, ALERT, CRITICAL
  modelBreakdown: Map<modelName, { distributed, volume }>;
}
```

**Hook: useValidationCalculator**

```typescript
export function useValidationCalculator(
  yearResults: YearOptimizationResult[]
): Map<string, Map<number, AreaValidationSummary>> {

  const years = useMemo(() =>
    yearResults.map(yr => yr.year).sort((a, b) => a - b),
    [yearResults]
  );

  // Fetch volumes for ALL years in parallel
  useEffect(() => {
    Promise.all(
      years.map(async (year) => {
        const response = await window.electronAPI.invoke<VolumeData[]>(
          PRODUCT_VOLUME_CHANNELS.GET_BY_YEAR,
          year
        );
        return { year, volumes: response.data || [] };
      })
    ).then(results => {
      const volumeMap = new Map(
        results.map(r => [r.year, r.volumes])
      );
      setVolumesByYear(volumeMap);
    });
  }, [years]);

  // Calculate validation for each area-year combination
  // Returns: Map<area, Map<year, Summary>>
}
```

**Component: ValidationRows**

```typescript
export function ValidationRows({
  validationsByYear,
  years,
  modelColumns
}: ValidationRowsProps) {
  return (
    <>
      {/* Row 1: Σ DISTRIBUIDO */}
      <tr className="bg-gray-50 font-semibold">
        <td>Σ DISTRIBUIDO</td>
        {years.map(year => (
          <ValidationYearCells
            key={`dist-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="distributed"
          />
        ))}
      </tr>

      {/* Row 2: VOLUMEN (BD) */}
      <tr className="bg-blue-50 font-semibold">
        <td>VOLUMEN (BD)</td>
        {years.map(year => (
          <ValidationYearCells
            key={`vol-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="volume"
          />
        ))}
      </tr>

      {/* Row 3: COBERTURA */}
      <tr className="bg-green-50 font-semibold">
        <td>COBERTURA</td>
        {years.map(year => (
          <ValidationYearCells
            key={`cov-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="coverage"
          />
        ))}
      </tr>

      {/* Row 4: ESTADO */}
      <tr className="bg-white font-bold">
        <td>ESTADO</td>
        {years.map(year => (
          <ValidationYearCells
            key={`status-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="status"
          />
        ))}
      </tr>
    </>
  );
}
```

**Sub-Component: ValidationYearCells**

Renders cells for a single year, following the same pattern as `YearDataCells`:

```typescript
function ValidationYearCells({ year, validation, modelColumns, rowType }) {
  if (!validation) {
    return <td colSpan={modelColumns.length + 1}>No data</td>;
  }

  const { totalDistributed, totalVolume, coveragePercent, status, modelBreakdown } = validation;

  // Render based on rowType
  switch (rowType) {
    case 'distributed':
      return (
        <>
          {modelColumns.map(model => (
            <td key={model}>{modelBreakdown.get(model)?.distributed || 0}</td>
          ))}
          <td className="font-bold">{totalDistributed}</td>
        </>
      );

    case 'volume':
      return (
        <>
          {modelColumns.map(model => (
            <td key={model}>{modelBreakdown.get(model)?.volume || 0}</td>
          ))}
          <td className="font-bold">{totalVolume}</td>
        </>
      );

    case 'coverage':
      return (
        <>
          {modelColumns.map(model => {
            const breakdown = modelBreakdown.get(model);
            const percent = breakdown
              ? (breakdown.distributed / breakdown.volume) * 100
              : 0;
            return <td key={model}>{percent.toFixed(1)}%</td>;
          })}
          <td className="font-bold">{coveragePercent.toFixed(1)}%</td>
        </>
      );

    case 'status':
      const color = STATUS_COLORS[status];
      return (
        <td colSpan={modelColumns.length + 1} className={`text-center ${color}`}>
          {status}
        </td>
      );
  }
}
```

### Integration with ResultsPanel

```typescript
export const ResultsPanel = ({ results, areaSequences, onClose, isStandaloneWindow = false }) => {
  // Calculate validation for all areas and years
  const validationsByAreaAndYear = useValidationCalculator(results?.yearResults || []);

  // In table tbody, after line allocation rows:
  {selectedArea && validationsByAreaAndYear.has(selectedArea) && (
    <ValidationRows
      validationsByYear={validationsByAreaAndYear.get(selectedArea)!}
      years={areaResults.years}
      modelColumns={modelsInArea}
    />
  )}
}
```

### Spec-Reality Adaptation (POST-MORTEM)

**Original Spec Assumption**:
- ResultsPanel displays one year at a time
- `selectedYear` state controls which year is shown
- Validation calculates for single year only

**Reality**:
- ResultsPanel displays ALL years simultaneously in columns
- No `selectedYear` state exists
- Year navigation only affects Canvas (not Results)

**Decision: Option B - Architecture Adaptation**

Instead of breaking existing multi-year display to match spec:
1. Adapted `useValidationCalculator` to accept `YearOptimizationResult[]`
2. Returns `Map<area, Map<year, Summary>>` for all years
3. Created `ValidationYearCells` sub-component following `YearDataCells` pattern
4. Renders validation columns for each year (consistent with existing table structure)

**BLOQUE 0 Lessons**:
1. Must analyze existing UI rendering patterns before designing new features
2. Check if component displays single item vs collection (critical assumption)
3. Spec "Alternate Flow" should include "What if existing structure differs from assumption?"

### Files Created/Modified

| File | Type | Purpose |
|------|------|---------|
| `src/renderer/features/analysis/hooks/useValidationCalculator.ts` | New (173 lines) | Parallel IPC volume fetches, validation calculation |
| `src/renderer/features/analysis/components/ValidationRows.tsx` | New (189 lines) | Renders 4 validation rows for multiple years |
| `src/shared/types/validation.ts` | New (42 lines) | AreaValidationSummary, ValidationStatus types |
| `src/shared/constants/validation.ts` | New (20 lines) | Status thresholds, color mappings |
| `src/renderer/features/analysis/components/ResultsPanel.tsx` | Modified | Integration with ValidationRows |

### Testing

**Manual Test Scenarios**:
1. Run optimization for single year → Validation rows appear
2. Run optimization for multiple years → Validation rows show all years
3. Check coverage calculation → Matches (distributed / volume) × 100
4. Verify status colors → Green (≥95%), Yellow (80-95%), Orange (50-80%), Red (<50%)
5. Test with missing volume data → Shows 0% coverage, CRITICAL status
6. Test with over-allocation → Shows >100% coverage, OK status

---

## Feature 2: Independent Results Window

### Context & Motivation

**Previous Implementation**: Results displayed as CSS modal overlay (fixed positioning, covers main window)

**Engineering Domain Requirements** (validated by @industrial-engineer):
- Manufacturing engineers commonly use dual-monitor setups
- Scenario comparison requires multiple windows visible simultaneously
- Iterative analysis workflows benefit from persistent result displays
- Modal overlays block interaction with source data

**UX Pattern Analysis** (validated by @ux-ui-designer):
- CAD/PLM software: Parameters in modal, results in independent windows
- Toyota Production System: "Visual Management should be persistent and comparable"
- Modern UX: Modals for quick decisions, windows for complex analysis

### Solution: Electron BrowserWindow

Convert Results from CSS modal to true Electron window with:
- Native OS controls (minimize, maximize, close)
- Independent positioning and sizing
- Multi-monitor support
- Cascade positioning for visual separation

### Architecture

```
Main Window (User runs optimization)
       ↓
Analysis Handler (Main Process)
       ├─> 1. Export data
       ├─> 2. Write JSON input
       ├─> 3. Run Python optimizer
       ├─> 4. Auto-open Timeline Window ────────┐
       └─> 5. Auto-open Results Window ──────┐  │
           (150ms delay for cascade)         │  │
                                             │  │
                    ┌────────────────────────┘  │
                    ▼                           ▼
      ┌──────────────────────────┐  ┌──────────────────────────┐
      │   RESULTS WINDOW         │  │   TIMELINE WINDOW        │
      │   BrowserWindow          │  │   BrowserWindow          │
      │   Route: /results-window │  │   Route: /timeline-window│
      │   Size: 1400×900         │  │   Size: 1400×900         │
      │   Position: Timeline+60px│  │   Position: default      │
      └──────────────────────────┘  └──────────────────────────┘
```

### Window Lifecycle

**Create/Update Flow**:
```typescript
export async function openOrUpdateResultsWindow(data: ResultsWindowData) {
  cachedResultsData = data; // Cache for window to fetch

  // If window exists and not destroyed, update it
  if (resultsWindow && !resultsWindow.isDestroyed()) {
    resultsWindow.webContents.send(RESULTS_EVENTS.DATA_UPDATED, data);
    resultsWindow.focus(); // Bring to front
    return { success: true, action: 'updated' };
  }

  // Calculate cascade position from Timeline window
  let x: number | undefined;
  let y: number | undefined;
  if (timelineWindow && !timelineWindow.isDestroyed()) {
    const [timelineX, timelineY] = timelineWindow.getPosition();
    if (timelineX !== undefined && timelineY !== undefined) {
      x = timelineX + 60; // Offset 60px right
      y = timelineY + 60; // Offset 60px down
    }
  }

  // Create new window
  resultsWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    x, // Cascade position
    y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Optimization Results - Line Optimizer',
    backgroundColor: '#f9fafb',
    show: false, // Show when ready
  });

  // Load route
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    resultsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/results-window`);
  } else {
    resultsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: '/results-window' }
    );
  }

  // Show when ready
  resultsWindow.once('ready-to-show', () => {
    resultsWindow?.show();
  });

  // Cleanup on close
  resultsWindow.on('closed', () => {
    // Notify all windows that Results closed
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(RESULTS_EVENTS.WINDOW_CLOSED);
      }
    });
    resultsWindow = null;
    cachedResultsData = null;
  });

  return { success: true, action: 'opened' };
}
```

### Cascade Positioning Strategy

**Problem**: Both windows open simultaneously, stack on top of each other → user sees only one window

**Solution**: 150ms delay + 60px offset

```typescript
// In analysis.handler.ts (RUN_OPTIMIZATION handler)

// Step 4: Open Timeline window first
await openOrUpdateTimelineWindow({ results, areaSequences });

// Step 5: Open Results window with delay for cascade effect
await new Promise(resolve => setTimeout(resolve, 150)); // Wait for Timeline to position

await openOrUpdateResultsWindow({ results, areaSequences });
```

**Why 150ms?**
- Electron windows position asynchronously
- Timeline needs time to calculate and apply default position
- 150ms is perceivable cascade effect (UX benefit) without feeling laggy
- If too short (<50ms), race condition causes overlap
- If too long (>300ms), feels disconnected from optimization completion

**Visual Result**:
```
┌────────────────────┐
│ Timeline Window    │
│                    │
└────────────────────┘
      ┌────────────────────┐
      │ Results Window     │  ← +60px right, +60px down
      │                    │
      └────────────────────┘
```

### IPC Communication

**Channels (window.handler.ts)**:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `window:open-results` | Renderer → Main | Open/update Results window |
| `window:get-results-data` | Renderer → Main | Fetch cached optimization data |
| `window:is-results-open` | Renderer → Main | Check if window exists |
| `window:close-results` | Renderer → Main | Close window programmatically |

**Events**:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `results:data-updated` | Main → Renderer | New optimization results available |
| `results:window-closed` | Main → All Windows | Results window was closed |

**Data Contract**:
```typescript
interface ResultsWindowData {
  results: OptimizationResult;       // Full optimizer output
  areaSequences: {                   // Area ordering for display
    code: string;
    sequence: number;
  }[];
}
```

### Frontend: ResultsWindowPage

Standalone page component loaded when window opens:

```typescript
export const ResultsWindowPage = () => {
  const [data, setData] = useState<ResultsWindowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data on mount
  const loadData = useCallback(async () => {
    try {
      const response = await window.electronAPI.invoke<ResultsWindowData>(
        WINDOW_CHANNELS.GET_RESULTS_DATA
      );

      if (response.success && response.data) {
        setData(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to load results data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for data updates (when new analysis runs)
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(
      RESULTS_EVENTS.DATA_UPDATED,
      (newData: unknown) => {
        console.log('[ResultsWindowPage] Received updated data');
        setData(newData as ResultsWindowData);
        setIsRefreshing(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Loading/Error states omitted for brevity

  return (
    <div className="h-screen bg-gray-50 overflow-hidden relative">
      {/* Refresh indicator overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/50 z-50">
          <RefreshCw className="animate-spin" />
        </div>
      )}

      {/* Results Panel - rendered directly in standalone window */}
      <ResultsPanel
        results={data.results}
        areaSequences={data.areaSequences}
        onClose={() => window.close()}
        isStandaloneWindow={true}
      />
    </div>
  );
};
```

### ResultsPanel Adaptation

Added conditional rendering for standalone window mode:

```typescript
interface ResultsPanelProps {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
  onClose: () => void;
  isStandaloneWindow?: boolean; // NEW: Indicates rendering in BrowserWindow
}

export const ResultsPanel = ({
  results,
  areaSequences,
  onClose,
  isStandaloneWindow = false
}) => {
  // ... component logic

  const content = (
    <div className="bg-white rounded-lg shadow-xl">
      {/* Header, tabs, table, etc. */}
    </div>
  );

  // If standalone window, render content directly (no modal wrapper)
  if (isStandaloneWindow) {
    return content;
  }

  // If embedded in main window, wrap in modal overlay
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      {content}
    </div>
  );
};
```

### Timeline Window Integration

Remove modal rendering, use IPC to open independent window:

```typescript
// BEFORE (Phase 7.5 and earlier):
const [showResultsPanel, setShowResultsPanel] = useState(false);

const handleViewDetails = () => {
  setShowResultsPanel(true);
};

return (
  <>
    <ConstraintTimeline onViewDetails={handleViewDetails} />
    {showResultsPanel && (
      <ResultsPanel
        results={data.results}
        onClose={() => setShowResultsPanel(false)}
      />
    )}
  </>
);

// AFTER (Phase 7.6):
const handleViewDetails = async () => {
  if (!data) return;

  try {
    await window.electronAPI.invoke(WINDOW_CHANNELS.OPEN_RESULTS, {
      results: data.results,
      areaSequences: data.areaSequences,
    });
  } catch (error) {
    console.error('[TimelineWindowPage] Failed to open results window:', error);
  }
};

return (
  <ConstraintTimeline onViewDetails={handleViewDetails} />
  // No modal rendering
);
```

### Files Created/Modified

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `src/renderer/pages/ResultsWindowPage.tsx` | New | 133 | Standalone page component for Results window |
| `src/main/ipc/handlers/window.handler.ts` | Modified | +116 | `openOrUpdateResultsWindow()` + 4 IPC handlers |
| `src/main/ipc/handlers/analysis.handler.ts` | Modified | +14 | Auto-open Results with cascade delay |
| `src/renderer/pages/TimelineWindowPage.tsx` | Modified | -20, +8 | Remove modal, add IPC call |
| `src/renderer/router/index.tsx` | Modified | +5 | Add `/results-window` route |
| `src/shared/constants/index.ts` | Modified | +10 | WINDOW_CHANNELS, RESULTS_EVENTS |
| `src/shared/types/index.ts` | Modified | +5 | Export ResultsWindowData type |
| `src/renderer/features/analysis/components/ResultsPanel.tsx` | Modified | +3 | Add `isStandaloneWindow` prop |
| `docs/testing/results-window-manual-test.md` | New | 488 | Comprehensive testing guide (12 scenarios) |

### Pattern Consistency

Follows `TimelineWindowPage` pattern exactly:
- ✅ Same window lifecycle management
- ✅ Same IPC communication structure
- ✅ Same data caching mechanism
- ✅ Same event broadcasting pattern
- ✅ Same cleanup on close (null reference, clear cache, notify all windows)
- ✅ Same loading/error state handling

### UX Benefits

**Multi-Monitor Support**:
- Drag Results window to second monitor
- Timeline on primary, Results on secondary
- Both windows independently resizable

**OS-Level Window Management**:
- Exposé/Mission Control shows both windows
- Dock shows separate window entries
- CMD+Tab cycles between windows
- Full-screen mode per window

**Visual Separation**:
- Cascade positioning makes both windows immediately visible
- User clearly sees two independent analysis views
- No confusion about modal overlay blocking interaction

**Workflow Improvements**:
- Run new analysis → both windows auto-open and update
- Keep Results open while tweaking data in main window
- Compare scenarios by arranging windows side-by-side
- Close one window without affecting the other

### Testing

Comprehensive manual test plan: `docs/testing/results-window-manual-test.md`

**12 Test Scenarios**:
1. Happy Path - First optimization (window auto-opens)
2. Window Exists - Update data (no duplicates)
3. Window Resize & Maximize (respects min dimensions)
4. Window Close - User initiated (cleanup, events)
5. Programmatic Close via IPC
6. Check Window State (is-results-open)
7. Get Cached Data (window:get-results-data)
8. Multi-Monitor Support (drag to second display)
9. Window Focus Management (focus on update)
10. Error Handling - Window creation failure (graceful)
11. Parent Window Cleanup (child closes with parent)
12. Concurrent Window Operations (Timeline + Results independent)

**Console Log Reference**:
```
[Analysis Handler] Optimization complete
[Window Handler] Timeline window opened
[Analysis Handler] Timeline window opened/updated with results
[Window Handler] Results window opened
[Analysis Handler] Results window opened/updated with results
```

---

## Commits

**Commit 1**: `9004a11` - feat: add optimization results validation with multi-year support
**Commit 2**: `b16ae16` - feat: convert Optimization Results to independent Electron window

---

## Related Documentation

- **Original Spec**: `docs/specs/optimization-results-validation.md` (includes POST-MORTEM)
- **Testing Guide**: `docs/testing/results-window-manual-test.md`
- **Related Phase**: Phase 4.2 (Multi-Window Results - Timeline window implementation)

---

## Future Enhancements

- [ ] Save/restore window position and size preferences
- [ ] Export Results to PDF/Excel from window toolbar
- [ ] Pin Results window (prevent auto-close on app quit)
- [ ] Tabbed Results for multiple scenarios
- [ ] Diff view between two Results windows
