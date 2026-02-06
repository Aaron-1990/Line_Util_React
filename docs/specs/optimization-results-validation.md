# Optimization Results Validation Specification

## Metadata
- **Designed:** 2026-02-06
- **Designer:** Aaron Zapata
- **Project:** Line Optimizer
- **Framework:** Híbrido v2.0
- **Domain:** Manufacturing Analytics / Frontend UI
- **Primary Agent:** `frontend-developer`
- **Supporting Agents:** `industrial-engineer`, `code-reviewer`
- **Complexity:** Medium

## Context

### Business Value
Line Optimizer's optimizer algorithm distributes production demand across manufacturing lines. Currently, users must manually verify that:
1. All demand was correctly allocated (no units "lost" or duplicated)
2. Allocated units match expected annual volumes
3. Capacity constraints were respected

This feature adds **at-a-glance validation** directly in the Optimization Results table, eliminating manual verification and providing immediate confidence in the distribution.

### Current State
- Optimization Results panel shows per-line, per-model allocations in `Resultados_{ÁREA}` tables
- Data exists in `YearSummary` type: `totalDemandUnits`, `totalAllocatedUnits`, `demandFulfillmentPercent`
- No visual validation or comparison against database volumes
- Results panel embedded in main window (should be independent like Multi-Year Capacity Analysis)

### Desired State
1. **Validation rows** at bottom of each `Resultados_{ÁREA}` table:
   - `Σ DISTRIBUIDO`: Sum of allocated units per model across all lines in area
   - `VOLUMEN (BD)`: Annual volume from database (`product_volumes` table)
   - `COBERTURA`: Coverage percentage (distributed/volume × 100)
   - `ESTADO`: Visual status indicator (✅ OK, ⚠️ UNDER, 🔴 ALERT, etc.)

2. **Independent window** for Optimization Results (like Timeline window pattern)

---

## BLOQUE 0: Contracts & Architecture

### Investigation Checklist
- [x] Read `src/renderer/features/results/components/ResultsPanel.tsx`
- [x] Read `src/shared/types/analysis.ts` for `YearSummary`, `LineUtilizationResult`
- [x] Read Multi-Year Capacity Analysis window pattern: `src/renderer/features/analysis/components/MultiYearCapacityAnalysis.tsx`
- [x] Check IPC channels in `src/shared/constants/index.ts`
- [x] Verify database schema for `product_volumes` table

### Architectural Decisions

#### 1. Validation Logic Location
**Decision:** Calculate validation rows in **renderer** (not Python optimizer)

**Rationale:**
- Data already available in `YearSummary` and `LineUtilizationResult`
- Volumes available via existing IPC channels
- Keeps optimizer focused on optimization logic
- Allows real-time validation without re-running optimizer

#### 2. Window Management
**Decision:** Follow Multi-Year Capacity Analysis pattern (independent window)

**Pattern:** `WindowManager.open('optimization-results')` with state sync via `useAnalysisStore`

**Files to reference:**
- `src/main/windows/WindowManager.ts`
- `src/renderer/features/analysis/components/MultiYearCapacityAnalysis.tsx`

#### 3. Validation Thresholds (per IE agent recommendations)
```typescript
// src/shared/types/validation.ts

export type ValidationStatus = 'ok' | 'over' | 'under' | 'alert' | 'critical';

export interface ValidationThresholds {
  ok: { min: number; max: number };      // ±1% of volume
  over: { min: number };                 // >1% above volume
  under: { min: number; max: number };   // 5-15% below volume
  alert: { min: number; max: number };   // 15-30% below volume
  critical: { max: number };             // >30% below volume
}

export const DEFAULT_THRESHOLDS: ValidationThresholds = {
  ok: { min: 0.99, max: 1.01 },
  over: { min: 1.01 },
  under: { min: 0.85, max: 0.95 },
  alert: { min: 0.70, max: 0.85 },
  critical: { max: 0.70 }
};
```

#### 4. Data Flow
```
ResultsPanel
  ↓
useValidationCalculator(yearResults, selectedYear)
  ↓ (fetches volumes via IPC)
IPC: 'database:get-volumes-for-year'
  ↓
SQLiteProductVolumeRepository.getByYear(year)
  ↓
Calculate: distributed, volume, coverage, status per model
  ↓
Render validation rows in table
```

