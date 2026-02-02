# Phase 7: Multi-Plant Support

> **Status:** In Progress (Sprint 4)
> **Version:** 1.0
> **Created:** 2026-02-01
> **Author:** Claude Code (with IE, Database, Backend, UX/UI Agent consultation)

---

## Executive Summary

This phase introduces **multi-plant capacity planning** capabilities, allowing users to:

1. Manage multiple manufacturing plants in a single application
2. Track model ownership (launch plant vs primary plant)
3. Allocate volumes across plants
4. Compare utilization across the plant network
5. Plan model transfers with before/after analysis

**Target Users:** Corporate IE teams, Regional Operations, Plant Managers managing transfers

**Value Proposition:** Fill the gap between siloed plant tools and expensive enterprise solutions (SAP IBP, Kinaxis). Most companies do multi-plant planning poorly with Excel.

---

## Table of Contents

1. [Use Cases](#1-use-cases)
2. [Data Architecture](#2-data-architecture)
3. [Database Schema](#3-database-schema)
4. [UX/UI Design](#4-uxui-design)
5. [Backend Architecture](#5-backend-architecture)
6. [Python Optimizer Changes](#6-python-optimizer-changes)
7. [Implementation Plan](#7-implementation-plan)
8. [Migration Strategy](#8-migration-strategy)
9. [Future Enhancements](#9-future-enhancements)

---

## 1. Use Cases

### 1.1 Primary Use Cases

| Use Case | Description | Stakeholders |
|----------|-------------|--------------|
| **New Business Quoting** | "Can we take this 500K/year program? Which plant?" | Sales, IE, Plant Mgr |
| **Load Balancing** | Prevent overtime at Plant A while Plant B is underutilized | Regional Ops, IE |
| **Model Transfer** | Customer requests move, cost reduction, capacity rebalancing | Corporate, Finance |
| **Risk Analysis** | "What if Plant A has a force majeure event?" | Supply Chain, Corporate |
| **CapEx Planning** | Justify new line at Plant B vs adding shift at Plant A | Finance, Ops |

### 1.2 Real-World Scenario: Reynosa → San Luis Potosí

```
BEFORE Transfer:
┌─────────────────────────────────────────────────────────────────┐
│  Reynosa          ████████████████████████░░  92%              │
│  San Luis Potosí  ████████████░░░░░░░░░░░░░░  55%              │
└─────────────────────────────────────────────────────────────────┘

AFTER Moving "Model X" (100K units):
┌─────────────────────────────────────────────────────────────────┐
│  Reynosa          ██████████████████░░░░░░░░  78%  ↓ -14%      │
│  San Luis Potosí  ██████████████████████░░░░  85%  ↑ +30%      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Questions the Tool Should Answer

1. **For Model Transfer:**
   - Does destination plant have required process areas?
   - What is current utilization at both plants?
   - What will utilization be after transfer?
   - What cycle time should we assume at destination?

2. **For New Business:**
   - Which plants can produce this model (process compatibility)?
   - Which plant has the most headroom?
   - What is the impact on utilization at each candidate?

3. **For Global View:**
   - Which plants are constrained? Which have capacity?
   - What is total network capacity vs demand?
   - Which models are single-sourced (risk)?

---

## 2. Data Architecture

### 2.1 Entity Classification: Global vs Plant-Specific

| Entity | Scope | Rationale |
|--------|-------|-----------|
| **Plants** | NEW (Root) | Top-level organizational unit |
| **Product Models** | **GLOBAL** | Same part number across plants; corporate definition |
| **Model Families** | **GLOBAL** | Product families are defined by engineering |
| **Area Catalog** | **GLOBAL** | Process types (SMT, ICT, FA) are standardized |
| **Production Lines** | **PLANT** | Physical assets at specific plants |
| **Product Volumes** | **PLANT** | Demand allocation is plant-specific |
| **Routings** | **PLANT** | Process flow can vary by plant equipment |
| **Compatibilities** | **PLANT** | Cycle time/efficiency varies by equipment |
| **Changeover Family Defaults** | **GLOBAL** | Product characteristic, not equipment |
| **Changeover Line Overrides** | **PLANT** | Equipment-dependent |
| **Canvas Layout** | **PLANT** | Visual layout is plant-specific |

### 2.2 Model Ownership Concept

Based on IE best practices, models track **two plant references**:

| Field | Purpose | Changes? |
|-------|---------|----------|
| `launch_plant_id` | Historical record - which plant first launched this model | Never |
| `primary_plant_id` | Current owner - who manages ECNs, process docs | Yes, after transfer stabilization |

**Ownership Types:**
- `exclusive` - Model produced at only one plant
- `shared` - Model actively produced at multiple plants
- `transferred` - Model moved from launch plant to different primary

### 2.3 Data Flow Diagram

```
                                 ┌─────────────────┐
                                 │     plants      │
                                 │─────────────────│
                                 │ id, code, name  │
                                 │ region, timezone│
                                 └────────┬────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│  production_lines   │      │  plant_volumes      │      │  plant_routings     │
│─────────────────────│      │─────────────────────│      │─────────────────────│
│ plant_id (FK)       │      │ plant_id (FK)       │      │ plant_id (FK)       │
│ name, area          │      │ model_id (FK)       │      │ model_id (FK)       │
│ time_available      │      │ year, volume        │      │ area_code, sequence │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
          │                               │
          │                               │
          │    ┌──────────────────────────┘
          │    │
          ▼    ▼
┌─────────────────────────────────┐
│  line_model_compatibilities     │
│─────────────────────────────────│
│ plant_id (FK) [denormalized]    │
│ line_id (FK)                    │
│ model_id (FK)                   │
│ cycle_time, efficiency          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  product_models_v2 (GLOBAL)     │
│─────────────────────────────────│
│ id, name, customer, family      │
│ launch_plant_id (FK)            │  ← Historical (never changes)
│ primary_plant_id (FK)           │  ← Current owner (can change)
│ ownership_type                  │
└─────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 New Table: `plants`

```sql
CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                    -- Short code: "REY", "SLP", "ITX"
  name TEXT NOT NULL,                           -- Full name: "Reynosa, Tamaulipas"
  region TEXT,                                  -- Geographic region: "LATAM", "NA", "EMEA"
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,                        -- ISO 3166-1 alpha-2: "MX", "US"
  timezone TEXT DEFAULT 'America/Chicago',      -- IANA timezone
  currency_code CHAR(3) DEFAULT 'USD',
  default_operations_days INTEGER DEFAULT 240,
  default_shifts_per_day INTEGER DEFAULT 2,
  default_hours_per_shift REAL DEFAULT 8.0,
  color TEXT,                                   -- Hex color for UI: "#3B82F6"
  is_default BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_plants_code ON plants(code) WHERE is_active = 1;
CREATE INDEX idx_plants_region ON plants(region);
CREATE INDEX idx_plants_active ON plants(is_active);
```

### 3.2 Modified Table: `product_models_v2`

```sql
-- Add columns for multi-plant tracking
ALTER TABLE product_models_v2 ADD COLUMN launch_plant_id TEXT REFERENCES plants(id);
ALTER TABLE product_models_v2 ADD COLUMN primary_plant_id TEXT REFERENCES plants(id);
ALTER TABLE product_models_v2 ADD COLUMN ownership_type TEXT DEFAULT 'exclusive'
  CHECK(ownership_type IN ('exclusive', 'shared', 'transferred'));
```

### 3.3 Modified Table: `production_lines`

```sql
ALTER TABLE production_lines ADD COLUMN plant_id TEXT REFERENCES plants(id);

-- Update unique constraint: name unique PER PLANT
DROP INDEX IF EXISTS idx_production_lines_name;
CREATE UNIQUE INDEX idx_production_lines_name_plant
  ON production_lines(name, plant_id) WHERE active = 1;
```

### 3.4 New Table: `plant_product_volumes`

Replaces `product_volumes` with plant-aware version:

```sql
CREATE TABLE IF NOT EXISTS plant_product_volumes (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  volume INTEGER NOT NULL DEFAULT 0 CHECK(volume >= 0),
  operations_days INTEGER NOT NULL DEFAULT 240,
  source TEXT DEFAULT 'manual',                 -- 'manual', 'excel_import', 'corporate'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(plant_id, model_id, year)
);

CREATE INDEX idx_plant_volumes_plant ON plant_product_volumes(plant_id);
CREATE INDEX idx_plant_volumes_model ON plant_product_volumes(model_id);
CREATE INDEX idx_plant_volumes_year ON plant_product_volumes(year);
```

### 3.5 New Table: `plant_model_routing`

Plant-specific routing (DAG):

```sql
CREATE TABLE IF NOT EXISTS plant_model_routing (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 1,
  expected_yield REAL NOT NULL DEFAULT 1.0,
  volume_fraction REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(plant_id, model_id, area_code)
);

CREATE TABLE IF NOT EXISTS plant_model_routing_predecessors (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  area_code TEXT NOT NULL,
  predecessor_area_code TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(plant_id, model_id, area_code, predecessor_area_code),
  CHECK(area_code != predecessor_area_code)
);
```

### 3.6 Modified Table: `line_model_compatibilities`

```sql
-- Add plant_id for denormalization (query performance)
ALTER TABLE line_model_compatibilities ADD COLUMN plant_id TEXT REFERENCES plants(id);

-- Backfill from line relationship
UPDATE line_model_compatibilities
SET plant_id = (SELECT plant_id FROM production_lines WHERE id = line_model_compatibilities.line_id);
```

### 3.7 Modified Table: `canvas_areas`

```sql
ALTER TABLE canvas_areas ADD COLUMN plant_id TEXT REFERENCES plants(id);
```

### 3.8 New Table: `model_plant_assignments` (Phase 7.2+)

For full lifecycle tracking:

```sql
CREATE TABLE IF NOT EXISTS model_plant_assignments (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,

  assignment_type TEXT NOT NULL DEFAULT 'primary',  -- 'primary', 'secondary', 'overflow', 'backup'
  status TEXT NOT NULL DEFAULT 'active',            -- 'proposed', 'ramp_up', 'active', 'phasing_out', 'inactive'

  assignment_start_date TEXT,
  production_start_date TEXT,
  phase_out_date TEXT,

  transferred_from_plant_id TEXT REFERENCES plants(id),
  transfer_reason TEXT,                              -- 'capacity', 'cost', 'customer_request', 'closure'

  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(model_id, plant_id)
);
```

---

## 4. UX/UI Design

### 4.1 Navigation Structure

```
┌─────────────────────────────────────┐
│  LINE OPTIMIZER                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 🏭 Reynosa              ▾   │   │  ← Plant Selector
│  │    Tamaulipas, MX          │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ○ Canvas              ⌘1          │
│  ○ Models              ⌘2          │  ← Data scoped to
│  ○ Routings            ⌘3          │    selected plant
│  ○ Areas               ⌘4          │
├─────────────────────────────────────┤
│  ORGANIZATION                       │
│  ○ All Plants          ⌘0          │  ← Plant CRUD
│  ○ Global Analysis     ⌘9          │  ← Cross-plant dashboard
└─────────────────────────────────────┘
```

### 4.2 Plant Selector Dropdown

```
┌───────────────────────────────────────┐
│ 🏭 Reynosa                         ▴  │
│    Tamaulipas, MX                     │
├───────────────────────────────────────┤
│ RECENT                                │
│  ○ San Luis Potosí    ← 2h ago        │
│  ○ Irapuato           ← yesterday     │
├───────────────────────────────────────┤
│ ALL PLANTS (4)                        │
│  ● Reynosa            Tamaulipas, MX  │  ← Current (filled)
│  ○ San Luis Potosí    SLP, MX         │
│  ○ Irapuato           Guanajuato, MX  │
│  ○ Seneca             SC, USA         │
├───────────────────────────────────────┤
│  + Add New Plant                      │
│  ⚙ Manage Plants...                   │
└───────────────────────────────────────┘
```

### 4.3 All Plants Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  All Plants                                           [+ Add Plant]         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─ Search plants... ─────────────────────────┐  Region: [All ▾]           │
│  └────────────────────────────────────────────┘                             │
├──────┬────────────────┬──────────────┬──────────┬──────────┬───────────────┤
│      │ PLANT          │ LOCATION     │ LINES    │ MODELS   │ UTILIZATION   │
├──────┼────────────────┼──────────────┼──────────┼──────────┼───────────────┤
│  ▮   │ Reynosa        │ Tamaulipas   │ 24       │ 156      │ ████████░░ 78%│
│      │ REY            │ MX           │          │          │               │
├──────┼────────────────┼──────────────┼──────────┼──────────┼───────────────┤
│  ▮   │ San Luis       │ SLP          │ 18       │ 89       │ ██████████ 92%│
│      │ SLP            │ MX           │          │          │ ⚠ Constrained │
├──────┼────────────────┼──────────────┼──────────┼──────────┼───────────────┤
│  ▮   │ Irapuato       │ Guanajuato   │ 31       │ 203      │ ██████░░░░ 55%│
│      │ ITX            │ MX           │          │          │               │
└──────┴────────────────┴──────────────┴──────────┴──────────┴───────────────┘

Row actions: [Open] [Edit] [Duplicate] [Archive]
```

### 4.4 Add/Edit Plant Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Add New Plant                                              ✕   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IDENTIFICATION                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ Plant Name *               │  │ Plant Code *               ││
│  │ San Luis Potosí            │  │ SLP                        ││
│  └────────────────────────────┘  └────────────────────────────┘│
│                                                                 │
│  LOCATION                                                       │
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ City                       │  │ State/Region               ││
│  │ San Luis Potosí            │  │ San Luis Potosí            ││
│  └────────────────────────────┘  └────────────────────────────┘│
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ Country *                  │  │ Region                     ││
│  │ [🇲🇽] Mexico            ▾  │  │ LATAM                   ▾  ││
│  └────────────────────────────┘  └────────────────────────────┘│
│                                                                 │
│  DEFAULTS                                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Op Days/Year │ │ Shifts/Day   │ │ Hours/Shift  │            │
│  │ 240          │ │ 2            │ │ 8.0          │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ Timezone *                 │  │ Color (optional)           ││
│  │ America/Mexico_City     ▾  │  │ [■] Blue                ▾  ││
│  └────────────────────────────┘  └────────────────────────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                      [Cancel]    [Save Plant]   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Global Analysis Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Global Analysis · 2025                                    [2024][2025][2026]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  NETWORK CAPACITY OVERVIEW                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Reynosa         ████████████████░░░░░░░░  78%                          │   │
│  │  San Luis        ██████████████████████░░  92%  ⚠ Constrained           │   │
│  │  Irapuato        ████████████░░░░░░░░░░░░  55%                          │   │
│  │  Seneca          ██████████████████░░░░░░  82%                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌───────────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ SUMMARY                           │  │ ALERTS                            │  │
│  │                                   │  │                                   │  │
│  │ 4 Plants                          │  │ ⚠ San Luis approaching limit     │  │
│  │ 91 Production Lines               │  │   Constraint: SMT Area            │  │
│  │ 447 Active Models                 │  │   Headroom: 8%                    │  │
│  │                                   │  │                                   │  │
│  │ Network Avg Utilization: 77%      │  │ ℹ Irapuato has 45% headroom      │  │
│  │ Unfulfilled Demand: 0 units       │  │   Consider for new business       │  │
│  └───────────────────────────────────┘  └───────────────────────────────────┘  │
│                                                                                 │
│  PLANT COMPARISON                                                               │
│  ┌────────────┬────────────┬─────────┬───────────┬────────────┬─────────────┐  │
│  │ PLANT      │ REGION     │ LINES   │ UTIL %    │ CONSTRAINT │ HEADROOM    │  │
│  ├────────────┼────────────┼─────────┼───────────┼────────────┼─────────────┤  │
│  │ Reynosa    │ LATAM      │ 24      │ 78%       │ —          │ 22%         │  │
│  │ San Luis   │ LATAM      │ 18      │ 92%    ⚠  │ SMT        │ 8%          │  │
│  │ Irapuato   │ LATAM      │ 31      │ 55%       │ —          │ 45%         │  │
│  │ Seneca     │ NA         │ 18      │ 82%       │ —          │ 18%         │  │
│  └────────────┴────────────┴─────────┴───────────┴────────────┴─────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                              [Export Report]  [Run All Plants]  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Model Detail with Multi-Plant View

```
┌─────────────────────────────────────────────────────────────────┐
│  Model: HEV Inverter Gen3                                       │
│  Customer: OEM-A    Family: HEV Inverters                       │
├─────────────────────────────────────────────────────────────────┤
│  Launch Plant:   🏭 Reynosa        ← Never changes              │
│  Primary Plant:  🏭 San Luis       ← Current owner              │
│  Ownership:      Transferred                                    │
├─────────────────────────────────────────────────────────────────┤
│  PLANT ALLOCATIONS                                              │
│  ┌────────────────┬────────────┬───────────┬───────────────────┐│
│  │ PLANT          │ STATUS     │ 2025      │ ROUTING           ││
│  ├────────────────┼────────────┼───────────┼───────────────────┤│
│  │ 🏭 Reynosa     │ Phasing Out│ 50,000 ↓  │ SMT→ICT→FA       ││
│  │ 🏭 San Luis    │ Ramp Up    │ 50,000 ↑  │ SMT→ICT→CC→FA    ││
│  └────────────────┴────────────┴───────────┴───────────────────┘│
│                                                                 │
│  Total Global Volume: 100,000                                   │
│                                        [+ Assign to Plant]      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.7 Page Header Context

Every page shows current plant context:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Models · Reynosa                                       [+ New Model]       │
│  ▮ 156 models · Last analyzed 2h ago                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.8 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + Shift + P` | Open plant switcher |
| `⌘ + 0` | Go to All Plants |
| `⌘ + 9` | Go to Global Analysis |
| `⌘ + [` | Previous plant (recent) |
| `⌘ + ]` | Next plant (recent) |

---

## 5. Backend Architecture

### 5.1 Context Management: Explicit plantId

**Approach:** Pass `plantId` explicitly through all IPC calls and repository methods.

```typescript
// Renderer calls with explicit plant context
const response = await window.electronAPI.invoke<ProductionLine[]>(
  'lines:get-all',
  currentPlantId  // Explicit plant context
);

// IPC handler extracts plantId
ipcMain.handle('lines:get-all', async (_event, plantId: string) => {
  const lines = await repository.findActiveByPlant(plantId);
  return { success: true, data: lines.map(l => l.toJSON()) };
});
```

### 5.2 Repository Pattern

```typescript
// All repository methods accept plantId parameter
interface ProductionLineRepository {
  findActiveByPlant(plantId: string): Promise<ProductionLine[]>;
  findById(id: string): Promise<ProductionLine | null>;
  create(line: CreateLineInput, plantId: string): Promise<ProductionLine>;
  // ...
}

// Legacy method for backward compatibility
async findActive(): Promise<ProductionLine[]> {
  const defaultPlant = await this.plantRepository.getDefaultPlant();
  return this.findActiveByPlant(defaultPlant.id);
}
```

### 5.3 State Management (Zustand)

```typescript
interface NavigationState {
  currentView: 'canvas' | 'models' | 'routings' | 'areas' | 'plants' | 'global-analysis';
  currentPlantId: string | null;
  plants: Plant[];
  recentPlantIds: string[];  // Last 3 accessed

  setCurrentView: (view: string) => void;
  setCurrentPlant: (plantId: string) => void;
  loadPlants: () => Promise<void>;
  getCurrentPlant: () => Plant | null;
}
```

### 5.4 Caching Strategy

```typescript
interface PlantDataCache {
  plantId: string;
  lines: ProductionLine[];
  models: ProductModel[];
  volumes: ProductVolume[];
  loadedAt: number;
}

// Keep cache for last 3 plants (LRU)
const plantDataCache: Map<string, PlantDataCache> = new Map();
```

### 5.5 New IPC Channels

```typescript
const PLANT_CHANNELS = {
  GET_ALL: 'plants:get-all',
  GET_BY_ID: 'plants:get-by-id',
  CREATE: 'plants:create',
  UPDATE: 'plants:update',
  DELETE: 'plants:delete',
  SET_DEFAULT: 'plants:set-default',
  GET_DEFAULT: 'plants:get-default',
};

const GLOBAL_ANALYSIS_CHANNELS = {
  GET_SUMMARY: 'global-analysis:get-summary',
  RUN_ALL_PLANTS: 'global-analysis:run-all-plants',
  GET_PLANT_COMPARISON: 'global-analysis:get-comparison',
};
```

---

## 6. Python Optimizer Changes

### 6.1 Input Structure (Per-Plant)

```python
{
  "plantId": "plant-123",
  "plantCode": "REY",
  "plantName": "Reynosa",
  "lines": [...],           # All for this plant
  "models": [...],          # All for this plant
  "volumes": [...],         # All for this plant
  "compatibilities": [...], # All for this plant
  "selectedYears": [2025, 2026],
  "changeover": {...}
}
```

### 6.2 Output Structure

```python
{
  "plantId": "plant-123",
  "plantCode": "REY",
  "plantName": "Reynosa",
  "executionTimeMs": 17,
  "yearResults": [
    {
      "year": 2025,
      "lineResults": [...],
      "areaResults": [...],
      "summary": {...}
    }
  ]
}
```

### 6.3 Global Analysis (Run All Plants)

```python
# Run optimizer for each plant, aggregate results
results = []
for plant in plants:
    plant_result = run_optimizer(plant.data)
    results.append(plant_result)

global_summary = aggregate_results(results)
```

---

## 7. Implementation Plan

### Sprint 1: Database Foundation ✅ (Completed 2026-02-01)

- [x] Create migration `010_multi_plant_support.sql`
- [x] Add `plants` table
- [x] Add `plant_id` to all existing tables
- [x] Create default plant and backfill existing data
- [x] Add compound indexes
- [x] Test migration on existing database

**Files Created:**
- `src/main/database/migrations/010_multi_plant_support.sql`
- `src/shared/types/plant.ts`

**Deliverable:** Database supports multi-plant, UI unchanged. ✅

### Sprint 2: Repository & IPC Layer ✅ (Completed 2026-02-01)

- [x] Create `PlantRepository` with CRUD operations
- [x] Add `findActiveByPlant()` to all repositories
- [x] Update IPC handlers to accept `plantId`
- [x] Add plant IPC channels
- [x] Update `DataExporter` for plant-scoped export
- [x] Add plant metadata to Python optimizer I/O

**Files Created:**
- `src/main/database/repositories/SQLitePlantRepository.ts`
- `src/main/ipc/handlers/plant.handler.ts`

**Files Modified:**
- `src/main/database/repositories/SQLiteProductionLineRepository.ts` - Added 10 plant-scoped methods
- `src/main/services/analysis/DataExporter.ts` - Plant-scoped export
- `src/domain/entities/ProductionLine.ts` - Added plantId field
- `src/shared/constants/index.ts` - Added PLANT_CHANNELS
- `src/preload.ts` - Exposed plant channels

**Deliverable:** Backend fully supports multi-plant. ✅

### Sprint 3: State Management ✅ (Completed 2026-02-01)

- [x] Add `currentPlantId` to `useNavigationStore`
- [x] Implement `usePlantStore` for plant CRUD operations
- [x] Persist plant selection to localStorage
- [ ] Update all data hooks to pass plantId (deferred to Sprint 4)

**Files Created:**
- `src/renderer/features/plants/store/usePlantStore.ts`
- `src/renderer/features/plants/index.ts`

**Files Modified:**
- `src/renderer/store/useNavigationStore.ts` - Added plant context

**Deliverable:** Frontend tracks plant context. ✅

### Sprint 4: Plant Selector UI ✅ (Completed 2026-02-01)

- [x] Add plant dropdown to sidebar
- [x] Create "All Plants" page with CRUD table
- [x] Add/Edit Plant modal
- [x] Plant switching with localStorage persistence
- [x] Plants nav item in sidebar (Cmd+5)
- [x] Initialize plant store on app startup

**Files Created:**
- `src/renderer/pages/PlantsPage.tsx`
- `src/renderer/features/plants/components/PlantList.tsx`
- `src/renderer/features/plants/components/PlantForm.tsx`
- `src/renderer/features/plants/components/DeletePlantModal.tsx`
- `src/renderer/features/plants/components/index.ts`

**Files Modified:**
- `src/renderer/store/useNavigationStore.ts` - Added 'plants' to AppView
- `src/renderer/components/layout/Sidebar.tsx` - Plant selector dropdown + Plants nav item
- `src/renderer/components/layout/AppLayout.tsx` - Plant store init + PlantsPage routing

**Deliverable:** Users can create, edit, delete, and switch between plants. ✅

### Sprint 5: Global Analysis ✅ (Completed 2026-02-01)

- [x] Create "Global Analysis" page with year selector
- [x] Network capacity overview with utilization bars
- [x] Summary cards (plants, lines, avg util, unfulfilled)
- [x] Alerts panel (critical/warning/info)
- [x] Plant comparison table with headroom
- [x] "Run All Plants" action with progress indicator
- [x] Analysis handler accepts plantId for plant-scoped runs

**Files Created:**
- `src/renderer/pages/GlobalAnalysisPage.tsx`
- `src/renderer/features/global-analysis/store/useGlobalAnalysisStore.ts`
- `src/renderer/features/global-analysis/index.ts`

**Files Modified:**
- `src/renderer/store/useNavigationStore.ts` - Added 'global-analysis' view
- `src/renderer/components/layout/Sidebar.tsx` - Added Global nav item (Cmd+6)
- `src/renderer/components/layout/AppLayout.tsx` - Added GlobalAnalysisPage routing
- `src/shared/types/index.ts` - Added plantId to RunOptimizationRequest
- `src/main/ipc/handlers/analysis.handler.ts` - Pass plantId to DataExporter

**Deliverable:** Corporate view of all plants with cross-plant comparison. ✅

### Sprint 6: Model Ownership ✅ (Completed 2026-02-01)

- [x] Database migration for launch_plant_id, primary_plant_id
- [x] Model plant assignments table
- [x] v_models_with_plants view
- [x] Updated ProductModelV2 entity with plant ownership
- [x] Updated ModelsPage table with Plant column
- [x] Ownership badges (Exclusive/Shared/Transferred)

**Files Created:**
- `src/main/database/migrations/011_model_plant_ownership.sql`

**Files Modified:**
- `src/domain/entities/ProductModelV2.ts` - Added launchPlantId, primaryPlantId
- `src/main/database/repositories/SQLiteProductModelV2Repository.ts` - Plant fields
- `src/renderer/features/models/components/ModelTable.tsx` - Plant column + badges

**Deliverable:** Model ownership tracking foundation. ✅

**Deferred to Phase 7.5:**
- [ ] "Assign to Plant" action
- [ ] Transfer wizard (move volume between plants)
- [ ] Before/after utilization comparison

---

## 8. Migration Strategy

### 8.1 Migration Script: `010_multi_plant_support.sql`

```sql
-- Phase 1: Create plants table
CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  timezone TEXT DEFAULT 'America/Chicago',
  currency_code CHAR(3) DEFAULT 'USD',
  default_operations_days INTEGER DEFAULT 240,
  default_shifts_per_day INTEGER DEFAULT 2,
  default_hours_per_shift REAL DEFAULT 8.0,
  color TEXT,
  is_default BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase 2: Insert default plant
INSERT INTO plants (id, code, name, region, is_default, is_active)
VALUES ('plant-default', 'DEFAULT', 'Default Plant', 'Default', 1, 1);

-- Phase 3: Add plant_id to existing tables
ALTER TABLE production_lines ADD COLUMN plant_id TEXT REFERENCES plants(id);
ALTER TABLE canvas_areas ADD COLUMN plant_id TEXT REFERENCES plants(id);
ALTER TABLE line_model_compatibilities ADD COLUMN plant_id TEXT REFERENCES plants(id);
ALTER TABLE product_models_v2 ADD COLUMN launch_plant_id TEXT REFERENCES plants(id);
ALTER TABLE product_models_v2 ADD COLUMN primary_plant_id TEXT REFERENCES plants(id);
ALTER TABLE product_models_v2 ADD COLUMN ownership_type TEXT DEFAULT 'exclusive';

-- Phase 4: Backfill existing data to default plant
UPDATE production_lines SET plant_id = 'plant-default' WHERE plant_id IS NULL;
UPDATE canvas_areas SET plant_id = 'plant-default' WHERE plant_id IS NULL;
UPDATE line_model_compatibilities
SET plant_id = (SELECT plant_id FROM production_lines WHERE id = line_model_compatibilities.line_id)
WHERE plant_id IS NULL;
UPDATE product_models_v2 SET launch_plant_id = 'plant-default', primary_plant_id = 'plant-default'
WHERE launch_plant_id IS NULL;

-- Phase 5: Create plant-specific volume table
CREATE TABLE IF NOT EXISTS plant_product_volumes (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  operations_days INTEGER NOT NULL DEFAULT 240,
  source TEXT DEFAULT 'migration',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(plant_id, model_id, year)
);

-- Phase 6: Migrate existing volumes
INSERT INTO plant_product_volumes (id, plant_id, model_id, year, volume, operations_days, source, created_at, updated_at)
SELECT
  'ppv-' || id,
  'plant-default',
  model_id,
  year,
  volume,
  operations_days,
  'migration',
  created_at,
  updated_at
FROM product_volumes;

-- Phase 7: Create plant-specific routing tables
CREATE TABLE IF NOT EXISTS plant_model_routing (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 1,
  expected_yield REAL NOT NULL DEFAULT 1.0,
  volume_fraction REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(plant_id, model_id, area_code)
);

CREATE TABLE IF NOT EXISTS plant_model_routing_predecessors (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  area_code TEXT NOT NULL,
  predecessor_area_code TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(plant_id, model_id, area_code, predecessor_area_code)
);

-- Phase 8: Migrate existing routings
INSERT INTO plant_model_routing (id, plant_id, model_id, area_code, sequence, is_required, expected_yield, volume_fraction, created_at, updated_at)
SELECT
  'pmr-' || id,
  'plant-default',
  model_id,
  area_code,
  sequence,
  is_required,
  expected_yield,
  volume_fraction,
  created_at,
  updated_at
FROM model_area_routing;

INSERT INTO plant_model_routing_predecessors (id, plant_id, model_id, area_code, predecessor_area_code, dependency_type, created_at)
SELECT
  'pmrp-' || id,
  'plant-default',
  model_id,
  area_code,
  predecessor_area_code,
  dependency_type,
  created_at
FROM model_area_predecessors;

-- Phase 9: Create indexes
CREATE INDEX IF NOT EXISTS idx_plants_code ON plants(code);
CREATE INDEX IF NOT EXISTS idx_plants_region ON plants(region);
CREATE INDEX IF NOT EXISTS idx_production_lines_plant ON production_lines(plant_id);
CREATE INDEX IF NOT EXISTS idx_canvas_areas_plant ON canvas_areas(plant_id);
CREATE INDEX IF NOT EXISTS idx_compatibilities_plant ON line_model_compatibilities(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_volumes_plant ON plant_product_volumes(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_volumes_model ON plant_product_volumes(model_id);
CREATE INDEX IF NOT EXISTS idx_plant_routing_plant ON plant_model_routing(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_routing_model ON plant_model_routing(model_id);

-- Phase 10: Update unique constraints
DROP INDEX IF EXISTS idx_production_lines_name;
CREATE UNIQUE INDEX idx_production_lines_name_plant
  ON production_lines(name, plant_id) WHERE active = 1;
```

### 8.2 Backward Compatibility

- Old queries without `plant_id` use default plant
- Existing IPC channels continue to work (use default plant)
- New channels added for multi-plant operations
- UI defaults to single-plant mode until user creates additional plants

---

## 9. Future Enhancements

### Phase 7.2: Model Transfer Wizard

- Step-by-step transfer workflow
- Compatibility estimation from similar models
- Before/after utilization simulation
- Transfer approval workflow

### Phase 7.3: Cross-Plant Optimization

- Global optimizer that allocates across plants
- Consider logistics costs, lead times
- Customer plant requirements
- Regional content compliance (USMCA, EU)

### Phase 7.4: Multi-Plant Scenarios

- What-if analysis across plants
- "Move 50% of Model X to Plant B"
- Compare scenarios side-by-side

### Phase 7.5: Risk Analysis

- Single-source model identification
- Plant down simulation
- Capacity overflow recommendations

---

## Appendix A: TypeScript Types

```typescript
// src/shared/types/plant.ts

export interface Plant {
  id: string;
  code: string;
  name: string;
  region?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  timezone: string;
  currencyCode: string;
  defaultOperationsDays: number;
  defaultShiftsPerDay: number;
  defaultHoursPerShift: number;
  color?: string;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlantInput {
  code: string;
  name: string;
  region?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  timezone?: string;
  currencyCode?: string;
  defaultOperationsDays?: number;
  color?: string;
  notes?: string;
}

export interface UpdatePlantInput extends Partial<CreatePlantInput> {
  isDefault?: boolean;
}

export type OwnershipType = 'exclusive' | 'shared' | 'transferred';

export interface ModelPlantAssignment {
  id: string;
  modelId: string;
  plantId: string;
  assignmentType: 'primary' | 'secondary' | 'overflow' | 'backup';
  status: 'proposed' | 'ramp_up' | 'active' | 'phasing_out' | 'inactive';
  assignmentStartDate?: string;
  productionStartDate?: string;
  phaseOutDate?: string;
  transferredFromPlantId?: string;
  transferReason?: string;
  notes?: string;
}

export interface GlobalAnalysisSummary {
  totalPlants: number;
  totalLines: number;
  totalModels: number;
  networkAverageUtilization: number;
  totalUnfulfilledDemand: number;
  plantSummaries: PlantUtilizationSummary[];
  alerts: GlobalAlert[];
}

export interface PlantUtilizationSummary {
  plantId: string;
  plantCode: string;
  plantName: string;
  lineCount: number;
  modelCount: number;
  averageUtilization: number;
  maxUtilization: number;
  constraintArea?: string;
  headroomPercent: number;
}

export interface GlobalAlert {
  type: 'warning' | 'critical' | 'info';
  plantId: string;
  plantCode: string;
  message: string;
  metric?: number;
}
```

---

## Appendix B: IPC Channel Definitions

```typescript
// src/shared/constants/index.ts

export const PLANT_CHANNELS = {
  GET_ALL: 'plants:get-all',
  GET_BY_ID: 'plants:get-by-id',
  GET_DEFAULT: 'plants:get-default',
  CREATE: 'plants:create',
  UPDATE: 'plants:update',
  DELETE: 'plants:delete',
  SET_DEFAULT: 'plants:set-default',
} as const;

export const GLOBAL_ANALYSIS_CHANNELS = {
  GET_SUMMARY: 'global-analysis:get-summary',
  RUN_ALL_PLANTS: 'global-analysis:run-all-plants',
  GET_PLANT_COMPARISON: 'global-analysis:get-comparison',
  EXPORT_REPORT: 'global-analysis:export-report',
} as const;
```

---

## Appendix C: File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/main/database/migrations/010_multi_plant_support.sql` | Database migration |
| `src/shared/types/plant.ts` | Plant TypeScript types |
| `src/main/database/repositories/SQLitePlantRepository.ts` | Plant CRUD |
| `src/main/ipc/handlers/plant.handler.ts` | Plant IPC handlers |
| `src/main/ipc/handlers/global-analysis.handler.ts` | Cross-plant analysis |
| `src/renderer/store/usePlantStore.ts` | Plant state (or extend useNavigationStore) |
| `src/renderer/pages/PlantsPage.tsx` | All Plants view |
| `src/renderer/pages/GlobalAnalysisPage.tsx` | Cross-plant dashboard |
| `src/renderer/features/plants/components/PlantSelector.tsx` | Sidebar dropdown |
| `src/renderer/features/plants/components/AddEditPlantModal.tsx` | Plant CRUD modal |

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/constants/index.ts` | Add PLANT_CHANNELS, GLOBAL_ANALYSIS_CHANNELS |
| `src/shared/types/index.ts` | Export plant types |
| `src/main/database/repositories/*.ts` | Add `plantId` parameter to methods |
| `src/main/ipc/handlers/*.ts` | Extract `plantId` from IPC calls |
| `src/main/services/analysis/DataExporter.ts` | Accept `plantId` parameter |
| `src/preload.ts` | Expose new channels |
| `src/renderer/store/useNavigationStore.ts` | Add `currentPlantId`, plant switching |
| `src/renderer/components/layout/Sidebar.tsx` | Add PlantSelector component |
| `Optimizer/optimizer.py` | Add plant metadata to input/output |

---

**End of Specification**
