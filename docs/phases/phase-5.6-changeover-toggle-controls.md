# Phase 5.6: Changeover Toggle Controls

**Date Started**: 2026-01-28
**Date Completed**: 2026-01-28
**Developer**: Aaron Zapata
**Status**: ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Business Value](#business-value)
3. [Feature Specification](#feature-specification)
4. [Toggle Hierarchy Logic](#toggle-hierarchy-logic)
5. [UI Design](#ui-design)
6. [Stacked Bar Visualization](#stacked-bar-visualization)
7. [Database Changes](#database-changes)
8. [Implementation Plan](#implementation-plan)
9. [Files to Modify](#files-to-modify)

---

## Overview

Phase 5.6 adds toggle controls for changeover calculation at two levels:

1. **Global Toggle**: Enable/disable changeover calculation for the entire analysis
2. **Per-Line Toggle**: Enable/disable changeover calculation for specific lines

This allows users to compare theoretical capacity (no changeover) vs. realistic capacity (with changeover), and to surgically include/exclude changeover on specific lines.

### Key Concepts

- **Theoretical Capacity**: Available time without changeover losses (Global OFF)
- **Demonstrated Capacity**: Available time with changeover losses (Global ON)
- **Critical Override**: Include changeover on specific lines even when global is OFF
- **Exclusion Override**: Exclude changeover on automated/negligible lines when global is ON

---

## Business Value

### IE Agent Validation

This feature aligns with world-class capacity planning practices used at Toyota, Bosch, and other benchmark plants. They use **"layered constraint visibility"** - the ability to see capacity at different levels of realism.

### The Three Capacity Views (Industry Standard)

| View | What It Shows | Use Case |
|------|---------------|----------|
| **Theoretical Capacity** | Zero losses (no changeover) | Equipment specification, investment justification |
| **Demonstrated Capacity** | With changeover losses | Normal planning baseline |
| **Effective Capacity** | All losses included | Realistic scheduling |

### SMED Business Case

The **delta between Global ON and Global OFF** is the SMED (Single-Minute Exchange of Dies) business case:

```
Capacity Gap Analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Theoretical:  ████████████████████████████████████  100%
With CO:      ██████████████████████████████        85%
                                      ▲
                                      └── This 15% gap is your
                                          SMED improvement opportunity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Use Cases

| Scenario | Global | Line | Purpose |
|----------|--------|------|---------|
| Theoretical analysis | OFF | - | See best-case capacity |
| Realistic planning | ON | ON | Normal capacity planning |
| Automated line exclusion | ON | OFF | Line has negligible changeover |
| Critical bottleneck focus | OFF | ON | See impact of one critical line |

---

## Feature Specification

### 1. Global Toggle (Analysis Control Bar)

- **Location**: Near "Run Analysis" button in Analysis Control Bar
- **Label**: "Include Changeover" or similar
- **Default State**: ON (realistic capacity by default)
- **Behavior**: When OFF, all lines ignore changeover (theoretical view)
- **Persistence**: Saved to `user_preferences` table

### 2. Per-Line Toggle (Canvas Nodes)

- **Location**: Icon on each production line node (🔄 or similar)
- **Style**: Option A - Clean icon toggle (clickable)
- **Visual States**:
  - Filled/solid: Changeover enabled for this line
  - Outline/dimmed: Changeover disabled for this line
- **Behavior**: True override - works in both directions
- **Persistence**: Saved to `production_lines` table (new column)

### 3. Stacked Bar Visualization (Canvas Nodes)

After analysis runs, each canvas node displays a stacked bar showing time allocation:

```
┌─────────────────────────────────────┐
│  SMT Line 1                🔴 🔄   │
│  ██████████████░░░░░░░░░░  87%     │
│   Production  CO    Available      │
│     70.5%    16.5%    13%          │
└─────────────────────────────────────┘
```

---

## Toggle Hierarchy Logic

The per-line toggle is a **true override** that works in both directions:

| Global | Line | Result | Use Case |
|--------|------|--------|----------|
| OFF | OFF | No changeover | Theoretical capacity (default when global OFF) |
| OFF | **ON** | **Changeover calculated** | Critical bottleneck override |
| ON | OFF | No changeover | Automated/negligible line exclusion |
| ON | ON | Changeover calculated | Realistic capacity (default when global ON) |

### Algorithm Pseudocode

```python
def should_calculate_changeover(global_enabled: bool, line_enabled: bool) -> bool:
    """
    Determine if changeover should be calculated for this line.
    Per-line toggle is a TRUE OVERRIDE in both directions.
    """
    if global_enabled:
        # Global ON: Line toggle can exclude specific lines
        return line_enabled
    else:
        # Global OFF: Line toggle can include critical lines
        return line_enabled  # Only if explicitly enabled
```

### Default States

| Setting | Default | Rationale |
|---------|---------|-----------|
| Global Toggle | ON | Avoid committing to impossible volumes |
| Per-Line Toggle | ON | Match global behavior by default |

---

## UI Design

### Global Toggle (Analysis Control Bar)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Analysis Control Bar                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Year: [2025 ▼]   Days: [247]   [🔄 Changeover: ON]  [▶ Run Analysis]│
└─────────────────────────────────────────────────────────────────────┘
```

### Per-Line Toggle (Canvas Node - Option A: Clean Icon)

**Changeover Enabled (Default):**
```
┌─────────────────────────────────────┐
│  SMT Line 1                🔴 🔄   │  ← 🔄 solid = enabled
│  ██████████████░░░░░░░░░░  87%     │
│   70.5%      16.5%    13%          │
└─────────────────────────────────────┘
```

**Changeover Disabled:**
```
┌─────────────────────────────────────┐
│  SMT Line 1                   ○🔄  │  ← ○🔄 outline = disabled
│  ██████████████████░░░░░░░  87%    │
│   87.0%            13%             │  ← No changeover segment
└─────────────────────────────────────┘
```

### Hover Tooltip (Detailed Breakdown)

```
┌─────────────────────────────────────┐
│  Production:  338 min (70.5%)      │
│  Changeover:   79 min (16.5%)      │
│    └─ 3.2 changes × 25 min avg     │
│  Available:    63 min (13.0%)      │
│  ─────────────────────────────     │
│  Total:       480 min              │
│  Models: 5 (N_eff: 3.2)            │
│                                     │
│  Click 🔄 to toggle changeover     │
└─────────────────────────────────────┘
```

---

## Stacked Bar Visualization

### Color Scheme (Industrial Standard)

| Segment | Color | Hex Code | Rationale |
|---------|-------|----------|-----------|
| **Production Time** | Blue | `#3B82F6` | Neutral - avoids "green = good" bias |
| **Changeover Time** | Amber | `#F59E0B` | Universal caution color |
| **Available Capacity** | Light Gray | `#E5E7EB` | Unused potential |

### Node Border Color (Utilization Threshold)

| Total Utilization | Border Color | Hex | Meaning |
|-------------------|--------------|-----|---------|
| < 70% | Gray | `#9CA3AF` | Underutilized |
| 70-85% | Blue | `#3B82F6` | Healthy operating range |
| 85-95% | Amber | `#F59E0B` | Approaching constraint |
| > 95% | Red | `#EF4444` | At/over capacity |

### Constraint Indicator

Lines identified as system constraints display a red dot (🔴) in the header:

```
│  SMT Line 1                🔴 🔄   │  ← 🔴 = constraint
```

---

## Database Changes

### New Column: `production_lines.changeover_enabled`

```sql
-- Migration: 007_changeover_toggles.sql

-- Add per-line changeover toggle
ALTER TABLE production_lines
ADD COLUMN changeover_enabled INTEGER NOT NULL DEFAULT 1;

-- Add global changeover toggle to user_preferences
INSERT OR IGNORE INTO user_preferences (id, key, value, description) VALUES
  ('pref-changeover-global-enabled', 'changeover_global_enabled', '1',
   'Global toggle for changeover calculation (1=ON, 0=OFF)');
```

### Schema After Migration

```sql
-- production_lines table
production_lines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  time_available_daily REAL NOT NULL,
  active INTEGER DEFAULT 1,
  changeover_enabled INTEGER DEFAULT 1,  -- NEW: Per-line toggle
  created_at DATETIME,
  updated_at DATETIME
)

-- user_preferences table
user_preferences (
  ...
  changeover_global_enabled: '1',  -- NEW: Global toggle
  changeover_default_minutes: '30',
  ...
)
```

---

## Implementation Plan

### Phase 5.6.1: Database & Backend

| Task | File | Description |
|------|------|-------------|
| 1 | `src/main/database/migrations/007_changeover_toggles.sql` | Add toggle columns |
| 2 | `src/main/database/repositories/SQLiteLineRepository.ts` | Add `updateChangeoverEnabled()` |
| 3 | `src/main/database/repositories/SQLitePreferencesRepository.ts` | Add global toggle methods |
| 4 | `src/main/ipc/handlers/line.handler.ts` | Add IPC for per-line toggle |
| 5 | `src/main/ipc/handlers/preferences.handler.ts` | Add IPC for global toggle |
| 6 | `src/shared/types/index.ts` | Update `ProductionLine` interface |

### Phase 5.6.2: Optimizer Integration

| Task | File | Description |
|------|------|-------------|
| 7 | `src/main/services/analysis/DataExporter.ts` | Export toggle states to Python |
| 8 | `Optimizer/optimizer.py` | Respect toggle flags in changeover calculation |

### Phase 5.6.3: UI Components

| Task | File | Description |
|------|------|-------------|
| 9 | `src/renderer/features/analysis/components/AnalysisControlBar.tsx` | Add global toggle |
| 10 | `src/renderer/features/canvas/components/LineNode.tsx` | Add per-line toggle icon |
| 11 | `src/renderer/features/canvas/components/LineNode.tsx` | Add stacked bar visualization |
| 12 | `src/renderer/features/analysis/store/useAnalysisStore.ts` | Track toggle states |

### Phase 5.6.4: Styling & Polish

| Task | File | Description |
|------|------|-------------|
| 13 | `src/renderer/features/canvas/components/LineNode.tsx` | Border color by utilization |
| 14 | `src/renderer/features/canvas/components/LineNode.tsx` | Hover tooltip with breakdown |
| 15 | Integration testing | Verify toggle hierarchy works correctly |

---

## Files to Modify

### New Files

```
src/main/database/migrations/007_changeover_toggles.sql
```

### Modified Files

```
src/shared/types/index.ts                    # ProductionLine interface
src/main/database/repositories/SQLiteLineRepository.ts
src/main/database/repositories/SQLitePreferencesRepository.ts
src/main/ipc/handlers/line.handler.ts
src/main/ipc/handlers/preferences.handler.ts
src/main/services/analysis/DataExporter.ts
Optimizer/optimizer.py
src/renderer/features/analysis/components/AnalysisControlBar.tsx
src/renderer/features/canvas/components/LineNode.tsx
src/renderer/features/analysis/store/useAnalysisStore.ts
```

---

## Edge Cases

### Edge Case 1: No Changeover Data Available

**Scenario:** Toggle is ON but no changeover times defined for a line.

**Behavior:**
- Use global default (30 minutes from `user_preferences`)
- Show warning indicator in tooltip: "Using default changeover time"

### Edge Case 2: Toggle State Persists Across Sessions

**Behavior:**
- Global toggle state saved to `user_preferences`
- Per-line toggle state saved to `production_lines`
- States restored when app reopens

### Edge Case 3: New Lines Default to Global Behavior

**Behavior:**
- New lines created with `changeover_enabled = 1`
- They inherit the global toggle behavior until explicitly changed

---

## Success Criteria

1. [x] Global toggle in Analysis Control Bar works
2. [x] Per-line toggle icon on canvas nodes works
3. [x] Toggle hierarchy logic correct (4 scenarios)
4. [x] Stacked bar shows production/changeover/available
5. [x] Border color reflects utilization threshold
6. [x] Constraint indicator (status dot color) displays
7. [ ] Hover tooltip shows detailed breakdown (Future enhancement)
8. [x] Toggle states persist across sessions
9. [x] Optimizer respects toggle flags

## Implementation Notes

### Year Data Display

The stacked bar visualization on canvas nodes displays data from the **first selected year** (`yearResults[0]`). This is the expected behavior for most use cases:

- **Single year analysis**: Shows that year's data
- **Multi-year analysis**: Shows the first year as a representative view

**Future Enhancement**: Consider adding a year selector or showing multiple years in a condensed view.

### Toggle Logic (True Override - Phase 5.6.1)

The implementation uses **true override** logic with explicit tracking:

| Global | Line | Explicit | Result | Explanation |
|--------|------|----------|--------|-------------|
| OFF | OFF | - | No changeover | Theoretical capacity view |
| OFF | ON | false | No changeover | Follows global setting |
| OFF | ON | **true** | **Changeover calculated** | CRITICAL OVERRIDE |
| ON | OFF | - | No changeover | Per-line exclusion works |
| ON | ON | - | Changeover calculated | Realistic capacity view |

**Critical Override Feature**: When a user explicitly enables changeover on a line (by clicking the toggle), it sets `changeoverExplicit = true`. This allows that line to calculate changeover **even when global is OFF**, enabling focused analysis of specific bottleneck lines.

**Use Case**: Turn global OFF for theoretical capacity, then enable specific lines (like critical bottlenecks) to see their changeover impact in isolation.

### Visual Feedback

**When global changeover is OFF:**
- Per-line toggle icons are **gray** but remain **clickable**
- Tooltip explains: "Global changeover is OFF. Click to set as critical override."

**Critical Override indicator:**
- Lines with explicit override show **red ring** around the timer icon
- Icon shows Timer (enabled) state with red color
- Tooltip: "CRITICAL OVERRIDE: Changeover calculated even though global is OFF"

**When global changeover is ON:**
- Enabled lines show **amber** timer icon
- Disabled lines show **gray** timer off icon

---

## Bug Fixes

### Fix: Global Toggle Not Working (2026-01-28)

**Problem**: Toggling the global changeover button had no effect on analysis results.

**Root Cause**: The `should_calculate_changeover()` function in Python fetched `global_enabled` but never used it - it only returned `line_enabled`. Since all lines default to `changeover_enabled = 1`, the global toggle was ignored.

**Solution**:
```python
# Before (broken):
return line_enabled  # Ignores global!

# After (fixed):
if not global_enabled:
    return False  # Global OFF = no changeover
return line_enabled  # Global ON = per-line controls
```

**Commit**: `4caa128`

### Enhancement: Critical Override (Phase 5.6.1 - 2026-01-29)

**Feature**: Allow per-line changeover toggles to act as "true overrides" in both directions.

**Implementation**:
1. Added `changeover_explicit` column to `production_lines` table (migration 008)
2. When user clicks a per-line toggle, sets `changeover_explicit = 1`
3. Python optimizer checks explicit flag: if global OFF but line is ON + explicit → calculate changeover
4. UI shows critical override with red ring indicator

**Files Modified**:
- `src/main/database/migrations/008_changeover_explicit.sql` - New migration
- `src/shared/types/index.ts` - Added `changeoverExplicit` to types
- `src/domain/entities/ProductionLine.ts` - Added field
- `src/main/database/repositories/SQLiteProductionLineRepository.ts` - Updated toggle methods
- `Optimizer/optimizer.py` - True override logic in `should_calculate_changeover()`
- `src/renderer/features/canvas/components/nodes/ProductionLineNode.tsx` - Critical override UI

### Enhancement: Dropdown Menu with Batch Actions (Phase 5.6.2 - 2026-01-29)

**Feature**: Replace simple toggle with split button + dropdown menu for advanced controls.

**UI Design**:
```
┌─────────────────────────────────────────┐
│ [🔄 Changeover ON ▼]                    │
│           └────────────────────────┐    │
│                                    │    │
│  Global: Enabled                   │    │
│  ─────────────────                 │    │
│  🔄 Disable Global                 │    │
│  ─────────────────                 │    │
│  PER-LINE TOGGLES                  │    │
│  ☑️ Enable All Lines               │    │
│  ☐ Disable All Lines               │    │
│  ─────────────────                 │    │
│  ↺ Reset to Defaults               │    │
│                                    │    │
│  Reset clears all explicit overrides│   │
└────────────────────────────────────┘    │
```

**Batch Actions**:
| Action | Effect |
|--------|--------|
| Enable All Lines | Sets `changeover_enabled = 1, changeover_explicit = 1` for all lines |
| Disable All Lines | Sets `changeover_enabled = 0, changeover_explicit = 1` for all lines |
| Reset to Defaults | Sets `changeover_enabled = 1, changeover_explicit = 0` for all lines |

**Files Modified**:
- `src/shared/constants/index.ts` - Added IPC channels for batch operations
- `src/main/database/repositories/SQLiteProductionLineRepository.ts` - Added batch methods
- `src/main/ipc/handlers/production-lines.handler.ts` - Added batch handlers
- `src/renderer/features/analysis/components/ChangeoverToggle.tsx` - Dropdown menu UI
- `src/renderer/features/canvas/store/useCanvasStore.ts` - Added `refreshNodes()` action

---

## Related Documents

- [Phase 5: Changeover Matrix](./phase-5-changeover-matrix.md) - Parent feature
- [Phase 3.5: Analysis Control Bar](./phase-3.5-summary.md) - Where global toggle goes

---

**Document Version**: 1.3
**Last Updated**: 2026-01-29
**Phase Status**: ✅ Complete (including Phase 5.6.1 Critical Override + Phase 5.6.2 Dropdown Menu)