### New Types

```typescript
// src/shared/types/validation.ts

export interface ModelValidationRow {
  modelId: string;
  modelName: string;
  distributedUnits: number;      // Sum across all lines in area
  volumeUnitsAnnual: number;     // From product_volumes table
  coveragePercent: number;       // (distributed / volume) × 100
  status: ValidationStatus;      // Based on thresholds
}

export interface AreaValidationSummary {
  area: string;
  year: number;
  models: ModelValidationRow[];
  totalDistributed: number;
  totalVolume: number;
  overallCoverage: number;
}
```

### IPC Channels (check if exists, else create)

```typescript
// src/shared/constants/index.ts

export const IPC_CHANNELS = {
  // ... existing channels
  DATABASE_GET_VOLUMES_FOR_YEAR: 'database:get-volumes-for-year',
  WINDOW_OPEN_RESULTS: 'window:open-results',
} as const;
```

### Principles Applied
- **DRY:** Reuse Multi-Year window pattern, existing types
- **Separation of Concerns:** Validation logic in custom hook, UI in component
- **Single Responsibility:** ValidationCalculator only calculates, doesn't render
- **Open/Closed:** Thresholds configurable (future: user preferences)

---

## BLOQUE 1: Validation Types & Constants

**Objetivo:** Define TypeScript contracts and validation thresholds

**Archivos:**
- `src/shared/types/validation.ts` (create)
- `src/shared/constants/validation.ts` (create)

**Implementación:**

```typescript
// src/shared/types/validation.ts

export type ValidationStatus =
  | 'ok'       // ±1% of volume
  | 'over'     // >1% above volume (info, not error)
  | 'under'    // 5-15% below volume (warning)
  | 'alert'    // 15-30% below volume (needs attention)
  | 'critical'; // >30% below volume (immediate action)

export interface ValidationThresholds {
  ok: { min: number; max: number };
  over: { min: number };
  under: { min: number; max: number };
  alert: { min: number; max: number };
  critical: { max: number };
}

export interface ModelValidationRow {
  modelId: string;
  modelName: string;
  distributedUnits: number;
  volumeUnitsAnnual: number;
  coveragePercent: number;
  status: ValidationStatus;
  deltaUnits: number; // distributed - volume
}

export interface AreaValidationSummary {
  area: string;
  year: number;
  models: ModelValidationRow[];
  totalDistributed: number;
  totalVolume: number;
  totalDelta: number;
  overallCoverage: number;
}
```

```typescript
// src/shared/constants/validation.ts

import { ValidationThresholds } from '@shared/types/validation';

export const DEFAULT_VALIDATION_THRESHOLDS: ValidationThresholds = {
  ok: { min: 0.99, max: 1.01 },        // ±1%
  over: { min: 1.01 },                 // >1% above
  under: { min: 0.85, max: 0.95 },     // 5-15% below
  alert: { min: 0.70, max: 0.85 },     // 15-30% below
  critical: { max: 0.70 }              // >30% below
};

export const VALIDATION_STATUS_LABELS: Record<string, string> = {
  ok: '✅ OK',
  over: '⬆️ OVER',
  under: '⚠️ UNDER',
  alert: '🔴 ALERT',
  critical: '🚨 CRITICAL'
};

export const VALIDATION_STATUS_COLORS: Record<string, string> = {
  ok: '#10b981',      // green-500
  over: '#3b82f6',    // blue-500
  under: '#f59e0b',   // amber-500
  alert: '#ef4444',   // red-500
  critical: '#991b1b' // red-900
};
```

**CHECKPOINT Integrado (30 seg):**
```bash
npm run type-check
```

**Criterios de éxito:**
- [ ] Type-check pasa sin errores
- [ ] Exports correctos desde `@shared/types/validation`
- [ ] Constants available from `@shared/constants/validation`

---

## BLOQUE 2: IPC Channel for Volume Retrieval

**Objetivo:** Create IPC handler to fetch volumes by year from database

**Archivos:**
- `src/shared/constants/index.ts` (update)
- `src/main/ipc/databaseHandlers.ts` (update)
- `src/main/database/repositories/SQLiteProductVolumeRepository.ts` (verify method exists)

