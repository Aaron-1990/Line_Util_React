# Phase 3.4 Summary: Multi-Sheet Excel Import with Multi-Year Volumes

**Date Completed**: 2026-01-19
**Developer**: Aaron Zapata
**Project**: Line Optimizer Desktop Application

---

## Overview

Phase 3.4 implements comprehensive multi-sheet Excel import functionality with support for dynamic multi-year volume forecasting. This feature enables rapid data loading for production line utilization analysis, reducing the manual process from hours to minutes.

---

## Data Flow: Excel → Database

### Visual Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    EXCEL                                        │
│                         (3 Sheets - Data Source)                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📋 Sheet 1: LINES                                                              │
│  ┌──────────┬──────┬─────────────────────────┐                                  │
│  │ Name     │ Area │ Time Available (sec)    │                                  │
│  ├──────────┼──────┼─────────────────────────┤                                  │
│  │ SMT-1    │ SMT  │ 82800                   │                                  │
│  │ ICT-1    │ ICT  │ 76212                   │                                  │
│  └──────────┴──────┴─────────────────────────┘                                  │
│                                                                                 │
│  📋 Sheet 2: MODELS (Metadata + Volumes Combined)                               │
│  ┌─────────────────────────────────┬────────────────────────────────────────┐   │
│  │         METADATA (fixed)        │           VOLUMES (dynamic)            │   │
│  ├──────────┬──────────┬───────────┼──────┬─────────┬──────┬─────────┬──────┤   │
│  │ Model    │ Customer │ Family    │ 2024 │ Dias Op │ 2025 │ Dias Op │ ...  │   │
│  │ Name     │          │           │      │ 2024    │      │ 2025    │      │   │
│  ├──────────┼──────────┼───────────┼──────┼─────────┼──────┼─────────┼──────┤   │
│  │ A4E4     │ Tesla    │ ECU       │38859 │ 240     │39785 │ 240     │ ...  │   │
│  │ GKN      │ Ford     │ DCM       │328749│ 288     │242907│ 288     │ ...  │   │
│  └──────────┴──────────┴───────────┴──────┴─────────┴──────┴─────────┴──────┘   │
│                                                                                 │
│  📋 Sheet 3: COMPATIBILITIES                                                    │
│  ┌───────────┬────────────┬────────────┬────────────┬──────────┐                │
│  │ Line Name │ Model Name │ Cycle Time │ Efficiency │ Priority │                │
│  ├───────────┼────────────┼────────────┼────────────┼──────────┤                │
│  │ SMT-1     │ A4E4       │ 45         │ 85         │ 1        │                │
│  │ SMT-1     │ GKN        │ 50         │ 82         │ 2        │                │
│  └───────────┴────────────┴────────────┴────────────┴──────────┘                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ PARSER (transpose & normalize)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  DATABASE                                       │
│                            (4 Tables - SQLite)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  🗄️ Table 1: production_lines                                                   │
│  ┌──────────┬──────────┬──────┬─────────────────────┐                           │
│  │ id (PK)  │ name     │ area │ time_available_daily│                           │
│  ├──────────┼──────────┼──────┼─────────────────────┤                           │
│  │ uuid-001 │ SMT-1    │ SMT  │ 82800               │                           │
│  │ uuid-002 │ ICT-1    │ ICT  │ 76212               │                           │
│  └──────────┴──────────┴──────┴─────────────────────┘                           │
│                                                                                 │
│  🗄️ Table 2: product_models_v2                                                  │
│  ┌──────────┬──────────┬──────────┬────────┐                                    │
│  │ id (PK)  │ name     │ customer │ family │  ← Metadata only                   │
│  ├──────────┼──────────┼──────────┼────────┤                                    │
│  │ uuid-101 │ A4E4     │ Tesla    │ ECU    │                                    │
│  │ uuid-102 │ GKN      │ Ford     │ DCM    │                                    │
│  └──────────┴──────────┴──────────┴────────┘                                    │
│                                                                                 │
│  🗄️ Table 3: product_volumes  ← Transposed from Excel columns to rows           │
│  ┌──────────┬───────────┬──────┬────────┬────────────────┐                      │
│  │ id (PK)  │ model_id  │ year │ volume │ operations_days│                      │
│  │          │ (FK)      │      │        │                │                      │
│  ├──────────┼───────────┼──────┼────────┼────────────────┤                      │
│  │ uuid-201 │ uuid-101  │ 2024 │ 38859  │ 240            │  ← A4E4, 2024        │
│  │ uuid-202 │ uuid-101  │ 2025 │ 39785  │ 240            │  ← A4E4, 2025        │
│  │ uuid-203 │ uuid-102  │ 2024 │ 328749 │ 288            │  ← GKN, 2024         │
│  │ uuid-204 │ uuid-102  │ 2025 │ 242907 │ 288            │  ← GKN, 2025         │
│  └──────────┴───────────┴──────┴────────┴────────────────┘                      │
│                                                                                 │
│  🗄️ Table 4: line_model_compatibilities                                         │
│  ┌──────────┬───────────┬───────────┬────────────┬────────────┬──────────┐      │
│  │ id (PK)  │ line_id   │ model_id  │ cycle_time │ efficiency │ priority │      │
│  │          │ (FK)      │ (FK)      │            │            │          │      │
│  ├──────────┼───────────┼───────────┼────────────┼────────────┼──────────┤      │
│  │ uuid-301 │ uuid-001  │ uuid-101  │ 45         │ 85         │ 1        │      │
│  │ uuid-302 │ uuid-001  │ uuid-102  │ 50         │ 82         │ 2        │      │
│  └──────────┴───────────┴───────────┴────────────┴────────────┴──────────┘      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Transformation: Models Sheet → Two Tables

