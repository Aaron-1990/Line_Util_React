# Phase 5: Changeover Matrix Feature

**Date Started**: 2026-01-27
**Date Completed**: 2026-01-27
**Developer**: Aaron Zapata
**Status**: ✅ Complete (All Sub-Phases Implemented)

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [Three-Tier Resolution System](#three-tier-resolution-system)
4. [Database Schema](#database-schema)
5. [Excel Import Template](#excel-import-template)
6. [Probability-Weighted Formula](#probability-weighted-formula)
7. [Architecture (Strategy Pattern)](#architecture-strategy-pattern)
8. [UI/UX Design](#uiux-design)
9. [Implementation Plan](#implementation-plan)
10. [Files to Create](#files-to-create)
11. [Academic References](#academic-references)

---

## Overview

The Changeover Matrix feature captures the time required to switch production from one model to another on each production line. This data feeds into the optimizer to calculate **realistic** capacity utilization that accounts for changeover losses.

### Key Concepts

- **Changeover Time**: Time (in minutes) to switch a production line from Model A to Model B
- **Asymmetric**: A→B may differ from B→A (e.g., removing tooling vs. installing tooling)
- **Matrix**: An N×N grid where N = number of compatible models per line
- **Diagonal = 0**: Same model to same model requires no changeover

### Business Value

- Current optimizer assumes **zero changeover** (unrealistic)
- Real changeover can consume **5-15% of available time**
- This changes the answer to "Can we meet demand?" significantly
- Enables **SMED prioritization** (identify highest-impact changeovers to reduce)

---

## The Problem

### Current State (No Changeover Consideration)

```python
# Current formula
available_time = time_available_daily
max_units = available_time / adjusted_cycle_time
# Problem: Assumes 100% of time is for production
```

### Target State (With Changeover)

```python
# Enhanced formula
gross_available_time = time_available_daily
changeover_loss = calculate_changeover_loss(models_on_line, changeover_matrix)
net_available_time = gross_available_time - changeover_loss
max_units = net_available_time / adjusted_cycle_time
```

### Scale Challenge

A line with 20 compatible models has 20×20 = **400 cells** to fill.

**Solution**: Three-tier resolution with family defaults (enter ~25 values instead of 400).

---

## Three-Tier Resolution System

We store data in **3 tables in the SAME database** with a **priority lookup order**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SINGLE SQLite DATABASE                          │
│                                                                     │
│  Priority 3 (Lowest - Fallback)                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Table: user_preferences                                      │   │
│  │ key: changeover_default_minutes = 30                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                      │
│  Priority 2 (Medium - Family Defaults)                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Table: family_changeover_defaults                            │   │
│  │ from_family │ to_family │ changeover_minutes                 │   │
│  │ BEV2        │ PIM       │ 20                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                      │
│  Priority 1 (Highest - Line-Specific Override)                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Table: line_changeover_overrides                             │   │
│  │ line_id │ from_model_id │ to_model_id │ changeover_minutes   │   │
│  │ SMT-01  │ PIM 400V      │ BEV2-2 Dual │ 15                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Resolution Logic (Pseudocode)

```python
def get_changeover_time(line_id, from_model, to_model):
    # Step 1: Same model? Always 0
    if from_model.id == to_model.id:
        return 0

    # Step 2: Check line-specific override (HIGHEST PRIORITY)
    override = db.query(
        "SELECT changeover_minutes FROM line_changeover_overrides "
        "WHERE line_id = ? AND from_model_id = ? AND to_model_id = ?",
        [line_id, from_model.id, to_model.id]
    )
    if override:
        return override.changeover_minutes

    # Step 3: Check family default (MEDIUM PRIORITY)
    family_default = db.query(
        "SELECT changeover_minutes FROM family_changeover_defaults "
        "WHERE from_family = ? AND to_family = ?",
        [from_model.family, to_model.family]
    )
    if family_default:
        return family_default.changeover_minutes

    # Step 4: Global default (FALLBACK)
    return get_preference('changeover_default_minutes', default=30)
```

### Why Three Tiers?

| Tier | Purpose | Data Size |
|------|---------|-----------|
| Global Default | Fallback when nothing else matches | 1 value |
| Family Defaults | Covers 95% of cases with minimal entry | F² rows (~25 for 5 families) |
| Line Overrides | Exceptions where line differs from family | Sparse (~20-50 rows) |

**Result**: Instead of entering 2,025 values (45×45 models), enter ~50-75 values.

---

## Database Schema

### Migration: `005_changeover_times.sql`

```sql
-- ============================================
-- TABLE 1: User Preferences (includes global default)
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default changeover settings
INSERT OR IGNORE INTO user_preferences (id, key, value, description) VALUES
  ('pref-changeover-default', 'changeover_default_minutes', '30',
   'Default changeover time when no family or line-specific value exists'),
  ('pref-changeover-method', 'changeover_calculation_method', 'probability_weighted',
   'Calculation method: probability_weighted, tsp_optimal, worst_case, simple_average');

-- ============================================
-- TABLE 2: Family Changeover Defaults
-- ============================================
CREATE TABLE IF NOT EXISTS family_changeover_defaults (
  id TEXT PRIMARY KEY,
  from_family TEXT NOT NULL,
  to_family TEXT NOT NULL,
  changeover_minutes INTEGER NOT NULL CHECK(changeover_minutes >= 0),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_family, to_family)
);

CREATE INDEX idx_family_changeover_pair
  ON family_changeover_defaults(from_family, to_family);

-- ============================================
-- TABLE 3: Line Changeover Overrides (Sparse)
-- ============================================
CREATE TABLE IF NOT EXISTS line_changeover_overrides (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  from_model_id TEXT NOT NULL,
  to_model_id TEXT NOT NULL,
  changeover_minutes INTEGER NOT NULL CHECK(changeover_minutes >= 0),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (from_model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  FOREIGN KEY (to_model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(line_id, from_model_id, to_model_id)
);

CREATE INDEX idx_line_changeover_line ON line_changeover_overrides(line_id);

-- ============================================
-- TABLE 4: Changeover Method Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS changeover_method_configs (
  id TEXT PRIMARY KEY,
  method_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  config_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert available methods
INSERT OR IGNORE INTO changeover_method_configs (id, method_id, enabled, description) VALUES
  ('method_probability_weighted', 'probability_weighted', 1,
   'Probability-weighted heuristic based on demand mix'),
  ('method_tsp_optimal', 'tsp_optimal', 0,
   'TSP-based optimal sequence (not implemented yet)'),
  ('method_worst_case', 'worst_case', 0,
   'Conservative worst-case estimate (not implemented yet)'),
  ('method_simple_average', 'simple_average', 1,
   'Simple average fallback method');
```

---

## Excel Import Template

### Existing Sheets (Already Implemented)

| Sheet | Table |
|-------|-------|
| Lines | production_lines |
| Models | product_models_v2 |
| Compatibilities | line_model_compatibilities |
| Areas | area_catalog |

### NEW Sheet 5: "Changeover Defaults"

**Purpose**: Family-to-family default changeover times.

| Column | Required | Type | Description |
|--------|----------|------|-------------|
| From Family | Yes | Text | Source product family (must match model.family) |
| To Family | Yes | Text | Target product family |
| Changeover (min) | Yes | Integer | Time in minutes (>= 0) |
| Notes | No | Text | Optional notes |

**Example Data**:

| From Family | To Family | Changeover (min) | Notes |
|-------------|-----------|------------------|-------|
| BEV2 | BEV2 | 5 | Same family, minor setup |
| BEV2 | PIM | 20 | Different family |
| BEV2 | GPIM | 25 | Major change |
| PIM | BEV2 | 18 | Asymmetric (different from BEV2→PIM) |
| PIM | PIM | 8 | Same family |
| PIM | GPIM | 22 | |
| GPIM | BEV2 | 28 | |
| GPIM | PIM | 24 | |
| GPIM | GPIM | 10 | Same family |

**For 5 families**: 5×5 = 25 rows covers ALL model combinations.

### NEW Sheet 6: "Changeover Overrides"

**Purpose**: Line-specific exceptions that differ from family defaults.

| Column | Required | Type | Description |
|--------|----------|------|-------------|
| Line Name | Yes | Text | Must exist in Lines sheet |
| From Model | Yes | Text | Must exist in Models sheet |
| To Model | Yes | Text | Must exist in Models sheet |
| Changeover (min) | Yes | Integer | Time in minutes (>= 0) |
| Notes | No | Text | Optional notes |

**Example Data**:

| Line Name | From Model | To Model | Changeover (min) | Notes |
|-----------|------------|----------|------------------|-------|
| SMT-01 | PIM 400V | BEV2-2 Dual | 15 | Optimized fixture |
| SMT-01 | BEV2-2 Dual | PIM 400V | 17 | Reverse direction |
| SMT-03 | GPIM | PIM 400V | 30 | Slow jig change |
| ICT-01 | BEV2-2 Single | BEV2-2 Dual | 2 | Quick program swap |

**Key Point**: Only enter values that DIFFER from the family default. This is sparse storage.

### Validation Rules

1. From/To Family must exist in Models sheet (family column)
2. Line Name must exist in Lines sheet
3. From/To Model must exist in Models sheet
4. Models must be compatible with the line (in Compatibilities sheet)
5. Changeover minutes must be >= 0
6. Diagonal (Model A → Model A) must be 0 or omitted
7. Duplicate pairs are rejected

---

## Probability-Weighted Formula

### The Problem with Simple Average

```python
# Simple average (WRONG - loses detail)
avg_changeover = sum(all_changeover_times) / count
total_loss = num_changeovers * avg_changeover
# This treats all transitions equally, ignoring production mix
```

### Probability-Weighted Approach (CORRECT)

The probability of transitioning FROM model i TO model j depends on their demand shares:

```
P(transition i→j) ≈ P(producing i) × P(next is j)
                  = (Demand[i] / Total) × (Demand[j] / Total)
```

### Step-by-Step Calculation

**Given**:
- 4 models: A (40%), B (30%), C (20%), D (10%) of daily demand
- Changeover matrix with specific times for each pair

**Step 1: Calculate demand proportions**
```
P[A] = 200 / 500 = 0.40
P[B] = 150 / 500 = 0.30
P[C] = 100 / 500 = 0.20
P[D] =  50 / 500 = 0.10
```

**Step 2: Calculate HHI (concentration index)**
```
HHI = P[A]² + P[B]² + P[C]² + P[D]²
    = 0.40² + 0.30² + 0.20² + 0.10²
    = 0.16 + 0.09 + 0.04 + 0.01
    = 0.30
```

**Step 3: Calculate weighted contribution for each transition**
```
Weighted[i→j] = P[i] × P[j] × ChangeoverTime[i,j]

Example:
A→B: 0.40 × 0.30 × 15 min = 1.80 weighted minutes
C→A: 0.20 × 0.40 × 60 min = 4.80 weighted minutes (highest!)
```

**Step 4: Sum all weighted contributions**
```
Weighted Sum = Σ (P[i] × P[j] × Time[i,j]) for all i≠j
             = 21.15 minutes (unnormalized)
```

**Step 5: Normalize by (1 - HHI)**
```
Expected per changeover = Weighted Sum / (1 - HHI)
                        = 21.15 / 0.70
                        = 30.21 minutes
```

**Step 6: Multiply by number of changeovers**
```
Total changeover loss = 30.21 × 3 changeovers = 90.63 minutes/day
```

### Why (1 - HHI)?

- HHI = probability of staying on same model (no transition)
- (1 - HHI) = probability of actually switching models
- We normalize because we only care about WHEN we switch

### SMED Priority Analysis

Sort transitions by **weighted contribution** to identify improvement priorities:

| Rank | Transition | Time | Probability | Contribution | % of Total |
|------|------------|------|-------------|--------------|------------|
| 1 | C → A | 60 min | 8% | 4.80 | **23%** |
| 2 | A → C | 45 min | 8% | 3.60 | **17%** |
| 3 | C → B | 35 min | 6% | 2.10 | 10% |

**Insight**: C↔A transitions account for 40% of changeover loss. Focus SMED efforts there.

### Formula Summary

```
                    Σ P[i] × P[j] × ChangeoverTime[i,j]
Expected/Change = ─────────────────────────────────────
                              (1 - HHI)

Total Loss = Expected/Change × Number of Changeovers
```

---

## Architecture (Strategy Pattern)

The system supports **multiple calculation methods** via the Strategy Pattern. Users can select which method to use.

### Available Methods

| Method ID | Name | Status | Use Case |
|-----------|------|--------|----------|
| `probability_weighted` | Probability-Weighted | ✅ Implemented | Default for planning |
| `tsp_optimal` | TSP Optimal Sequence | 🔲 Future | Find best sequence |
| `worst_case` | Worst Case | 🔲 Future | Conservative buffer |
| `simple_average` | Simple Average | ✅ Implemented | Fallback |

### Adding a New Method

1. Create new Python class extending `ChangeoverCalculator`
2. Implement `calculate()` method
3. Register in `ChangeoverMethodRegistry`
4. Add TypeScript type to `ChangeoverMethodId` union

**No changes to existing code required** (Open/Closed Principle).

### Python Class Structure

```python
# Optimizer/changeover/base.py
class ChangeoverCalculator(ABC):
    @property
    @abstractmethod
    def method_id(self) -> str: pass

    @abstractmethod
    def calculate(self, line_id, assigned_models, changeover_matrix, ...) -> ChangeoverResult: pass

# Optimizer/changeover/methods.py
class ProbabilityWeightedCalculator(ChangeoverCalculator):
    method_id = 'probability_weighted'

    def calculate(self, ...):
        # Implementation here

# Auto-register
ChangeoverMethodRegistry.register(ProbabilityWeightedCalculator)
```

### TypeScript Types

```typescript
// src/shared/types/changeover.ts

type ChangeoverMethodId =
  | 'probability_weighted'
  | 'tsp_optimal'
  | 'worst_case'
  | 'simple_average';

interface ChangeoverResult {
  lineId: string;
  methodUsed: ChangeoverMethodId;
  timeUsedProduction: number;
  timeUsedChangeover: number;
  utilizationWithChangeover: number;
  changeoverImpactPercent: number;
  estimatedChangeoverCount: number;
  topCostlyTransitions: TransitionAnalysis[];
}
```

---

## UI/UX Design

### Access Point: Canvas Node

```
┌────────────────────────────────────┐
│ ● SMT Line 1              [⏱]     │  ← Changeover button
│ Area: SMT                          │
│ Time: 16.0h/day                    │
│ 📦 12 models                       │
└────────────────────────────────────┘
```

### Matrix Editor Modal

**Family View (Default - Collapsed)**:
```
┌────────────────────────────────────────────────────────────────────┐
│ Changeover Times - SMT Line 1                              [✕]     │
├────────────────────────────────────────────────────────────────────┤
│ [Family View] [Model View]    Default: [5] min   [Import] [Export]│
├────────────────────────────────────────────────────────────────────┤
│             │  FamilyA  │  FamilyB  │  FamilyC  │  FamilyD        │
├─────────────┼───────────┼───────────┼───────────┼─────────────────┤
│ FamilyA (8) │     0     │   5 min*  │   8 min   │   5 min*        │
│ FamilyB (12)│   7 min   │     0     │   5 min*  │   5 min*        │
│ FamilyC (5) │   6 min   │   8 min   │     0     │   5 min*        │
│ FamilyD (3) │   5 min*  │  12 min⚠  │   5 min*  │     0           │
├────────────────────────────────────────────────────────────────────┤
│ Legend:  0 = Same (no changeover)  * = Using default  ⚠ = >10 min │
└────────────────────────────────────────────────────────────────────┘
```

**Model View (Expanded - Click family to drill down)**:
```
┌────────────────────────────────────────────────────────────────────┐
│ Changeover Times - SMT Line 1 › Family A                   [✕]     │
├────────────────────────────────────────────────────────────────────┤
│             │  A-001  │  A-002  │  A-003  │  B-001  │  B-002      │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ A-001       │    0    │  [3.5]  │  [4.2]  │  [7.5]  │  [8.0]      │
│ A-002       │  [4.1]  │    0    │  [3.8]  │  [8.0]  │  [7.5]      │
│ A-003       │  [5.0]  │  [4.5]  │    0    │  [7.8]  │  [8.2]      │
│ B-001       │  [8.5]  │  [9.0]  │  [8.2]  │    0    │  [2.0]      │
│ B-002       │  [7.9]  │  [8.5]  │  [8.0]  │  [2.5]  │    0        │
├────────────────────────────────────────────────────────────────────┤
│ Keyboard: Tab to move, Enter to edit, Esc to cancel               │
└────────────────────────────────────────────────────────────────────┘
```

### Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| `0` | Same model (diagonal, always 0) |
| `*` | Using family/global default |
| `⚠` | Exceeds SMED benchmark (>10 min) |
| Gray cell | Disabled (diagonal) |
| Blue cell | Custom value (override) |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Next cell (skip diagonal) |
| Shift+Tab | Previous cell |
| Arrow keys | Navigate grid |
| Enter | Edit cell |
| Escape | Cancel edit |
| Ctrl+S | Save all changes |

---

## Implementation Plan

### Phase 5.1: Foundation (Database + Backend) ✅ Complete

| Task | File | Status | Description |
|------|------|--------|-------------|
| 1 | `src/shared/types/changeover.ts` | ✅ | TypeScript interfaces |
| 2 | `src/main/database/migrations/005_changeover.sql` | ✅ | DB migration |
| 3 | `src/main/database/migrations/006_fix_changeover_view.sql` | ✅ | View fix migration |
| 4 | `src/main/database/repositories/SQLiteChangeoverRepository.ts` | ✅ | Data access |
| 5 | `src/main/ipc/handlers/changeover.handler.ts` | ✅ | IPC handlers |
| 6 | `src/shared/constants/index.ts` | ✅ | CHANGEOVER_CHANNELS added |
| 7 | `src/preload.ts` | ✅ | Channels registered for security |

### Phase 5.2: UI Components ✅ Complete

| Task | File | Status | Description |
|------|------|--------|-------------|
| 8 | `src/renderer/features/changeover/store/useChangeoverStore.ts` | ✅ | Zustand store |
| 9 | `src/renderer/features/changeover/components/ChangeoverMatrixModal.tsx` | ✅ | Main modal |
| 10 | Canvas node integration | ✅ | Changeover button on nodes |

### Phase 5.3: Excel Import ✅ Complete

| Task | File | Status | Description |
|------|------|--------|-------------|
| 11 | `src/shared/types/index.ts` | ✅ | Changeover import types |
| 12 | `src/main/services/excel/MultiSheetImporter.ts` | ✅ | Detect "Changeover" sheet |
| 13 | `src/main/services/excel/MultiSheetValidator.ts` | ✅ | Validate changeover data |
| 14 | `src/main/ipc/handlers/multi-sheet-excel.handler.ts` | ✅ | Import changeover data |
| 15 | Test fixture with changeover data | ✅ | 433 family-to-family entries |

**Excel Import Details:**
- Sheet detection patterns: `['changeover', 'changeovers', 'cambio', 'cambios', 'setup', 'setups']`
- Required columns: `From Family`, `To Family`, `Changeover (min)`
- Optional column: `Notes`
- Validation: Checks for valid families, valid minutes (0-480), no duplicates

### Phase 5.4: Optimizer Integration ✅ Complete

| Task | File | Status | Description |
|------|------|--------|-------------|
| 16 | `src/main/services/analysis/DataExporter.ts` | ✅ | Export changeover data to Python |
| 17 | `Optimizer/optimizer.py` | ✅ | Calculate changeover impact |
| 18 | `src/renderer/features/analysis/components/ResultsPanel.tsx` | ✅ | Show changeover impact |

**Optimizer Integration Details:**
- Changeover data exported as part of analysis input
- Python optimizer calculates time lost to changeovers per line
- Results panel displays changeover impact metrics

---

## Files to Create

```
src/shared/types/changeover.ts                    # TypeScript types
src/shared/constants/changeover.ts                # IPC channels

src/main/database/migrations/005_changeover.ts    # DB schema
src/main/database/repositories/ChangeoverRepository.ts
src/main/ipc/handlers/changeover.handler.ts
src/main/services/changeover/ChangeoverService.ts

src/renderer/features/changeover/
├── index.ts
├── store/
│   └── useChangeoverStore.ts
├── components/
│   ├── ChangeoverButton.tsx
│   ├── ChangeoverMatrixModal.tsx
│   ├── MatrixTable.tsx
│   ├── MatrixCell.tsx
│   ├── FamilyView.tsx
│   ├── ModelView.tsx
│   └── ImportExportPanel.tsx
└── hooks/
    ├── useChangeoverMatrix.ts
    └── useKeyboardNavigation.ts

Optimizer/changeover/
├── __init__.py
├── base.py
├── registry.py
├── methods.py
└── utils.py
```

---

## Academic References

### Well-Documented Concepts

| Concept | Source | Notes |
|---------|--------|-------|
| HHI (Herfindahl-Hirschman Index) | Herfindahl (1950), Hirschman | Economics - market concentration |
| TSP for sequencing | Pinedo "Scheduling" Ch. 4.4 | Operations Research |
| SMED | Shigeo Shingo (1985) | Practitioner methodology |
| Expected value | Basic probability theory | Any statistics textbook |

### The Combined Formula

The probability-weighted formula:
```
E[changeover] = Σ P[i] × P[j] × C[i,j] / (1 - HHI)
```

**Is NOT documented in academic literature** as a unified methodology. It's an engineering heuristic that combines:
- Probability theory (expected value)
- Economics (HHI for concentration)
- Manufacturing context (changeover times)

**Should be presented as**: "Engineering approximation for capacity planning" rather than an academically validated model.

**The academically rigorous approach** for optimal changeover scheduling is **TSP/ATSP** (Traveling Salesman Problem).

---

## Implementation Summary

### What Was Built

1. **Three-Tier Resolution System**: Global default (30 min) → Family defaults → Line overrides
2. **Excel Import**: Auto-detects "Changeover" sheet and imports family-to-family defaults
3. **UI Modal**: View and edit changeover matrix per line via canvas node
4. **Optimizer Integration**: Changeover time is subtracted from available production time
5. **Results Display**: ResultsPanel shows changeover impact on utilization

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Family defaults from Excel | Reduces data entry from N×N models to F×F families |
| Line overrides in UI | Equipment-specific exceptions are entered per-line |
| Sparse storage | Only store overrides that differ from family defaults |
| Single database | All three tiers in SQLite, resolved via COALESCE in view |

### Database Tables Created

```sql
user_preferences              -- Global settings (changeover_default_minutes, smed_benchmark)
family_changeover_defaults    -- Family-to-family baseline times
line_changeover_overrides     -- Line-specific exceptions (sparse)
changeover_method_configs     -- Calculation method preferences
v_resolved_changeover_times   -- View that resolves three-tier hierarchy
```

### Bugs Fixed During Implementation

| Bug | Fix |
|-----|-----|
| `Invalid IPC channel: changeover:get-matrix` | Added CHANGEOVER_CHANNELS to preload.ts |
| `no such column: lmc.active` | Created migration 006 to fix view definition |

---

## Phase 5.5: Changeover Enhancements (2026-01-27)

### Bug Fixes

| Bug | Fix |
|-----|-----|
| Double-keypress in matrix editor | Replaced `useEffect` focus with callback ref for immediate input focus |

### UI Improvements: Calculation Method Selector

Users can now select the changeover calculation method directly in the Changeover Modal:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ View: [By Family][By Model]   🧮 Method: [▼ Probability-Weighted    ]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Available Methods:**

| Method | Description | Use Case |
|--------|-------------|----------|
| Probability-Weighted | Weights by demand mix (P[i] × P[j]) | Default for capacity planning |
| Simple Average | Arithmetic mean of all changeover times | Fallback when demand unknown |
| Worst Case | Uses maximum changeover time | Conservative risk analysis |

### Algorithm Improvement: Effective Model Count Heuristic

**Problem:** The original heuristic `num_changeovers = N - 1` was too simplistic. It didn't account for demand concentration.

**Solution:** Use Effective Model Count based on HHI (Herfindahl-Hirschman Index):

```python
# Calculate HHI (concentration index)
HHI = Σ P[i]²  # Where P[i] = demand proportion for model i

# Effective number of equal-sized models
N_eff = 1 / HHI

# Base changeover count
estimated_changeovers = N_eff - 1

# Apply practical bounds
estimated_changeovers = min(
    N_eff - 1,
    actual_models - 1,      # Can't exceed actual models
    available_hours - 1,    # Lot size constraint (1hr min)
    12                      # Practical daily limit
)
```

**Behavior Examples:**

| Scenario | Models | HHI | N_eff | Changeovers/day |
|----------|--------|-----|-------|-----------------|
| Balanced (5×20%) | 5 | 0.20 | 5.0 | 4.0 |
| Dominated (70/10/10/5/5) | 5 | 0.51 | 1.9 | 1.0 |
| Near-single (90/5/5) | 3 | 0.82 | 1.2 | 1.0 |
| High-mix (10×10%) | 10 | 0.10 | 10.0 | 9.0 |

**Theory:** This formula is grounded in economics (numbers equivalent) and information theory. It naturally adjusts for demand concentration - if one model dominates (high HHI), fewer changeovers are needed.

### Algorithm Improvement: Changeover as Capacity Constraint

**Problem:** Previously, changeover was calculated as an informational metric only. It showed "+X% impact" but didn't actually reduce production capacity.

**Solution:** Two-phase allocation with capacity adjustment:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Initial Allocation                                             │
│ • Allocate models to lines by priority                                  │
│ • Uses full available time                                              │
│ • Tracks initial unfulfilled demand                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Changeover Capacity Constraints                                │
│ • Calculate expected changeover time for each line                      │
│ • If (production + changeover) > available time:                        │
│   - Scale down production proportionally                                │
│   - Track reduction as additional unfulfilled demand                    │
│ • Recalculate changeover with adjusted assignments                      │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Results & Constraint Analysis                                  │
│ • Final utilization includes changeover impact                          │
│ • Identify system constraints                                           │
│ • Build output JSON                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Example Impact:**

```
Line: SMT-1 (57,600s = 16 hours available)
├─ Initial allocation: 50,400s production (87.5%)
├─ Changeover calculated: 10,800s (3 hours)
├─ Total needed: 61,200s > 57,600s available
├─ OVER CAPACITY → Scale factor = 0.77
├─ Final production: 38,808s
├─ Changeover: 8,316s (recalculated with fewer models)
├─ Total: 47,124s (81.8% utilization)
└─ Additional unfulfilled demand tracked
```

### New Output Fields

The optimizer now returns additional metrics for transparency:

```json
{
  "changeover": {
    "timeUsedChangeover": 10800.0,
    "estimatedChangeoverCount": 3.33,
    "expectedChangeoverTime": 3240.0,
    "utilizationWithChangeover": 95.5,
    "changeoverImpactPercent": 8.2,
    "methodUsed": "probability_weighted",
    "hhi": 0.30,
    "effectiveModels": 3.33,
    "capacityAdjusted": true
  }
}
```

| Field | Description |
|-------|-------------|
| `hhi` | Herfindahl-Hirschman Index (0-1, higher = more concentrated) |
| `effectiveModels` | Numbers equivalent = 1/HHI |
| `capacityAdjusted` | `true` if production was scaled down due to changeover |

### Files Modified

| File | Change |
|------|--------|
| `Optimizer/optimizer.py` | Added `apply_changeover_capacity_reduction()` function |
| `src/renderer/features/changeover/components/ChangeoverMatrixModal.tsx` | Added method selector dropdown |
| `src/renderer/features/changeover/components/MatrixTable.tsx` | Fixed input focus with callback ref |
| `src/renderer/features/changeover/components/FamilyMatrixView.tsx` | Fixed input focus with callback ref |
| `src/renderer/features/changeover/store/useChangeoverStore.ts` | Added `setCalculationMethod` action |

---

## Next Steps (Future Phases)

### Phase 6: Enhanced Visualization
- [ ] Canvas nodes colored by utilization (green/yellow/red)
- [ ] Process flow visualization (connections/arrows between areas)

### Phase 7: Scenario Management
- [ ] Save/load analysis scenarios
- [ ] Compare scenarios side-by-side
- [ ] What-if analysis (change volumes, changeover times)

### Phase 8: Reports & Export
- [ ] PDF report generation (executive summary)
- [ ] Excel export (detailed results)
- [ ] SMED priority report (top costly transitions)

### Phase 9: Advanced Features
- [ ] Progress streaming from Python to UI
- [ ] TSP-optimal sequencing method
- [ ] Multi-year analysis dashboard
- [ ] Line balancing suggestions

---

## Related Documents

- [Phase 3.5 Summary](./phase-3.5-summary.md) - Analysis Control Bar
- [Optimizer Algorithm](../../Optimizer/optimizer.py) - Current optimizer
- [Optimizer Changelog](../../Optimizer/CHANGELOG.md) - Algorithm history

---

**Document Version**: 2.1
**Last Updated**: 2026-01-27
**Phase Status**: ✅ Complete (including Phase 5.5 enhancements)