**Implementación:**

```typescript
// src/shared/constants/index.ts

export const IPC_CHANNELS = {
  // ... existing channels
  DATABASE_GET_VOLUMES_FOR_YEAR: 'database:get-volumes-for-year',
} as const;
```

```typescript
// src/main/ipc/databaseHandlers.ts

ipcMain.handle(
  IPC_CHANNELS.DATABASE_GET_VOLUMES_FOR_YEAR,
  async (_event, year: number) => {
    try {
      const volumeRepo = new SQLiteProductVolumeRepository(db);
      const volumes = await volumeRepo.getByYear(year);

      return {
        success: true,
        data: volumes.map(v => ({
          modelId: v.modelId,
          year: v.year,
          volume: v.volume
        }))
      };
    } catch (error) {
      console.error('Failed to fetch volumes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);
```

**Verificar método existe:**
```typescript
// src/main/database/repositories/SQLiteProductVolumeRepository.ts
// Should have: async getByYear(year: number): Promise<ProductVolume[]>
```

**CHECKPOINT Integrado (30 seg):**
```bash
npm run type-check

# Test IPC (if app running):
# Open DevTools Console:
# window.electron.ipcRenderer.invoke('database:get-volumes-for-year', 2025)
```

**Criterios de éxito:**
- [ ] Type-check pasa
- [ ] IPC channel registered
- [ ] Handler returns volumes array

---

## BLOQUE 3: Validation Calculator Hook

**Objetivo:** Create custom hook to calculate validation rows from analysis results

**Archivo:**
- `src/renderer/features/results/hooks/useValidationCalculator.ts` (create)

**Principios aplicados:**
- React hooks best practices (useEffect for async, useMemo for derived state)
- Error handling for IPC failures

**Implementación:**

```typescript
// src/renderer/features/results/hooks/useValidationCalculator.ts

import { useEffect, useState, useMemo } from 'react';
import { YearResults } from '@shared/types/analysis';
import {
  AreaValidationSummary,
  ModelValidationRow,
  ValidationStatus
} from '@shared/types/validation';
import {
  DEFAULT_VALIDATION_THRESHOLDS,
  VALIDATION_STATUS_LABELS
} from '@shared/constants/validation';
import { IPC_CHANNELS } from '@shared/constants';

interface VolumeData {
  modelId: string;
  year: number;
  volume: number;
}

export function useValidationCalculator(
  yearResults: YearResults | null,
  selectedYear: number
): AreaValidationSummary[] {
  const [volumes, setVolumes] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch volumes for selected year
  useEffect(() => {
    if (!selectedYear) return;

    setLoading(true);
    window.electron.ipcRenderer
      .invoke(IPC_CHANNELS.DATABASE_GET_VOLUMES_FOR_YEAR, selectedYear)
      .then((response) => {
        if (response.success) {
          setVolumes(response.data);
        } else {
          console.error('Failed to fetch volumes:', response.error);
          setVolumes([]);
        }
      })
      .catch((error) => {
        console.error('IPC error fetching volumes:', error);
        setVolumes([]);
      })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Calculate validation rows
  const validationSummaries = useMemo((): AreaValidationSummary[] => {
    if (!yearResults || !volumes.length) return [];

    const summaries: AreaValidationSummary[] = [];

    // Group results by area
    const areaGroups = new Map<string, typeof yearResults.lineResults>();
    yearResults.lineResults.forEach((lineResult) => {
      const area = lineResult.area;
      if (!areaGroups.has(area)) {
        areaGroups.set(area, []);
      }
      areaGroups.get(area)!.push(lineResult);
    });

    // Calculate validation for each area
    areaGroups.forEach((lineResults, area) => {
      // Aggregate distributed units per model
      const modelDistribution = new Map<string, { name: string; units: number }>();

      lineResults.forEach((lineResult) => {
        lineResult.assignments.forEach((assignment) => {
          const current = modelDistribution.get(assignment.modelId) || {
            name: assignment.modelName,
            units: 0
          };
          current.units += assignment.allocatedUnitsDaily * yearResults.operationsDays;
          modelDistribution.set(assignment.modelId, current);
        });
      });

      // Create validation rows
      const validationRows: ModelValidationRow[] = [];
      let totalDistributed = 0;
      let totalVolume = 0;

      modelDistribution.forEach((distribution, modelId) => {
        const volumeData = volumes.find(v => v.modelId === modelId);
        const volumeUnits = volumeData?.volume || 0;
        const distributedUnits = distribution.units;
        const coverageRatio = volumeUnits > 0 ? distributedUnits / volumeUnits : 0;
        const coveragePercent = coverageRatio * 100;

        // Determine status based on thresholds
        const status = determineStatus(coverageRatio, DEFAULT_VALIDATION_THRESHOLDS);

        validationRows.push({
          modelId,
          modelName: distribution.name,
          distributedUnits,
          volumeUnitsAnnual: volumeUnits,
          coveragePercent,
          status,
          deltaUnits: distributedUnits - volumeUnits
        });

        totalDistributed += distributedUnits;
        totalVolume += volumeUnits;
      });

      const overallCoverage = totalVolume > 0 ? (totalDistributed / totalVolume) * 100 : 0;

      summaries.push({
        area,
        year: selectedYear,
        models: validationRows,
        totalDistributed,
        totalVolume,
        totalDelta: totalDistributed - totalVolume,
        overallCoverage
      });
    });

    return summaries;
  }, [yearResults, volumes, selectedYear]);

  return validationSummaries;
}

function determineStatus(
  coverageRatio: number,
  thresholds: typeof DEFAULT_VALIDATION_THRESHOLDS
): ValidationStatus {
  if (coverageRatio >= thresholds.ok.min && coverageRatio <= thresholds.ok.max) {
    return 'ok';
  }
  if (coverageRatio > thresholds.over.min) {
    return 'over';
  }
  if (coverageRatio >= thresholds.under.min && coverageRatio < thresholds.under.max) {
    return 'under';
  }
  if (coverageRatio >= thresholds.alert.min && coverageRatio < thresholds.alert.max) {
    return 'alert';
  }
  return 'critical';
}
```