The Models sheet in Excel combines metadata and volumes in a single row with many columns. The parser separates this into two normalized database tables:

```
EXCEL (1 row with many columns)
┌────────┬──────────┬────────┬───────┬─────────┬───────┬─────────┬─────┐
│ Model  │ Customer │ Family │ 2024  │ Dias Op │ 2025  │ Dias Op │ ... │
│ Name   │          │        │       │ 2024    │       │ 2025    │     │
├────────┼──────────┼────────┼───────┼─────────┼───────┼─────────┼─────┤
│ A4E4   │ Tesla    │ ECU    │ 38859 │ 240     │ 39785 │ 240     │ ... │
└────────┴──────────┴────────┴───────┴─────────┴───────┴─────────┴─────┘
                │
                │ Parser separates and transposes
                ▼
DATABASE (multiple normalized rows)

product_models_v2:          product_volumes:
┌──────────┬──────────┐     ┌───────────┬──────┬────────┬─────────┐
│ name     │ customer │     │ model_id  │ year │ volume │ ops_days│
├──────────┼──────────┤     ├───────────┼──────┼────────┼─────────┤
│ A4E4     │ Tesla    │     │ A4E4's ID │ 2024 │ 38859  │ 240     │
└──────────┴──────────┘     │ A4E4's ID │ 2025 │ 39785  │ 240     │
      1 row                 │ A4E4's ID │ 2026 │ ...    │ ...     │
                            └───────────┴──────┴────────┴─────────┘
                                  N rows (1 per year)
```

### Table Relationships (Foreign Keys)

```
production_lines
      │
      │ id ────────────────────┐
      │                        │
      │                        ▼
      │            line_model_compatibilities
      │                        ▲
      │                        │
product_models_v2 ─────────────┘
      │            model_id
      │
      │ id
      ▼
product_volumes
   model_id (FK)
```

### Summary by Table

| DB Table | Excel Source | Purpose |
|----------|--------------|---------|
| `production_lines` | Sheet "Lines" | What lines do we have? (capacity) |
| `product_models_v2` | Sheet "Models" (left columns) | What models exist? (metadata) |
| `product_volumes` | Sheet "Models" (right columns) | How much do we produce per year? |
| `line_model_compatibilities` | Sheet "Compatibilities" | Which model runs on which line? |

---

## Features Implemented

### 1. Multi-Sheet Excel Import

Supports importing three entity types from a single Excel file:

| Sheet | Entity | Required Columns |
|-------|--------|------------------|
| Lines | ProductionLine | Name, Area, Time Available (hours) |
| Models | ProductModelV2 + ProductVolume | Model Name, Customer, Program, Family, Active, Year Columns |
| Compatibilities | LineModelCompatibility | Line Name, Model Name, Cycle Time, Efficiency, Priority |

**Key Capabilities:**
- Automatic sheet detection by name patterns (English/Spanish)
- Auto-detection of column mappings
- Cross-sheet validation (e.g., compatibility references valid lines/models)
- Transactional import with rollback on error
- Merge, Create-only, or Update-only import modes

### 2. Multi-Year Volumes with Dynamic Year Detection

Supports volume forecasts from SAP in column-per-year format:

| Model Name | Customer | 2024 | Dias Op 2024 | 2025 | Dias Op 2025 | ... |
|------------|----------|------|--------------|------|--------------|-----|
| Model A    | OEM1     | 50000| 240          | 55000| 245          | ... |

