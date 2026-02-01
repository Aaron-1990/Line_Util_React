# Phase 8: Project & Scenario Management

**Date Created**: 2026-02-01
**Status**: 📋 Planned
**Developer**: Aaron Zapata
**IE Agent Validated**: ✅ Yes
**UX Agent Validated**: ✅ Yes

---

## Table of Contents

1. [Overview](#overview)
2. [Business Value](#business-value)
3. [Design Decisions](#design-decisions)
4. [Project File Structure](#project-file-structure)
5. [Scenario Management](#scenario-management)
6. [Database Schema](#database-schema)
7. [TypeScript Interfaces](#typescript-interfaces)
8. [User Interface](#user-interface)
9. [File Operations](#file-operations)
10. [Auto-Save & Recovery](#auto-save--recovery)
11. [Architecture](#architecture)
12. [Migration Path](#migration-path)
13. [Implementation Phases](#implementation-phases)
14. [Files to Create](#files-to-create)
15. [Verification Checklist](#verification-checklist)

---

## Overview

Transform Line Optimizer from a single-database tool into a document-based application where users work with portable project files (`.lineopt`). Each project contains plant configuration and multiple scenarios for what-if analysis.

### Current State

```
Single SQLite database in ~/Library/Application Support/Line Optimizer/
├── All lines, models, volumes in one implicit "project"
├── No way to save/load different configurations
├── No way to share with colleagues
└── No scenario support for what-if analysis
```

### Target State

```
Project-based workflow (like Excel, AutoCAD)
├── Each project is a portable .lineopt file
├── Welcome screen with New/Open/Recent
├── Auto-save with crash recovery
├── Multiple scenarios per project
└── Shareable via email, SharePoint, Teams
```

---

## Business Value

### Workflow Improvements

| Current Pain Point | Solution | Impact |
|-------------------|----------|--------|
| Can't share analysis with Plant Manager | Single `.lineopt` file | 5 min vs 1 hour setup |
| Re-model everything for new study | Save As creates copy | 4-8 hours saved |
| No what-if comparison | Scenarios in same project | Better decisions |
| Fear of data loss | Auto-save + recovery | Peace of mind |
| "Which version is latest?" | File naming conventions | Clear ownership |

### ROI Analysis (IE Agent)

| Activity | Manual (Current) | With Projects | Savings |
|----------|------------------|---------------|---------|
| Share with colleague | Re-enter data or screenshots | Send file | 2-4 hours |
| Compare scenarios | Separate Excel sheets | Side-by-side view | 1-2 hours |
| New plant study | Start from scratch | Save As + modify | 4-8 hours |
| Recover from crash | Re-do everything | Auto-recovery | 1-8 hours |

**Conservative estimate**: 10-20 hours saved per capacity study.

---

## Design Decisions

### Paradigm: Hybrid (Project Files + Internal Scenarios)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **File paradigm** | Document-based | Matches Excel/AutoCAD mental model |
| **File extension** | `.lineopt` | Clear, professional, unique |
| **File format** | SQLite database | Consistent with stack, queryable |
| **Auto-save** | Yes, 30-second interval | Modern UX, no data loss |
| **Scenarios** | Internal to project | Lines stay same, volumes change |
| **Collaboration** | File-based sharing | Matches enterprise IT patterns |
| **Versioning** | Manual (Save As) | Simple, familiar to users |

### What Goes in Plant Config vs. Scenario

| Data | Location | Rationale |
|------|----------|-----------|
| **Lines** | Plant Config | Physical assets, rarely change |
| **Areas** | Plant Config | Manufacturing structure is stable |
| **Models** | Plant Config | Model definitions are stable |
| **Routings** | Plant Config | Process flows are engineering decisions |
| **Compatibilities** | Plant Config | Which models run where is engineering |
| **Changeover matrices** | Plant Config | Changeover times are measured |
| **Canvas layout** | Plant Config | Visual preference, shared across scenarios |
| **Volumes** | Scenario | This is what changes in planning |
| **Line overrides** | Scenario | "What if we add Line 5?" |
| **Analysis results** | Scenario | Cached per scenario |

---

## Project File Structure

### Conceptual Structure

```
Ramos_Capacity_Study_2026.lineopt (SQLite file)
│
├── PROJECT METADATA
│   ├── name: "Ramos Capacity Study 2026"
│   ├── description: "Annual capacity planning for Ramos plant"
│   ├── created: 2026-01-15
│   ├── modified: 2026-02-01
│   ├── author: "Aaron Zapata"
│   └── schema_version: "1.0.0"
│
├── PLANT CONFIGURATION (shared across scenarios)
│   ├── production_lines (15 lines)
│   ├── areas (6 areas)
│   ├── product_models_v2 (45 models)
│   ├── model_area_routing (DAG flows)
│   ├── line_model_compatibilities (180 pairs)
│   ├── changeover matrices
│   │   ├── user_preferences (global default)
│   │   ├── family_changeover_defaults
│   │   └── line_changeover_overrides
│   └── canvas_state (node positions, viewport)
│
└── SCENARIOS
    ├── Scenario 1: "Base Case"
    │   ├── product_volumes (45 models × 4 years)
    │   ├── line_overrides (none)
    │   └── analysis_results (cached)
    │
    ├── Scenario 2: "Ford F-150 Award"
    │   ├── product_volumes (+500K units)
    │   ├── line_overrides (none)
    │   └── analysis_results (cached)
    │
    └── Scenario 3: "New Line Investment"
        ├── product_volumes (+500K units)
        ├── line_overrides (Line 16 enabled)
        └── analysis_results (cached)
```

### File Extension

| Extension | Assessment |
|-----------|------------|
| `.lop` | Too short, conflicts possible |
| `.lineopt` | **Recommended** - Clear, professional |
| `.capacity` | Too generic |
| `.lcap` | Unclear abbreviation |

---

## Scenario Management

### Scenario Definition

A scenario represents a **volume forecast and configuration variation** within the same plant.

```typescript
interface Scenario {
  id: string;
  name: string;                    // "Base Case", "Ford Win"
  description?: string;
  color: string;                   // For visual distinction (#3B82F6)
  createdAt: Date;
  modifiedAt: Date;

  // What varies per scenario
  volumes: ScenarioVolume[];       // Year-over-year volumes
  lineOverrides: LineOverride[];   // Enable/disable lines, capacity changes

  // Cached results
  lastAnalysis?: CachedAnalysis;
}

interface ScenarioVolume {
  modelId: number;
  year: number;
  volume: number;
  operationsDays: number;
}

interface LineOverride {
  lineId: number;
  enabled: boolean;                // Simulate adding/removing line
  timeAvailableOverride?: number;  // Override capacity (e.g., add shift)
  changeoverEnabledOverride?: boolean;
}

interface CachedAnalysis {
  timestamp: Date;
  settings: {
    yearRange: [number, number];
    changeoverEnabled: boolean;
  };
  results: AnalysisResults;
}
```

### Scenario Operations

| Operation | Description |
|-----------|-------------|
| **Create** | New scenario with current volumes as starting point |
| **Duplicate** | Copy existing scenario for variation |
| **Switch** | Change active scenario (updates canvas, results) |
| **Rename** | Change scenario name/description |
| **Delete** | Remove scenario (with confirmation) |
| **Compare** | Side-by-side view of 2-3 scenarios |

### Scenario Comparison View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Compare Scenarios                                              [×] Close   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Select scenarios to compare:                                               │
│  [✓] Base Case    [✓] Ford Win    [ ] Conservative                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  METRIC                      BASE CASE       FORD WIN        DELTA          │
│  ────────────────────────────────────────────────────────────────────────   │
│  Total Volume (2026)         1,250,000       1,750,000      +500,000 ▲      │
│  Avg Utilization             72.3%           94.1%          +21.8% ▲        │
│  Lines at Capacity           2               7              +5 ▲            │
│  Unfulfilled Demand          0               125,000        +125,000 ▲      │
│  Changeover Loss             4.2%            6.8%           +2.6% ▲         │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────   │
│  BY AREA                                                                    │
│  ────────────────────────────────────────────────────────────────────────   │
│  SMT                         68.5%           89.2%          +20.7% ▲        │
│  ICT                         71.2%           92.8%          +21.6% ▲        │
│  Conformal                   55.3%           78.4%          +23.1% ▲        │
│  Final Assembly              82.1%           98.5%          +16.4% ▲        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RECOMMENDATION                                                             │
│  Ford Win scenario requires 2 additional lines in Final Assembly by Q3 2026│
│                                                                             │
│                                              [Export PDF]  [Close]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables for Project Management

```sql
-- ============================================
-- Migration: 010_project_management.sql
-- Purpose: Project metadata and scenario support
-- ============================================

-- Project metadata (one row per project file)
CREATE TABLE IF NOT EXISTS project_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',

  -- Settings
  default_scenario_id TEXT,
  auto_save_enabled BOOLEAN DEFAULT TRUE,

  -- Stats (for quick preview without full load)
  line_count INTEGER DEFAULT 0,
  model_count INTEGER DEFAULT 0,
  scenario_count INTEGER DEFAULT 0
);

-- Scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',           -- Hex color for badges
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sort_order INTEGER DEFAULT 0,

  -- Cached analysis (JSON blob for simplicity)
  last_analysis_json TEXT,                -- Serialized CachedAnalysis
  last_analysis_at TIMESTAMP
);

-- Scenario-specific volumes (replaces product_volumes for scenarios)
CREATE TABLE IF NOT EXISTS scenario_volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  model_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  volume INTEGER NOT NULL,
  operations_days INTEGER DEFAULT 250,

  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(scenario_id, model_id, year)
);

-- Scenario-specific line overrides
CREATE TABLE IF NOT EXISTS scenario_line_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  line_id INTEGER NOT NULL,

  enabled BOOLEAN,                        -- NULL = use plant default
  time_available_override DECIMAL(10,2),  -- NULL = use plant default
  changeover_enabled_override BOOLEAN,    -- NULL = use plant default

  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  UNIQUE(scenario_id, line_id)
);

-- Canvas state (viewport, node positions)
CREATE TABLE IF NOT EXISTS canvas_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
  viewport_x REAL DEFAULT 0,
  viewport_y REAL DEFAULT 0,
  viewport_zoom REAL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Node positions (separate from lines for flexibility)
CREATE TABLE IF NOT EXISTS canvas_node_positions (
  line_id INTEGER PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE
);

-- Create default scenario on project creation
INSERT INTO scenarios (id, name, description, sort_order)
VALUES ('default', 'Base Case', 'Default scenario', 0);

-- Create project metadata
INSERT INTO project_metadata (id, name, schema_version)
VALUES (1, 'Untitled Project', '1.0.0');
```

### Migration Strategy

The existing `product_volumes` table becomes the "plant-level" volumes that get copied into new scenarios. When a scenario is active, we read from `scenario_volumes`. This allows backward compatibility.

```sql
-- View to abstract volume source based on active scenario
CREATE VIEW IF NOT EXISTS v_active_volumes AS
SELECT
  sv.model_id,
  sv.year,
  sv.volume,
  sv.operations_days
FROM scenario_volumes sv
JOIN project_metadata pm ON sv.scenario_id = pm.default_scenario_id;
```

---

## TypeScript Interfaces

### Project State

```typescript
// src/shared/types/project.ts

export interface Project {
  // Metadata
  metadata: ProjectMetadata;

  // Plant configuration (shared across scenarios)
  plantConfig: PlantConfiguration;

  // Scenarios
  scenarios: Scenario[];
  activeScenarioId: string;
}

export interface ProjectMetadata {
  name: string;
  description?: string;
  author?: string;
  createdAt: Date;
  modifiedAt: Date;
  schemaVersion: string;

  // Quick stats (for welcome screen previews)
  lineCount: number;
  modelCount: number;
  scenarioCount: number;
}

export interface PlantConfiguration {
  lines: ProductionLine[];
  areas: Area[];
  models: ProductModel[];
  routings: ModelRouting[];
  compatibilities: LineModelCompatibility[];
  changeover: {
    globalDefault: number;
    familyDefaults: FamilyChangeover[];
    lineOverrides: LineChangeover[];
  };
  canvas: CanvasState;
}

export interface CanvasState {
  viewport: { x: number; y: number; zoom: number };
  nodePositions: Map<number, { x: number; y: number }>;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: Date;
  modifiedAt: Date;
  sortOrder: number;

  volumes: ScenarioVolume[];
  lineOverrides: LineOverride[];

  lastAnalysis?: CachedAnalysis;
}

export interface ScenarioVolume {
  modelId: number;
  year: number;
  volume: number;
  operationsDays: number;
}

export interface LineOverride {
  lineId: number;
  enabled?: boolean;
  timeAvailableOverride?: number;
  changeoverEnabledOverride?: boolean;
}

export interface CachedAnalysis {
  timestamp: Date;
  settings: AnalysisSettings;
  results: AnalysisResults;
}
```

### Recent Projects (App Preferences)

```typescript
// src/shared/types/app-preferences.ts

export interface AppPreferences {
  // Recent projects
  recentProjects: RecentProject[];
  maxRecentProjects: number;  // Default: 10

  // Startup behavior
  openLastProjectOnLaunch: boolean;
  lastProjectPath?: string;

  // Default locations
  defaultProjectLocation: string;  // ~/Documents/Line Optimizer/

  // Auto-save
  autoSaveIntervalMs: number;  // Default: 30000
  autoSaveEnabled: boolean;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: Date;

  // Quick preview data (optional, for welcome screen)
  lineCount?: number;
  modelCount?: number;
  scenarioCount?: number;
}
```

---

## User Interface

### Welcome Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          LINE OPTIMIZER                                     │
│                       Capacity Planning Tool                                │
│                                                                             │
│     ┌─────────────────────────┐    ┌─────────────────────────┐             │
│     │                         │    │                         │             │
│     │      + New Project      │    │     Open Existing...    │             │
│     │                         │    │                         │             │
│     │   Start with an empty   │    │   Open a .lineopt file  │             │
│     │   project               │    │   from your computer    │             │
│     │                         │    │                         │             │
│     └─────────────────────────┘    └─────────────────────────┘             │
│                                                                             │
│     ───────────────────── Recent Projects ─────────────────────            │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  📄 Ramos Plant 2026                              Jan 31, 2026  │    │
│     │     ~/Documents/Capacity/ramos-2026.lineopt                     │    │
│     │     15 lines · 45 models · 3 scenarios                          │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  📄 Seneca Phase 2                                Jan 28, 2026  │    │
│     │     ~/Documents/Capacity/seneca-phase2.lineopt                  │    │
│     │     8 lines · 22 models · 2 scenarios                           │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  📄 Corporate Baseline                            Jan 15, 2026  │    │
│     │     ~/Documents/Capacity/corporate-base.lineopt                 │    │
│     │     42 lines · 120 models · 5 scenarios                         │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│     ─────────────────────────────────────────────────────────────────      │
│                                                                             │
│     Import from Excel...                                                    │
│     Use your existing capacity planning spreadsheet                         │
│                                                                             │
│     ─────────────────────────────────────────────────────────────────      │
│                                                                             │
│     [ ] Open last project automatically                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Header Bar with Project Identity

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☰  │ Ramos Plant 2026 ▼     │ Scenario: Base Case ▼  │  ⚡ Run Analysis   │
│     │ ~/Documents/Capacity/  │ 3 scenarios            │                    │
└─────────────────────────────────────────────────────────────────────────────┘
      │                        │
      │ Project dropdown:      │ Scenario dropdown:
      │ ┌────────────────────┐ │ ┌────────────────────────────┐
      │ │ Ramos Plant 2026 ✓ │ │ │ ● Base Case              ✓ │
      │ ├────────────────────┤ │ │ ● Ford Win                 │
      │ │ Recent Projects    │ │ │ ● Conservative             │
      │ │  Seneca Phase 2    │ │ ├────────────────────────────┤
      │ │  Corporate Base    │ │ │ + New Scenario...          │
      │ ├────────────────────┤ │ │ ⎘ Duplicate Current...     │
      │ │ New Project...     │ │ ├────────────────────────────┤
      │ │ Open...            │ │ │ Compare Scenarios...       │
      │ │ Save As...         │ │ └────────────────────────────┘
      │ │ Close Project      │ │
      │ └────────────────────┘ │
```

### Title Bar States

```
SAVED (normal):
┌─────────────────────────────────────────────────────────────────────────┐
│  Ramos Plant 2026 — Line Optimizer                                 _ □ X│
└─────────────────────────────────────────────────────────────────────────┘

PENDING AUTO-SAVE (changes not yet persisted):
┌─────────────────────────────────────────────────────────────────────────┐
│  Ramos Plant 2026 • — Line Optimizer                               _ □ X│
└─────────────────────────────────────────────────────────────────────────┘

NEW UNSAVED PROJECT:
┌─────────────────────────────────────────────────────────────────────────┐
│  Untitled * — Line Optimizer                                       _ □ X│
└─────────────────────────────────────────────────────────────────────────┘
```

### Scenario Sidebar Panel

```
┌─────────────────────────────────────────┐
│  SCENARIOS                    [+ New]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● Base Case              ✓      │   │  ← Active (checkmark)
│  │   72.3% avg utilization         │   │
│  │   Last run: 2 hours ago         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● Ford Win                      │   │
│  │   94.1% avg utilization         │   │
│  │   Last run: 1 hour ago          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● Conservative                  │   │
│  │   ⚠ Not analyzed yet            │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  [Compare Selected...]                  │
└─────────────────────────────────────────┘
```

### File Menu

```
File
├── New Project              Cmd+N
├── Open...                  Cmd+O
├── Open Recent              ▶  ┌─────────────────────────────┐
│                               │ Ramos Plant 2026.lineopt    │
│                               │ Seneca Phase 2.lineopt      │
│                               │ Corporate Baseline.lineopt  │
│                               ├─────────────────────────────┤
│                               │ Clear Recent                │
│                               └─────────────────────────────┘
├── ─────────────────────
├── Save                     Cmd+S    (triggers immediate save)
├── Save As...               Cmd+Shift+S
├── ─────────────────────
├── Project Settings...      Cmd+,    (name, description, author)
├── ─────────────────────
├── Import from Excel...     Cmd+I
├── Export Results...        Cmd+E
├── ─────────────────────
└── Close Project            Cmd+W
```

---

## File Operations

### New Project Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEW PROJECT FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User clicks "New Project" or Cmd+N                                      │
│                                                                             │
│  2. System creates temporary SQLite in app data directory                   │
│     Path: ~/Library/Application Support/Line Optimizer/temp-{uuid}.db      │
│                                                                             │
│  3. Initialize with empty schema + default scenario ("Base Case")           │
│                                                                             │
│  4. Mark project as "untitled" (filePath = null)                           │
│                                                                             │
│  5. User works in the project...                                            │
│                                                                             │
│  6. On first Save (Cmd+S):                                                  │
│     - Show save dialog with suggested name                                  │
│     - Default location: ~/Documents/Line Optimizer/                         │
│     - User chooses location → copy temp DB to .lineopt file                │
│     - Update filePath, mark as saved                                        │
│                                                                             │
│  7. Subsequent saves write directly to .lineopt file                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Open Project Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPEN PROJECT FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User clicks "Open" or selects from Recent                               │
│                                                                             │
│  2. If current project has unsaved changes:                                 │
│     - Show "Save changes?" dialog                                           │
│     - [Don't Save] [Cancel] [Save]                                          │
│                                                                             │
│  3. Open selected .lineopt file                                             │
│     - Validate schema version                                               │
│     - Run migrations if needed                                              │
│                                                                             │
│  4. Load project into memory                                                │
│     - Read project_metadata                                                 │
│     - Read all plant configuration                                          │
│     - Read active scenario                                                  │
│                                                                             │
│  5. Update app state                                                        │
│     - Set filePath                                                          │
│     - Update recent projects list                                           │
│     - Refresh canvas with loaded positions                                  │
│                                                                             │
│  6. Enable auto-save for this file                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Save As Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SAVE AS FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User clicks "Save As" (Cmd+Shift+S)                                     │
│                                                                             │
│  2. Show save dialog                                                        │
│     - Suggested name: current name + " Copy" or timestamp                   │
│     - Default location: same folder as current file                         │
│                                                                             │
│  3. Copy current database to new location                                   │
│                                                                             │
│  4. Switch to new file as active project                                    │
│     - Update filePath                                                       │
│     - Update project name in metadata                                       │
│     - Add to recent projects                                                │
│                                                                             │
│  5. Original file is unchanged (like Excel Save As)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Auto-Save & Recovery

### Auto-Save Strategy

```typescript
// Auto-save configuration
const AUTO_SAVE_CONFIG = {
  intervalMs: 30_000,        // Save every 30 seconds if dirty
  debounceMs: 2_000,         // Wait 2s after last change before save
  saveOnBlur: true,          // Save when window loses focus
  saveOnClose: true,         // Force save before close
};

// Auto-save triggers:
// 1. Timer (every 30 seconds if dirty)
// 2. Debounced after significant actions
// 3. Window blur (app goes to background)
// 4. Before window close
// 5. Before switching projects
```

### Backup Strategy

```
Auto-save creates backup before overwriting:

project-name.lineopt          ← Current file
project-name.lineopt.backup   ← Previous version (one level)

On crash:
1. Detect orphaned .backup files on launch
2. Compare timestamps
3. Offer recovery dialog if backup is newer
```

### Crash Recovery Dialog

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   ⚠ Recovered unsaved changes                                │
│                                                               │
│   Line Optimizer found unsaved changes from your last        │
│   session. Would you like to recover them?                    │
│                                                               │
│   Project: Ramos Plant 2026                                   │
│   Last saved: Jan 31, 2026 at 3:45 PM                        │
│   Recovery data: Jan 31, 2026 at 4:12 PM                     │
│                                                               │
│                [Discard]              [Recover]               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Architecture

### File Structure

```
src/
├── main/
│   ├── services/
│   │   └── project/
│   │       ├── ProjectService.ts          # Core project operations
│   │       ├── ProjectMigrator.ts         # Schema version migrations
│   │       ├── AutoSaveService.ts         # Auto-save timer and logic
│   │       └── RecoveryService.ts         # Crash recovery
│   └── ipc/
│       └── handlers/
│           ├── project.handler.ts         # Project IPC handlers
│           └── scenario.handler.ts        # Scenario IPC handlers
│
├── shared/
│   └── types/
│       ├── project.ts                     # Project interfaces
│       └── app-preferences.ts             # App preferences interfaces
│
└── renderer/
    ├── store/
    │   ├── useProjectStore.ts             # Project state management
    │   └── useAppPreferencesStore.ts      # App preferences (persisted)
    ├── pages/
    │   └── WelcomePage.tsx                # Welcome screen
    └── features/
        └── project/
            └── components/
                ├── ProjectHeader.tsx      # Header bar with project info
                ├── ScenarioPanel.tsx      # Scenario sidebar
                ├── ScenarioCard.tsx       # Individual scenario card
                ├── NewScenarioModal.tsx   # Create scenario dialog
                ├── CompareModal.tsx       # Scenario comparison view
                └── ProjectSettingsModal.tsx
```

### IPC Channels

```typescript
// src/shared/constants/index.ts

export const PROJECT_CHANNELS = {
  // Project operations
  NEW_PROJECT: 'project:new',
  OPEN_PROJECT: 'project:open',
  SAVE_PROJECT: 'project:save',
  SAVE_PROJECT_AS: 'project:save-as',
  CLOSE_PROJECT: 'project:close',
  GET_PROJECT_METADATA: 'project:get-metadata',
  UPDATE_PROJECT_METADATA: 'project:update-metadata',

  // Recent projects
  GET_RECENT_PROJECTS: 'project:get-recent',
  CLEAR_RECENT_PROJECTS: 'project:clear-recent',

  // File dialogs
  SHOW_OPEN_DIALOG: 'project:show-open-dialog',
  SHOW_SAVE_DIALOG: 'project:show-save-dialog',

  // Auto-save
  TRIGGER_AUTO_SAVE: 'project:trigger-auto-save',
  GET_AUTO_SAVE_STATUS: 'project:get-auto-save-status',
} as const;

export const SCENARIO_CHANNELS = {
  LIST_SCENARIOS: 'scenario:list',
  GET_SCENARIO: 'scenario:get',
  CREATE_SCENARIO: 'scenario:create',
  DUPLICATE_SCENARIO: 'scenario:duplicate',
  UPDATE_SCENARIO: 'scenario:update',
  DELETE_SCENARIO: 'scenario:delete',
  SWITCH_SCENARIO: 'scenario:switch',
  GET_ACTIVE_SCENARIO: 'scenario:get-active',

  // Scenario volumes
  GET_SCENARIO_VOLUMES: 'scenario:get-volumes',
  SET_SCENARIO_VOLUMES: 'scenario:set-volumes',

  // Comparison
  COMPARE_SCENARIOS: 'scenario:compare',
} as const;
```

### State Management

```typescript
// src/renderer/store/useProjectStore.ts

interface ProjectState {
  // Current project
  filePath: string | null;        // null = new unsaved project
  projectName: string;            // "Untitled" or from metadata
  isDirty: boolean;               // Has unsaved changes
  lastSaved: Date | null;
  isAutoSaving: boolean;

  // Scenarios
  scenarios: Scenario[];
  activeScenarioId: string;

  // Actions
  newProject: () => Promise<void>;
  openProject: (path?: string) => Promise<void>;  // path optional = show dialog
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  closeProject: () => Promise<boolean>;  // returns false if cancelled

  // Dirty state
  markDirty: () => void;
  markClean: () => void;

  // Scenarios
  createScenario: (name: string, basedOn?: string) => Promise<Scenario>;
  duplicateScenario: (id: string) => Promise<Scenario>;
  switchScenario: (id: string) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<Scenario>) => Promise<void>;
}
```

---

## Migration Path

### From Current Single-Database to Projects

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MIGRATION STRATEGY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CURRENT STATE:                                                             │
│  ~/Library/Application Support/Line Optimizer/line-optimizer.db            │
│  - Contains all user data                                                   │
│  - No project/scenario concept                                              │
│                                                                             │
│  MIGRATION (on first launch of Phase 8):                                    │
│                                                                             │
│  1. Detect existing database                                                │
│                                                                             │
│  2. Show migration dialog:                                                  │
│     ┌───────────────────────────────────────────────────────────────┐      │
│     │                                                               │      │
│     │   Welcome to the new Line Optimizer!                          │      │
│     │                                                               │      │
│     │   We found existing data from a previous version.             │      │
│     │   Would you like to migrate it to a new project file?         │      │
│     │                                                               │      │
│     │   Your data:                                                  │      │
│     │   • 15 production lines                                       │      │
│     │   • 45 models                                                 │      │
│     │   • 4 years of volumes                                        │      │
│     │                                                               │      │
│     │           [Start Fresh]        [Migrate Data]                 │      │
│     │                                                               │      │
│     └───────────────────────────────────────────────────────────────┘      │
│                                                                             │
│  3. If "Migrate Data":                                                      │
│     a. Show save dialog for new .lineopt file                              │
│     b. Copy existing database to new location                               │
│     c. Add project_metadata, scenarios tables                               │
│     d. Create "Base Case" scenario with existing volumes                    │
│     e. Open the new project                                                 │
│                                                                             │
│  4. Rename old database to .backup (don't delete)                           │
│                                                                             │
│  5. Future launches use project-based flow                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Backward Compatibility

```typescript
// Check if .lineopt file has project_metadata table
async function isProjectFile(dbPath: string): Promise<boolean> {
  const db = new Database(dbPath);
  const result = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='project_metadata'
  `).get();
  db.close();
  return !!result;
}

// Upgrade legacy database to project format
async function upgradeToProject(legacyPath: string, projectPath: string): Promise<void> {
  // Copy file
  await fs.copyFile(legacyPath, projectPath);

  // Open and run migration
  const db = new Database(projectPath);
  db.exec(MIGRATION_010_PROJECT_MANAGEMENT);

  // Create default scenario from existing volumes
  const volumes = db.prepare(`SELECT * FROM product_volumes`).all();
  const scenarioId = 'default';

  for (const v of volumes) {
    db.prepare(`
      INSERT INTO scenario_volumes (scenario_id, model_id, year, volume, operations_days)
      VALUES (?, ?, ?, ?, ?)
    `).run(scenarioId, v.model_id, v.year, v.volume, v.operations_days);
  }

  db.close();
}
```

---

## Implementation Phases

### Phase 8A: Project Files (2 weeks)

**Goal**: Basic project file operations

- [ ] Define project TypeScript interfaces
- [ ] Create `ProjectService` for file operations
- [ ] Database migration `010_project_management.sql`
- [ ] Welcome screen component
- [ ] File > New Project flow
- [ ] File > Open Project flow
- [ ] File > Save / Save As flows
- [ ] Recent projects list (stored in app preferences)
- [ ] Project header in UI
- [ ] File type association (`.lineopt`)
- [ ] Migration from legacy database

**Deliverable**: Users can create, save, open `.lineopt` files

### Phase 8B: Auto-Save & Recovery (1 week)

**Goal**: Data protection

- [ ] `AutoSaveService` with timer
- [ ] Dirty state tracking
- [ ] Title bar state indicators
- [ ] Backup file creation
- [ ] `RecoveryService` for crash detection
- [ ] Recovery dialog on launch
- [ ] Close confirmation for unsaved new projects

**Deliverable**: Auto-save every 30s, crash recovery

### Phase 8C: Basic Scenarios (2 weeks)

**Goal**: Multiple scenarios per project

- [ ] Scenario database tables
- [ ] `ScenarioRepository` for CRUD
- [ ] Scenario panel in sidebar
- [ ] Create / duplicate scenario
- [ ] Switch active scenario
- [ ] Rename / delete scenario
- [ ] Scenario-specific volumes
- [ ] Cached analysis results per scenario
- [ ] Update analysis to use active scenario volumes

**Deliverable**: Create and switch between scenarios

### Phase 8D: Scenario Comparison (2 weeks)

**Goal**: Side-by-side what-if analysis

- [ ] Comparison view modal
- [ ] Select 2-3 scenarios to compare
- [ ] Metric comparison table
- [ ] Area-by-area breakdown
- [ ] Delta highlighting (up/down arrows)
- [ ] Export comparison to PDF
- [ ] Recommendation text based on differences

**Deliverable**: Compare scenarios side-by-side

### Phase 8E: Polish (1 week)

**Goal**: Production-ready feature

- [ ] Keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S)
- [ ] macOS Dock "Recent Items" integration
- [ ] Windows jump list integration
- [ ] Project settings modal (name, description, author)
- [ ] Scenario color customization
- [ ] Error handling and user feedback
- [ ] Performance optimization for large projects

---

## Files to Create

### Phase 8A (Project Files)

| File | Purpose |
|------|---------|
| `src/shared/types/project.ts` | TypeScript interfaces |
| `src/shared/types/app-preferences.ts` | App preferences interfaces |
| `src/main/database/migrations/010_project_management.sql` | Database schema |
| `src/main/services/project/ProjectService.ts` | Core project operations |
| `src/main/services/project/ProjectMigrator.ts` | Schema migrations |
| `src/main/ipc/handlers/project.handler.ts` | Project IPC handlers |
| `src/renderer/store/useProjectStore.ts` | Project state management |
| `src/renderer/store/useAppPreferencesStore.ts` | App preferences store |
| `src/renderer/pages/WelcomePage.tsx` | Welcome screen |
| `src/renderer/features/project/components/ProjectHeader.tsx` | Header bar |
| `src/renderer/features/project/components/RecentProjectCard.tsx` | Recent item |

### Phase 8B (Auto-Save)

| File | Purpose |
|------|---------|
| `src/main/services/project/AutoSaveService.ts` | Auto-save logic |
| `src/main/services/project/RecoveryService.ts` | Crash recovery |
| `src/renderer/features/project/components/RecoveryDialog.tsx` | Recovery UI |

### Phase 8C (Scenarios)

| File | Purpose |
|------|---------|
| `src/main/database/repositories/SQLiteScenarioRepository.ts` | Scenario CRUD |
| `src/main/ipc/handlers/scenario.handler.ts` | Scenario IPC handlers |
| `src/renderer/features/project/components/ScenarioPanel.tsx` | Sidebar panel |
| `src/renderer/features/project/components/ScenarioCard.tsx` | Scenario card |
| `src/renderer/features/project/components/NewScenarioModal.tsx` | Create dialog |

### Phase 8D (Comparison)

| File | Purpose |
|------|---------|
| `src/renderer/features/project/components/CompareModal.tsx` | Comparison view |
| `src/renderer/features/project/components/ComparisonTable.tsx` | Metrics table |
| `src/main/services/project/ComparisonExporter.ts` | PDF export |

---

## Verification Checklist

### Phase 8A

- [ ] Welcome screen appears on launch
- [ ] "New Project" creates empty project
- [ ] "Open" dialog filters for `.lineopt` files
- [ ] Save creates valid `.lineopt` file
- [ ] Save As creates copy at new location
- [ ] Recent projects list updates correctly
- [ ] Project name appears in header/title bar
- [ ] Legacy database migrates successfully
- [ ] Double-clicking `.lineopt` file opens app

### Phase 8B

- [ ] Changes auto-save after 30 seconds
- [ ] Title bar shows dirty indicator (•)
- [ ] Crash recovery dialog appears after crash
- [ ] Recovery restores unsaved changes
- [ ] Close confirmation appears for new unsaved project
- [ ] Window blur triggers save

### Phase 8C

- [ ] Scenario panel shows in sidebar
- [ ] Can create new scenario
- [ ] Can duplicate existing scenario
- [ ] Switching scenarios updates volumes
- [ ] Analysis uses active scenario volumes
- [ ] Results cached per scenario
- [ ] Deleting scenario shows confirmation

### Phase 8D

- [ ] Can select 2-3 scenarios to compare
- [ ] Comparison modal shows all metrics
- [ ] Deltas highlighted with arrows
- [ ] Export to PDF works
- [ ] Comparison includes all areas

### Overall

- [ ] No data loss during normal operations
- [ ] TypeScript: `npm run type-check` passes
- [ ] Large projects (100+ lines) perform well
- [ ] File size reasonable (< 50MB typical)

---

## Dependencies

### NPM Packages (to install when implementing)

```bash
# PDF generation for comparison export
npm install @react-pdf/renderer

# UUID for scenario IDs
npm install uuid @types/uuid

# File type association (already in Electron)
# No additional packages needed
```

---

## Notes

### File Naming Convention (Recommended for Users)

```
[PLANT]_[STUDY_TYPE]_[DATE]_[VERSION].lineopt

Examples:
Ramos_CapacityStudy_2026Q1_v3.lineopt
Irapuato_NewBusinessQuote_GM_2026-01_v2_FINAL.lineopt
Corporate_MultiPlant_2027-2030_DRAFT.lineopt
```

### What NOT to Build

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Overkill for 1-3 IEs on a study |
| Cloud sync | Security concerns, IT policies |
| Git-style branching | Too complex for target users |
| Full version history | File naming conventions work |
| Conflict resolution | File-level locking sufficient |

### Future Extensions (Not in Phase 8)

- Project templates (pre-configured plant setups)
- Import scenario from another project
- Merge projects (combine two plants)
- Project encryption (sensitive forecasts)