**CHECKPOINT Integrado (30 seg):**
```bash
npm run type-check
```

**Criterios de éxito:**
- [ ] Hook compiles without errors
- [ ] Handles missing volumes gracefully
- [ ] Correctly aggregates distributed units per model
- [ ] Status determination follows thresholds

---

## BLOQUE 4: Validation Rows Component

**Objetivo:** Create reusable component to render validation rows in results table

**Archivo:**
- `src/renderer/features/results/components/ValidationRows.tsx` (create)

**Implementación:**

```typescript
// src/renderer/features/results/components/ValidationRows.tsx

import React from 'react';
import { AreaValidationSummary } from '@shared/types/validation';
import {
  VALIDATION_STATUS_LABELS,
  VALIDATION_STATUS_COLORS
} from '@shared/constants/validation';

interface ValidationRowsProps {
  validation: AreaValidationSummary;
  modelColumns: string[]; // Model IDs in same order as table columns
}

export function ValidationRows({ validation, modelColumns }: ValidationRowsProps) {
  // Create lookup map for quick access
  const modelValidationMap = new Map(
    validation.models.map(m => [m.modelId, m])
  );

  return (
    <>
      {/* Separator row */}
      <tr>
        <td colSpan={modelColumns.length * 2 + 3} style={{
          borderTop: '2px solid #374151',
          padding: 0
        }} />
      </tr>

      {/* Σ DISTRIBUIDO row */}
      <tr style={{ backgroundColor: '#f9fafb', fontWeight: 600 }}>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
          Σ DISTRIBUIDO
        </td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        {modelColumns.map(modelId => {
          const modelVal = modelValidationMap.get(modelId);
          return (
            <React.Fragment key={modelId}>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>
                {modelVal ? modelVal.distributedUnits.toLocaleString() : '-'}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                -
              </td>
            </React.Fragment>
          );
        })}
      </tr>

      {/* VOLUMEN (BD) row */}
      <tr style={{ backgroundColor: '#f9fafb' }}>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
          VOLUMEN (BD)
        </td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        {modelColumns.map(modelId => {
          const modelVal = modelValidationMap.get(modelId);
          return (
            <React.Fragment key={modelId}>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>
                {modelVal ? modelVal.volumeUnitsAnnual.toLocaleString() : '-'}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                -
              </td>
            </React.Fragment>
          );
        })}
      </tr>

      {/* COBERTURA row */}
      <tr style={{ backgroundColor: '#f9fafb' }}>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
          COBERTURA
        </td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        {modelColumns.map(modelId => {
          const modelVal = modelValidationMap.get(modelId);
          return (
            <React.Fragment key={modelId}>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>
                {modelVal ? `${modelVal.coveragePercent.toFixed(1)}%` : '-'}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                -
              </td>
            </React.Fragment>
          );
        })}
      </tr>

      {/* ESTADO row */}
      <tr style={{ backgroundColor: '#f9fafb', fontWeight: 600 }}>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
          ESTADO
        </td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>-</td>
        {modelColumns.map(modelId => {
          const modelVal = modelValidationMap.get(modelId);
          const status = modelVal?.status || 'critical';
          const label = VALIDATION_STATUS_LABELS[status];
          const color = VALIDATION_STATUS_COLORS[status];

          return (
            <React.Fragment key={modelId}>
              <td style={{
                padding: '8px',
                textAlign: 'center',
                color,
                borderRight: '1px solid #e5e7eb'
              }}>
                {modelVal ? label : '-'}
              </td>
              <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
                -
              </td>
            </React.Fragment>
          );
        })}
      </tr>
    </>
  );
}
```