**Key Capabilities:**
- Dynamic year detection from headers (regex: `/^(19|20|21)\d{2}$/`)
- Supports any year range (e.g., 2024-2034, 2025-2035, etc.)
- Per-model, per-year operations days (supports 5-day, 6-day weeks, or partial years)
- Automatic pairing of volume and operations days columns
- Default 240 operations days if not specified

### 3. Surrogate Keys Architecture

Refactored from natural keys (names) to surrogate keys (UUIDs):

```
Before: lineName + modelName (fragile, breaks on rename)
After:  lineId + modelId (stable, referential integrity)
```

---

## Technical Implementation

### Database Schema

**Tables:**

```sql
-- Production Lines (capacity)
CREATE TABLE production_lines (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  area TEXT NOT NULL,
  time_available_daily INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0
);

-- Product Models (metadata only)
CREATE TABLE product_models_v2 (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  customer TEXT,
  program TEXT,
  family TEXT,
  active INTEGER DEFAULT 1
);

-- Multi-Year Volumes (normalized - supports any year range)
CREATE TABLE product_volumes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  volume INTEGER NOT NULL DEFAULT 0,
  operations_days INTEGER NOT NULL DEFAULT 240 CHECK(operations_days >= 0 AND operations_days <= 366),
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(model_id, year)
);

-- Line-Model Compatibilities (with surrogate keys)
CREATE TABLE line_model_compatibilities (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  cycle_time REAL NOT NULL,
  efficiency REAL NOT NULL CHECK(efficiency > 0 AND efficiency <= 100),
  priority INTEGER DEFAULT 1,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(line_id, model_id)
);
```

### New Files Created

| File | Purpose |
|------|---------|
| `src/domain/entities/ProductVolume.ts` | Domain entity with daily demand calculation |
| `src/domain/repositories/IProductVolumeRepository.ts` | Repository interface |
| `src/main/database/repositories/SQLiteProductVolumeRepository.ts` | SQLite implementation |
| `src/main/database/migrations/003_product_volumes.sql` | Volume table migration |
| `src/main/ipc/handlers/volumes.handler.ts` | IPC handlers for volume queries |
| `tests/fixtures/multi-year-production-data.xlsx` | Test Excel file |

### Modified Files

| File | Changes |
|------|---------|
| `src/main/services/excel/MultiSheetImporter.ts` | Added `detectYearColumns()` method |
| `src/main/services/excel/MultiSheetValidator.ts` | Added `validateVolumes()` method |
| `src/main/ipc/handlers/multi-sheet-excel.handler.ts` | Volume import logic |
| `src/shared/types/index.ts` | New types: `YearColumnConfig`, `ValidatedVolume`, `VolumeValidationResult` |

### IPC Channels

Volume-specific channels (using `product-volumes:` prefix to avoid conflicts):

```typescript
PRODUCT_VOLUME_CHANNELS = {
  GET_BY_YEAR: 'product-volumes:get-by-year',
  GET_BY_MODEL: 'product-volumes:get-by-model',
  GET_AVAILABLE_YEARS: 'product-volumes:get-available-years',
  GET_YEAR_RANGE: 'product-volumes:get-year-range',
  GET_YEAR_SUMMARY: 'product-volumes:get-year-summary',
  GET_ALL: 'product-volumes:get-all',
}
```

---

## Verification Results

Tested with `multi-year-production-data.xlsx`:

| Entity | Count | Status |
|--------|-------|--------|
| Lines | 5 | Imported |
| Models | 5 | Imported |
| Volumes | 25 | Imported (5 models x 5 years) |
| Compatibilities | 11 | Imported |
| **Total Time** | 7ms | |

---

## Architecture Decisions

1. **Normalized Volumes Table**: Instead of adding year columns to models table, created separate `product_volumes` table for flexibility. This allows any year range without schema changes.

2. **Surrogate Keys**: Using UUIDs instead of names for foreign keys ensures referential integrity survives renames.

3. **No Processes Table**: Algorithm assigns models to lines directly, not through sequential processes.

4. **Efficiency in Compatibilities**: OEE varies by line-model pair, not globally per line or model.

5. **Dynamic Year Detection**: Regex-based detection allows any year range without code changes.

6. **Combined Models Sheet**: Metadata and volumes in same sheet (left=metadata, right=volumes) for SAP compatibility.

---

## Next Steps

### Immediate (Phase 3.5) - Analysis Control Bar