**CHECKPOINT Integrado (30 seg):**
```bash
npm run type-check
```

**Criterios de éxito:**
- [ ] Component renders without errors
- [ ] Handles missing models gracefully
- [ ] Status colors applied correctly
- [ ] Aligns with existing table columns

---

## BLOQUE 5: Integrate Validation into ResultsPanel

**Objetivo:** Add validation rows to existing Resultados_{ÁREA} tables

**Archivo:**
- `src/renderer/features/results/components/ResultsPanel.tsx` (update)

**Cambios:**
1. Import `useValidationCalculator` and `ValidationRows`
2. Calculate validation summaries
3. Render `ValidationRows` at bottom of each area table

**Implementación snippet:**

```typescript
// In ResultsPanel.tsx

import { useValidationCalculator } from '../hooks/useValidationCalculator';
import { ValidationRows } from './ValidationRows';

export function ResultsPanel() {
  // ... existing code ...

  const selectedYear = useAnalysisStore(state => state.selectedYear);
  const yearResults = results?.years.find(y => y.year === selectedYear);

  // NEW: Calculate validation
  const validationSummaries = useValidationCalculator(yearResults, selectedYear);

  // In the area table rendering loop:
  const areaValidation = validationSummaries.find(v => v.area === area);

  return (
    <div>
      {/* ... existing tables ... */}

      <table>
        {/* ... existing rows (line results) ... */}

        {/* NEW: Add validation rows at bottom */}
        {areaValidation && (
          <ValidationRows
            validation={areaValidation}
            modelColumns={modelIds} // Array of model IDs in table order
          />
        )}
      </table>
    </div>
  );
}
```

**CHECKPOINT Integrado (30 seg):**
```bash
npm start
# Open app, run analysis, check Results tab
# Verify validation rows appear at bottom of each area table
```

**Criterios de éxito:**
- [ ] Validation rows render below line results
- [ ] Columns align correctly
- [ ] Status indicators show correct colors
- [ ] No console errors

---

## BLOQUE 6: Independent Window for Results

**Objetivo:** Extract ResultsPanel to independent window (like Multi-Year Capacity Analysis)

**Archivos:**
- `src/renderer/features/results/components/ResultsWindow.tsx` (create)
- `src/main/windows/WindowManager.ts` (update)
- `src/main/ipc/windowHandlers.ts` (update)
- `src/renderer/features/analysis/components/AnalysisControlBar.tsx` (update button)

**Patrón a seguir:**
- Reference: `MultiYearCapacityAnalysis.tsx` window pattern
- Window ID: `'optimization-results'`
- Share state via `useAnalysisStore`

**Implementación:**

```typescript
// src/renderer/features/results/components/ResultsWindow.tsx

import React from 'react';
import { ResultsPanel } from './ResultsPanel';
import { useAnalysisStore } from '../../analysis/store/useAnalysisStore';

export function ResultsWindow() {
  const results = useAnalysisStore(state => state.results);

  if (!results) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <p>No analysis results available.</p>
        <p>Run an analysis from the main window first.</p>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      overflow: 'auto',
      backgroundColor: '#ffffff'
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
          Optimization Results
        </h1>
      </div>

      <ResultsPanel />
    </div>
  );
}
```

```typescript
// src/main/windows/WindowManager.ts (add to window configurations)

'optimization-results': {
  width: 1400,
  height: 900,
  title: 'Optimization Results - Line Optimizer',
  component: 'results-window'
}
```

```typescript
// src/main/ipc/windowHandlers.ts

ipcMain.handle(
  IPC_CHANNELS.WINDOW_OPEN_RESULTS,
  async () => {
    return WindowManager.open('optimization-results');
  }
);
```

```typescript
// src/renderer/features/analysis/components/AnalysisControlBar.tsx

// Add button next to existing controls:
<button
  onClick={() => {
    window.electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_OPEN_RESULTS);
  }}
  disabled={!results}
>
  Open Results Window
</button>
```

**CHECKPOINT Integrado (30 seg):**
```bash
npm start
# Run analysis
# Click "Open Results Window" button
# Verify independent window opens with results
# Verify validation rows visible in new window
```

**Criterios de éxito:**
- [ ] Window opens independently
- [ ] Results render correctly
- [ ] Validation rows visible
- [ ] State syncs via store
- [ ] Window persists across app restarts (if configured)

---

## BLOQUE FINAL: Alternate Flows & Integration

### Validaciones E2E

#### 1. Happy Path
- User imports data with volumes for year 2025
- User runs analysis for 2025
- Results panel shows validation rows:
  - Σ DISTRIBUIDO matches allocated units
  - VOLUMEN (BD) shows correct annual volumes
  - COBERTURA shows realistic percentages
  - ESTADO shows mix of ✅ OK, ⚠️ UNDER statuses
- User opens independent Results window
- Validation persists in new window

#### 2. Alternate Flow: No Volumes in Database
- User runs analysis for year with no volumes defined
- Validation rows show:
  - Σ DISTRIBUIDO: correct sums
  - VOLUMEN (BD): 0 or "-"
  - COBERTURA: N/A or 0%
  - ESTADO: Shows informative message or neutral status
- No crashes or errors

#### 3. Alternate Flow: Over-allocation
- Model has higher allocation than volume (optimizer found extra capacity)
- COBERTURA shows >100%
- ESTADO shows ⬆️ OVER (blue, informational)
- User understands this is not an error (capacity available)

#### 4. Error Handling: IPC Failure
- Database connection fails during volume fetch
- Hook catches error, logs to console
- Validation rows show fallback state (e.g., "Unable to load volumes")
- App remains functional

### Comandos de validación

```bash
# Start app
npm start

# Manual test checklist:
# 1. Run analysis for year 2025
# 2. Check Results tab in main window
#    - Validation rows at bottom of Resultados_SMT table?
#    - Status colors correct?
# 3. Click "Open Results Window"
#    - New window opens?
#    - Same validation rows visible?
# 4. Change year in dropdown
#    - Validation recalculates?
# 5. Run analysis with changeover enabled
#    - Validation still accurate?
# 6. Close and reopen Results window
#    - State persists?
```

### Checklist final

- [ ] Validation rows render in all area tables
- [ ] Status indicators use correct colors and labels
- [ ] Coverage percentages calculated correctly
- [ ] Independent Results window opens and syncs state
- [ ] No console errors during normal operation
- [ ] IPC failures handled gracefully
- [ ] Type-check passes
- [ ] No workarounds introduced (verified by code-reviewer)

**Estado:** Feature completa y validada

---

## Success Criteria

### Functional
- [ ] Validation rows visible in ResultsPanel for each area
- [ ] Σ DISTRIBUIDO = sum of allocated units per model
- [ ] VOLUMEN (BD) = annual volume from database
- [ ] COBERTURA = (distributed / volume) × 100
- [ ] ESTADO uses correct thresholds and colors
- [ ] Independent Results window opens and functions