Add a control bar at the bottom of the application with three sections for managing utilization analysis:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ANALYSIS CONTROL BAR                                                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────┐   │
│  │ 📊 DATA STATUS       │  │ 📅 YEAR RANGE           │  │                       │   │
│  │                      │  │                         │  │   ▶ RUN ANALYSIS      │   │
│  │ ✅ Lines: 11         │  │ From: [2024 ▼]          │  │                       │   │
│  │ ✅ Models: 5         │  │ To:   [2034 ▼]          │  │   Calculate           │   │
│  │ ✅ Volumes: 55       │  │                         │  │   utilization for     │   │
│  │ ✅ Compat: 10        │  │ ○ All years (11)        │  │   11 years            │   │
│  │                      │  │ ● Custom range          │  │                       │   │
│  │ ✅ Ready to Analyze  │  │ ○ Single year           │  └───────────────────────┘   │
│  └──────────────────────┘  └─────────────────────────┘                              │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Section 1: Data Status Panel

Shows readiness of data for analysis:

| State | Icon | Description |
|-------|------|-------------|
| Missing | ❌ | Entity has 0 records |
| Partial | ⚠️ | Some required data missing |
| Ready | ✅ | Data complete and valid |

**Validation Rules:**
- Lines: At least 1 active line required
- Models: At least 1 active model required
- Volumes: At least 1 volume record per model required
- Compatibilities: At least 1 compatibility per line required

**Status Messages:**
- ❌ "Import data to enable analysis"
- ⚠️ "Missing volumes for 2 models"
- ✅ "Ready to analyze"

#### Section 2: Year Range Selector

Controls which years to analyze:

| Option | Behavior |
|--------|----------|
| All Years (default) | Uses min/max from detected years in database |
| Custom Range | User selects From/To years via dropdowns |
| Single Year | From = To (rare use case) |

**Features:**
- Dropdowns populated from `product_volumes` available years
- Radio buttons for mode selection
- Shows count of years selected: "11 years"
- Validates From <= To

#### Section 3: Run Analysis Button

| State | Appearance | Behavior |
|-------|------------|----------|
| Disabled | Gray, not clickable | Data validation failed |
| Ready | Blue/Green, clickable | All data valid, shows "Run Analysis" |
| Running | Spinner animation | Shows "Analyzing 2026... (3/11)" |
| Complete | Green checkmark | Shows "Analysis Complete - View Results" |
| Error | Red X | Shows error message with retry option |

**On Click (Run Analysis):**
1. Validates all required data is present
2. Iterates through selected year range
3. For each year, calculates utilization for all lines
4. Stores results in database
5. Updates canvas nodes with utilization/efficiency values
6. Shows completion summary

#### Bar States

**State 1: No Data**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ❌ Lines: 0    ❌ Models: 0    │  📅 Years: N/A         │  [ RUN ANALYSIS ]    │
│  ❌ Volumes: 0  ❌ Compat: 0    │  No data available     │     (disabled)       │
│                                                                                 │
│  ⚠️ Import data to enable analysis                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**State 2: Ready**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ✅ Lines: 5    ✅ Models: 5    │  📅 2024 → 2034        │  [ ▶ RUN ANALYSIS ]  │
│  ✅ Volumes: 55 ✅ Compat: 10   │  ○ All  ● Range  ○ One │     (enabled)        │
│                                                                                 │
│  ✅ Ready - Click Run Analysis to calculate utilization for 11 years           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**State 3: Running**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ✅ Lines: 5    ✅ Models: 5    │  📅 Analyzing: 2027    │  [ ⏹ CANCEL ]        │
│  ✅ Volumes: 55 ✅ Compat: 10   │  Progress: 4/11        │                      │
│                                                                                 │
│  ⏳ Calculating utilization... [████████░░░░░░░░░░░░] 36%                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**State 4: Complete**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ✅ Lines: 5    ✅ Models: 5    │  📅 2024-2034 ✓        │  [ ▶ RE-RUN ]        │
│  ✅ Volumes: 55 ✅ Compat: 10   │  Results: 11 years     │                      │
│                                                                                 │
│  ✅ Analysis complete - Utilization results displayed on canvas                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Implementation Tasks

- [ ] Create `AnalysisControlBar.tsx` component
- [ ] Create `DataStatusPanel.tsx` with real-time data counts
- [ ] Create `YearRangeSelector.tsx` with radio buttons and dropdowns
- [ ] Create `RunAnalysisButton.tsx` with state management
- [ ] Add Zustand store for analysis state (`useAnalysisStore`)
  - `analysisStatus`: 'idle' | 'ready' | 'running' | 'complete' | 'error'
  - `selectedYearRange`: { start: number, end: number, mode: 'all' | 'range' | 'single' }
  - `analysisProgress`: { currentYear: number, completedYears: number, totalYears: number }
  - `analysisResults`: Map<year, { lineResults: LineUtilization[] }>