### Technical
- [ ] All TypeScript types defined in `@shared/types/`
- [ ] IPC channel registered and functional
- [ ] Custom hook follows React best practices
- [ ] No performance degradation (validation calculated in <100ms)
- [ ] No memory leaks in window management

### UX
- [ ] Validation rows visually distinct (background color, font weight)
- [ ] Status labels clear and actionable
- [ ] Results window opens quickly (<500ms)
- [ ] Window state persists across sessions

---

## Testing Strategy

### Unit Tests (optional for MVP)
```typescript
// src/renderer/features/results/hooks/__tests__/useValidationCalculator.test.ts

describe('useValidationCalculator', () => {
  it('calculates coverage correctly', () => {
    // Test coverage = (distributed / volume) × 100
  });

  it('determines status based on thresholds', () => {
    // Test each status: ok, over, under, alert, critical
  });

  it('handles missing volumes gracefully', () => {
    // Test when volume = 0 or undefined
  });
});
```

### Integration Tests
- Manual testing with real analysis results
- Test with multiple years (2024-2034)
- Test with changeover enabled/disabled
- Test with different area configurations

### Manual QA Checklist
```markdown
- [ ] Import sample data (37 models, 100 lines, 11 years)
- [ ] Run analysis for 2025
- [ ] Verify validation rows appear
- [ ] Check GPEC5 model: should show ✅ OK (high volume, high capacity)
- [ ] Check low-volume models: should show ⚠️ UNDER or 🔴 ALERT
- [ ] Open Results window independently
- [ ] Change year: validation recalculates
- [ ] Close/reopen window: state persists
- [ ] No console errors throughout
```

---

## Implementation Command

```bash
# Using Claude Code CLI with Orchestrator
orchestrate docs/specs/optimization-results-validation.md
```

### Agent Workflow (Orchestrator auto-detection)

1. **@industrial-engineer** (BLOQUE 0 validation logic)
   - Review validation thresholds
   - Confirm coverage formula
   - Validate status determination logic

2. **@frontend-developer** (BLOQUE 1-6 implementation)
   - Create types and constants
   - Implement IPC channel
   - Build useValidationCalculator hook
   - Create ValidationRows component
   - Integrate into ResultsPanel
   - Create independent window

3. **@code-reviewer** (Post-implementation)
   - Review for workarounds
   - Check React best practices
   - Verify no performance issues
   - Confirm error handling

---

## Post-Implementation Verification

```bash
# 1. Type safety
npm run type-check

# 2. Start app
npm start

# 3. Run analysis
# - Import data if needed
# - Select year 2025
# - Click "Run Analysis"
# - Wait for completion

# 4. Verify in Results tab
# - Scroll to bottom of Resultados_SMT table
# - Check validation rows:
#   ✓ Σ DISTRIBUIDO shows sums
#   ✓ VOLUMEN (BD) shows volumes
#   ✓ COBERTURA shows percentages
#   ✓ ESTADO shows status with colors

# 5. Open Results window
# - Click "Open Results Window" button
# - Verify independent window opens
# - Verify validation rows visible in new window

# 6. Edge cases
# - Change year: validation recalculates
# - No volumes for year: graceful handling
# - Over-allocation: shows OVER status (blue)

# 7. No errors
# - Check DevTools console: no errors
# - Check main process logs: no errors
```

---

## Notes

### Manufacturing Context (for IE agent)
- **Coverage >100%** is informational (capacity available), not error
- **Coverage 99-101%** is target range (±1% tolerance typical in TPS)
- **Coverage <95%** requires attention (unmet demand)
- **Coverage <70%** is critical (capacity expansion needed)

### Technical Debt / Future Enhancements
- [ ] User-configurable thresholds (store in user_preferences table)
- [ ] Export validation report to Excel/PDF
- [ ] Highlight specific models in canvas when clicking validation row
- [ ] Historical validation tracking (trend analysis)
- [ ] Drill-down: click ESTADO to see detailed breakdown by line

### Dependencies
- Requires existing `product_volumes` table populated
- Requires `YearSummary` type in analysis results
- Requires Multi-Year Capacity Analysis window pattern as reference

---

**End of Specification**