- [ ] Connect to existing IPC handlers for data counts
- [ ] Add IPC handler for fetching available years
- [ ] Add progress tracking for multi-year iteration
- [ ] Style with Tailwind CSS to match app theme
- [ ] Add keyboard shortcut (Ctrl/Cmd + Enter) to run analysis

---

### Short-term (Phase 4 - Python Integration)

Connect the Run Analysis button to the actual Python utilization algorithm:

- [ ] **Multi-Year Iteration**: Algorithm iterates through selected year range
  ```python
  for year in range(start_year, end_year + 1):
      volumes = get_volumes_by_year(year)
      results[year] = calculate_utilization(lines, models, volumes, compatibilities)
  ```
  
- [ ] **Data Pipeline**: Export Lines + Models + Compatibilities + Volumes to JSON for Python

- [ ] **Algorithm Integration**: Connect `main_5.py` to read from database/exported data

- [ ] **Results Storage**: Store analysis results in new database table
  ```sql
  CREATE TABLE analysis_results (
    id TEXT PRIMARY KEY,
    line_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    utilization REAL NOT NULL,          -- % of time used
    efficiency REAL NOT NULL,           -- Blended OEE (weighted avg)
    total_time_used INTEGER,            -- seconds
    remaining_time INTEGER,             -- seconds
    models_assigned INTEGER,            -- count of models on this line
    run_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (line_id) REFERENCES production_lines(id),
    UNIQUE(line_id, year)
  );
  ```

- [ ] **Results Import**: Import analysis results back into app

- [ ] **Canvas Update**: Display utilization & efficiency per line after analysis
  ```
  ┌─────────────────────────────┐
  │ ● Line SMT-1                │
  │   Area: SMT                 │
  │   Time: 23.0h/day           │
  │   Efficiency: 83.9%         │  ← From analysis
  │   Utilization: 72.5%        │  ← From analysis
  └─────────────────────────────┘
  ```

---

### Medium-term (Phase 5 - Results Visualization)

- [ ] **Year Selector for Canvas**: Dropdown to switch between years and see utilization change
  
- [ ] **Color-Coded Nodes**: Visual indicators by utilization level
  - Green: < 70% (healthy capacity)
  - Yellow: 70-85% (approaching limit)
  - Red: > 85% (bottleneck risk)
  
- [ ] **What-If Analysis**: Adjust volumes and re-run analysis
  - Edit volumes in UI
  - Compare scenarios side-by-side
  
- [ ] **Multi-Year Trends**: Charts showing utilization over time
  - Line charts per production line
  - Highlight bottleneck years
  
- [ ] **Bottleneck Report**: Identify when/where capacity issues occur
  - Timeline view of constraints
  - Investment timing recommendations

---

### Future Enhancements

- [ ] **Bulk Edit**: Edit multiple compatibilities at once
- [ ] **Template Export**: Export current data as template for SAP updates
- [ ] **Validation Reports**: Detailed PDF reports of import validation
- [ ] **Undo/Redo**: Transaction history for imports
- [ ] **Scenario Management**: Save/load different analysis scenarios
- [ ] **Dashboard View**: Executive summary with key metrics
- [ ] **Excel Export**: Export analysis results to Excel

---

## Commits

```
4c6d4af feat(phase-3.4): Add multi-year volumes with dynamic year detection
0616a4e feat(phase-3.4): Complete Multi-Sheet Excel Import
77e5a5b feat(phase-3.4): Multi-Sheet Excel Import with surrogate keys
```

---

## Related Documentation

- Specification: `docs/specs/multi-sheet-excel-import.md`
- Test Fixture: `tests/fixtures/multi-year-production-data.xlsx`
- Claude Instructions: `.claude/CLAUDE.md`

---

## Glossary

| Term | Definition |
|------|------------|
| **OEE** | Overall Equipment Effectiveness - standard measure of manufacturing productivity |
| **Efficiency** | In this app, the Blended OEE (weighted average) for a line, per Hansen (2001) |
| **Utilization** | Percentage of available time actually used for production |
| **Cycle Time** | Time to produce one unit (seconds) |
| **Operations Days** | Working days per year for a model (240 = 5-day week, 288 = 6-day week) |
| **FCST** | Forecast - volume projections from SAP |
| **Surrogate Key** | System-generated unique identifier (UUID) vs natural key (name) |
| **Blended OEE** | Weighted average of efficiencies based on production time per model (Hansen, 2001) |

---

## References

- Hansen, R.C. (2001). *Overall Equipment Effectiveness: A Powerful Production/Maintenance Tool for Increased Profits*. Industrial Press, New York.
