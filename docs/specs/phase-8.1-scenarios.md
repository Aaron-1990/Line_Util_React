# Phase 8.1: Scenarios & Comparison Specification

## Metadata
- **Designed:** 2026-02-06
- **Designer:** Aaron Zapata
- **Project:** Line Optimizer
- **Framework:** Híbrido v2.0
- **Domain:** Manufacturing Engineering
- **Recommended Agents:** `backend-architect`, `frontend-developer`, `ux-ui-designer`
- **Estimated Complexity:** Medium (4-5 days)
- **Prerequisite:** Phase 8.0 (Project Files Foundation)

---

## Context

### Business Problem

Manufacturing engineers need to perform "what-if" analysis to evaluate different capacity scenarios:

**Current Limitation (Phase 8.0):**
- Only one configuration per project file
- To compare alternatives, must create separate .lop files
- Difficult to compare scenarios side-by-side
- No way to track relationship between Base and variants

**Industry Comparison:**
- **Excel:** Scenario Manager with "Best Case", "Worst Case", "Most Likely"
- **MS Project:** Up to 11 baselines for comparing schedule changes
- **ProModel:** Scenario table with parameter combinations

### Solution: Scenarios Within Project

Implement scenario management similar to Excel Scenario Manager:
- **Base Scenario:** Original configuration (default)
- **Variant Scenarios:** Modifications to Base (e.g., "+2 Lines", "-20% Volume")
- **Tabs:** Switch between scenarios easily
- **Deltas:** Only store changes vs Base (efficient storage)
- **Comparison:** Side-by-side comparison of results

### User Workflows Enabled

```
Engineer evaluating capacity options:

1. Open "Juarez_2026.lop" (Base scenario)
2. Run optimization → 78% avg utilization, 3 bottlenecks
3. Create scenario "Add 2 ASSEMBLY Lines"
   - Switch to new scenario tab
   - Add 2 production lines to ASSEMBLY area
   - Run optimization → 85% utilization, 1 bottleneck
4. Create scenario "Reduce Volume 20%"
   - Switch to new scenario tab
   - Modify volumes table (-20%)
   - Run optimization → 65% utilization, 0 bottlenecks
5. Compare Scenarios:
   - View side-by-side table
   - Metrics: Utilization, Bottlenecks, Unmet Demand
   - Export comparison to Excel
6. Save project → All scenarios in one .lop file
```

### Key Requirements

1. **Storage:** Scenarios stored in same .lop file
2. **Data model:** Base + Deltas (not full duplicates)
3. **UI:** Tab interface for switching scenarios
4. **Comparison:** Side-by-side metrics table
5. **Isolation:** Changes in one scenario don't affect others
6. **Performance:** Switching scenarios < 500ms

---

## BLOQUE 0: Contracts & Architecture

### Principles Applied

1. **Delta Storage:** Only store changes vs Base (space-efficient)
2. **Immutable Base:** Base scenario cannot be deleted (all scenarios derive from it)
3. **Lazy Loading:** Load scenario data only when tab is activated
4. **State Isolation:** Each scenario has independent Zustand state
5. **Optimistic UI:** Switch tabs immediately, load data in background

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   PROJECT FILE (.lop)                    │
├─────────────────────────────────────────────────────────────┤
│  project_metadata                                            │
│  Base Scenario Data:                                         │
│    ├─ production_lines                                       │
│    ├─ product_models_v2                                      │
│    ├─ product_volumes                                        │
│    ├─ line_model_compatibilities                            │
│    └─ canvas_objects                                         │
│                                                              │
│  scenarios table:                                            │
│    ├─ Base Scenario (id=1, is_base=true)                    │
│    ├─ Scenario: +2 Lines (id=2, is_base=false)              │
│    └─ Scenario: -20% Volume (id=3, is_base=false)           │
│                                                              │
│  scenario_changes table:                                     │
│    ├─ Scenario 2: ADD_LINE (line_id=301, area=ASSEMBLY)     │
│    ├─ Scenario 2: ADD_LINE (line_id=302, area=ASSEMBLY)     │
│    ├─ Scenario 3: MODIFY_VOLUME (model=HVDC, year=2026, ×0.8) │
│    └─ ...                                                    │
│                                                              │
│  scenario_results table (optional cache):                   │
│    ├─ Scenario 1: { avgUtil: 78%, bottlenecks: 3, ... }     │
│    ├─ Scenario 2: { avgUtil: 85%, bottlenecks: 1, ... }     │
│    └─ Scenario 3: { avgUtil: 65%, bottlenecks: 0, ... }     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     RENDERER (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ScenarioTabs Component:                                     │
│    [Base] [+2 Lines*] [-20% Volume] [+]                      │
│                                                              │
│  Active Scenario View:                                       │
│    - Canvas (shows scenario-specific data)                   │
│    - Analysis Control Bar                                    │
│    - Results Panel (scenario results)                        │
│                                                              │
│  Scenario Manager Modal:                                     │
│    - New Scenario button                                     │
│    - Rename Scenario                                         │
│    - Duplicate Scenario                                      │
│    - Delete Scenario                                         │
│    - Compare Scenarios button                                │
│                                                              │
│  Compare Scenarios Modal:                                    │
│    Side-by-side metrics table                                │
└─────────────────────────────────────────────────────────────┘
```

### Data Model

#### scenarios Table

```sql
CREATE TABLE scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_base BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Cached metadata (for quick comparison)
  last_analysis_result TEXT,  -- JSON: { avgUtilization, bottlenecks, unmetDemand }

  CONSTRAINT unique_base CHECK (
    (SELECT COUNT(*) FROM scenarios WHERE is_base = 1) <= 1
  )
);

-- Base scenario is always id=1
INSERT INTO scenarios (id, name, is_base) VALUES (1, 'Base', 1);
```

#### scenario_changes Table

```sql
CREATE TABLE scenario_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL,
  change_type TEXT NOT NULL,  -- ADD_LINE, MODIFY_LINE, DELETE_LINE, MODIFY_VOLUME, etc.
  entity_type TEXT NOT NULL,  -- 'line', 'model', 'volume', 'compatibility', 'canvas_object'
  entity_id TEXT,              -- ID of affected entity (if modifying existing)
  change_data TEXT NOT NULL,   -- JSON: full change details
  applied_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_scenario_changes_scenario ON scenario_changes(scenario_id);
CREATE INDEX idx_scenario_changes_type ON scenario_changes(change_type);
```

**Change Types:**

```typescript
// src/shared/types/scenario.ts

export type ScenarioChangeType =
  // Production Lines
  | 'ADD_LINE'
  | 'MODIFY_LINE'
  | 'DELETE_LINE'

  // Product Models
  | 'ADD_MODEL'
  | 'MODIFY_MODEL'
  | 'DELETE_MODEL'

  // Volumes
  | 'MODIFY_VOLUME'      // Change volume for specific model-year
  | 'SCALE_VOLUMES'      // Multiply all volumes by factor (e.g., ×0.8 for -20%)

  // Compatibilities
  | 'ADD_COMPATIBILITY'
  | 'MODIFY_COMPATIBILITY'
  | 'DELETE_COMPATIBILITY'

  // Canvas Objects
  | 'MODIFY_CANVAS_OBJECT'  // Position, properties
  | 'DELETE_CANVAS_OBJECT'

  // Changeover
  | 'MODIFY_CHANGEOVER_DEFAULT'
  | 'ADD_CHANGEOVER_OVERRIDE'
  | 'MODIFY_CHANGEOVER_OVERRIDE'
  | 'DELETE_CHANGEOVER_OVERRIDE';

export interface ScenarioChange {
  id: number;
  scenarioId: number;
  changeType: ScenarioChangeType;
  entityType: 'line' | 'model' | 'volume' | 'compatibility' | 'canvas_object' | 'changeover';
  entityId?: string;  // Null for ADD operations
  changeData: Record<string, any>;  // Full change details
  appliedAt: string;
}

// Example change_data structures:

// ADD_LINE
{
  line: {
    name: "ASSEMBLY-301",
    area: "ASSEMBLY",
    plant_id: 1,
    time_available: 14.5,
    // ... full ProductionLine object
  }
}

// MODIFY_LINE
{
  lineId: 25,
  changes: {
    time_available: 16.0,  // Changed from 14.5 to 16.0
    efficiency: 92         // Changed from 85 to 92
  }
}

// SCALE_VOLUMES
{
  factor: 0.8,           // Multiply all volumes by 0.8 (-20%)
  years: [2026, 2027],   // Apply to these years
  modelIds: [1, 2, 3]    // Apply to these models (or null for all)
}

// MODIFY_VOLUME
{
  modelId: 5,
  year: 2026,
  oldVolume: 1000,
  newVolume: 800
}
```

#### TypeScript Interfaces

```typescript
// src/shared/types/scenario.ts

export interface Scenario {
  id: number;
  name: string;
  description?: string;
  isBase: boolean;
  createdAt: string;
  updatedAt: string;

  // Cached analysis result (for quick comparison without re-running)
  lastAnalysisResult?: ScenarioAnalysisResult;
}

export interface ScenarioAnalysisResult {
  avgUtilization: number;
  bottleneckCount: number;
  unmetDemandTotal: number;
  totalCapacity: number;
  utilizationByArea: Record<string, number>;
  timestamp: string;
}

export interface ScenarioComparison {
  scenarios: Scenario[];
  metrics: {
    scenarioId: number;
    scenarioName: string;
    avgUtilization: number;
    bottlenecks: number;
    unmetDemand: number;
    totalLines: number;
    totalModels: number;
  }[];
}
```

### IPC Channels

```typescript
// src/shared/constants/index.ts

export const SCENARIO_CHANNELS = {
  // Scenario CRUD
  GET_ALL: 'scenario:get-all',
  GET_BY_ID: 'scenario:get-by-id',
  CREATE: 'scenario:create',
  UPDATE: 'scenario:update',
  DELETE: 'scenario:delete',
  DUPLICATE: 'scenario:duplicate',

  // Scenario activation (switch to scenario)
  ACTIVATE: 'scenario:activate',
  GET_ACTIVE: 'scenario:get-active',

  // Changes
  GET_CHANGES: 'scenario:get-changes',
  APPLY_CHANGE: 'scenario:apply-change',
  REVERT_CHANGE: 'scenario:revert-change',

  // Comparison
  COMPARE: 'scenario:compare',
} as const;

export const SCENARIO_EVENTS = {
  SCENARIO_CREATED: 'scenario:created',
  SCENARIO_UPDATED: 'scenario:updated',
  SCENARIO_DELETED: 'scenario:deleted',
  SCENARIO_ACTIVATED: 'scenario:activated',  // Switched to different scenario
} as const;
```

### Trade-offs & Decisions

| Decision | Chosen Option | Alternative | Justification |
|----------|---------------|-------------|---------------|
| **Storage model** | Base + Deltas | Full copies | Space-efficient, clear relationship |
| **Base scenario** | Immutable (can't delete) | Deletable | Prevents orphaned changes |
| **Change granularity** | Entity-level (ADD_LINE, MODIFY_VOLUME) | Field-level | Simpler, sufficient for use cases |
| **Analysis caching** | Cache last result | Always re-run | Quick comparison without re-optimization |
| **UI pattern** | Tabs (Excel-like) | Dropdown selector | More visual, easier to compare |
| **Scenario limit** | No limit (Phase 8.1) | Max 10 scenarios | Simplicity, can add limit later if needed |

---

## BLOQUE 1: Database Schema - Scenario Tables

**Objetivo:** Add scenario tables to database.

**Migration File:** `src/main/database/migrations/019_scenarios.sql`

```sql
-- ============================================
-- MIGRATION 019: Scenarios
-- PHASE: 8.1 - Scenarios & Comparison
-- BREAKING CHANGE: NO
-- BACKWARD COMPATIBLE: YES (only adds tables)
-- ============================================

-- Scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_base BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_analysis_result TEXT,  -- JSON cache

  CHECK (is_base IN (0, 1))
);

-- Create Base scenario
INSERT INTO scenarios (id, name, is_base) VALUES (1, 'Base', 1);

-- Scenario changes (deltas vs Base)
CREATE TABLE IF NOT EXISTS scenario_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  change_data TEXT NOT NULL,  -- JSON
  applied_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenario_changes_scenario
  ON scenario_changes(scenario_id);

CREATE INDEX IF NOT EXISTS idx_scenario_changes_type
  ON scenario_changes(change_type);

CREATE INDEX IF NOT EXISTS idx_scenario_changes_entity
  ON scenario_changes(entity_type, entity_id);

-- Active scenario (stored in project_metadata)
INSERT OR IGNORE INTO project_metadata (key, value) VALUES ('active_scenario_id', '1');
```

**CHECKPOINT (30 sec):**

```bash
# 1. Type-check
npm run type-check

# 2. Apply migration
npm run db:reset

# 3. Verify tables
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << EOF
SELECT * FROM scenarios;
SELECT * FROM scenario_changes;
SELECT value FROM project_metadata WHERE key = 'active_scenario_id';
EOF

# Expected: Base scenario exists, active_scenario_id = 1
```

**Criterios de éxito:**
- [ ] Migration applies without errors
- [ ] scenarios table exists
- [ ] scenario_changes table exists
- [ ] Base scenario (id=1) is created
- [ ] active_scenario_id is set in project_metadata

---

## BLOQUE 2: Scenario Repository

**Objetivo:** Implement CRUD operations for scenarios.

**File:** `src/main/database/repositories/SQLiteScenarioRepository.ts`

```typescript
import Database from 'better-sqlite3';
import { Scenario, ScenarioChange, ScenarioAnalysisResult } from '@shared/types/scenario';

export class SQLiteScenarioRepository {
  constructor(private db: Database.Database) {}

  /**
   * Get all scenarios.
   */
  getAll(): Scenario[] {
    const rows = this.db
      .prepare(
        `SELECT
          id, name, description, is_base as isBase,
          created_at as createdAt, updated_at as updatedAt,
          last_analysis_result as lastAnalysisResult
        FROM scenarios
        ORDER BY id ASC`
      )
      .all() as any[];

    return rows.map(row => ({
      ...row,
      isBase: Boolean(row.isBase),
      lastAnalysisResult: row.lastAnalysisResult
        ? JSON.parse(row.lastAnalysisResult)
        : undefined,
    }));
  }

  /**
   * Get scenario by ID.
   */
  getById(id: number): Scenario | null {
    const row = this.db
      .prepare(
        `SELECT
          id, name, description, is_base as isBase,
          created_at as createdAt, updated_at as updatedAt,
          last_analysis_result as lastAnalysisResult
        FROM scenarios
        WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      ...row,
      isBase: Boolean(row.isBase),
      lastAnalysisResult: row.lastAnalysisResult
        ? JSON.parse(row.lastAnalysisResult)
        : undefined,
    };
  }

  /**
   * Create new scenario (as copy of Base).
   */
  create(name: string, description?: string): Scenario {
    const result = this.db
      .prepare(
        `INSERT INTO scenarios (name, description, is_base)
        VALUES (?, ?, 0)`
      )
      .run(name, description || '');

    const newScenario = this.getById(result.lastInsertRowid as number);
    if (!newScenario) throw new Error('Failed to create scenario');

    return newScenario;
  }

  /**
   * Update scenario metadata (name, description).
   */
  update(id: number, updates: { name?: string; description?: string }): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = datetime("now")');
    values.push(id);

    this.db
      .prepare(`UPDATE scenarios SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  /**
   * Delete scenario (cannot delete Base).
   */
  delete(id: number): void {
    const scenario = this.getById(id);
    if (!scenario) throw new Error('Scenario not found');
    if (scenario.isBase) throw new Error('Cannot delete Base scenario');

    this.db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
  }

  /**
   * Duplicate scenario (copy all changes).
   */
  duplicate(id: number, newName: string): Scenario {
    const original = this.getById(id);
    if (!original) throw new Error('Scenario not found');

    // Create new scenario
    const newScenario = this.create(newName, `Copy of ${original.name}`);

    // Copy all changes
    const changes = this.getChanges(id);
    const insertStmt = this.db.prepare(
      `INSERT INTO scenario_changes
        (scenario_id, change_type, entity_type, entity_id, change_data)
      VALUES (?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction(() => {
      changes.forEach(change => {
        insertStmt.run(
          newScenario.id,
          change.changeType,
          change.entityType,
          change.entityId || null,
          JSON.stringify(change.changeData)
        );
      });
    });

    transaction();

    return newScenario;
  }

  /**
   * Get all changes for a scenario.
   */
  getChanges(scenarioId: number): ScenarioChange[] {
    const rows = this.db
      .prepare(
        `SELECT
          id, scenario_id as scenarioId, change_type as changeType,
          entity_type as entityType, entity_id as entityId,
          change_data as changeData, applied_at as appliedAt
        FROM scenario_changes
        WHERE scenario_id = ?
        ORDER BY id ASC`
      )
      .all(scenarioId) as any[];

    return rows.map(row => ({
      ...row,
      changeData: JSON.parse(row.changeData),
    }));
  }

  /**
   * Add change to scenario.
   */
  addChange(
    scenarioId: number,
    changeType: string,
    entityType: string,
    entityId: string | null,
    changeData: Record<string, any>
  ): void {
    this.db
      .prepare(
        `INSERT INTO scenario_changes
          (scenario_id, change_type, entity_type, entity_id, change_data)
        VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        scenarioId,
        changeType,
        entityType,
        entityId,
        JSON.stringify(changeData)
      );

    // Update scenario timestamp
    this.db
      .prepare('UPDATE scenarios SET updated_at = datetime("now") WHERE id = ?')
      .run(scenarioId);
  }

  /**
   * Cache analysis result for quick comparison.
   */
  cacheAnalysisResult(scenarioId: number, result: ScenarioAnalysisResult): void {
    this.db
      .prepare(
        `UPDATE scenarios
        SET last_analysis_result = ?, updated_at = datetime("now")
        WHERE id = ?`
      )
      .run(JSON.stringify(result), scenarioId);
  }

  /**
   * Get active scenario ID.
   */
  getActiveScenarioId(): number {
    const row = this.db
      .prepare('SELECT value FROM project_metadata WHERE key = ?')
      .get('active_scenario_id') as { value: string } | undefined;

    return row ? parseInt(row.value, 10) : 1; // Default to Base
  }

  /**
   * Set active scenario.
   */
  setActiveScenarioId(scenarioId: number): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO project_metadata (key, value, updated_at)
        VALUES ('active_scenario_id', ?, datetime('now'))`
      )
      .run(scenarioId.toString());
  }
}
```

**CHECKPOINT (30 sec):**

```bash
# Type-check
npm run type-check

# Manual test in Node REPL
node
> const Database = require('better-sqlite3');
> const db = new Database('~/Library/Application Support/Line Optimizer/line-optimizer.db');
> const repo = new SQLiteScenarioRepository(db);
> repo.create('Test Scenario', 'Testing');
> repo.getAll();  // Should return Base + Test Scenario
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Can create scenarios
- [ ] Can get all scenarios
- [ ] Can delete scenarios (except Base)
- [ ] Can duplicate scenarios

---

## BLOQUE 3: Scenario Service - Apply/Revert Changes

**Objetivo:** Apply scenario changes to reconstruct scenario state.

**File:** `src/main/services/scenario/ScenarioService.ts`

```typescript
import Database from 'better-sqlite3';
import { SQLiteScenarioRepository } from '@main/database/repositories/SQLiteScenarioRepository';
import { ScenarioChange } from '@shared/types/scenario';

/**
 * Applies scenario changes to database to reconstruct scenario state.
 *
 * Strategy:
 * - Base scenario: No changes needed (current DB is Base)
 * - Other scenarios: Apply deltas on top of Base
 */
export class ScenarioService {
  private scenarioRepo: SQLiteScenarioRepository;

  constructor(private db: Database.Database) {
    this.scenarioRepo = new SQLiteScenarioRepository(db);
  }

  /**
   * Activate a scenario (apply its changes to current database state).
   *
   * NOTE: This modifies the in-memory database.
   * Changes are NOT persisted to .lop until user saves project.
   *
   * @param scenarioId Scenario to activate
   */
  async activateScenario(scenarioId: number): Promise<void> {
    const scenario = this.scenarioRepo.getById(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    // If already active, do nothing
    const currentActive = this.scenarioRepo.getActiveScenarioId();
    if (currentActive === scenarioId) return;

    // Step 1: Revert to Base state
    // (Reload database from Base - NOT IMPLEMENTED IN PHASE 8.1)
    // For Phase 8.1: Assume we're starting from Base
    // Phase 8.2: Implement proper state restoration

    if (!scenario.isBase) {
      // Step 2: Apply changes
      const changes = this.scenarioRepo.getChanges(scenarioId);
      await this.applyChanges(changes);
    }

    // Step 3: Mark as active
    this.scenarioRepo.setActiveScenarioId(scenarioId);
  }

  /**
   * Apply list of changes to database.
   */
  private async applyChanges(changes: ScenarioChange[]): Promise<void> {
    const transaction = this.db.transaction(() => {
      changes.forEach(change => {
        this.applyChange(change);
      });
    });

    transaction();
  }

  /**
   * Apply single change to database.
   */
  private applyChange(change: ScenarioChange): void {
    switch (change.changeType) {
      case 'ADD_LINE':
        this.applyAddLine(change);
        break;

      case 'MODIFY_LINE':
        this.applyModifyLine(change);
        break;

      case 'DELETE_LINE':
        this.applyDeleteLine(change);
        break;

      case 'MODIFY_VOLUME':
        this.applyModifyVolume(change);
        break;

      case 'SCALE_VOLUMES':
        this.applyScaleVolumes(change);
        break;

      // Add more handlers as needed
      default:
        console.warn(`[ScenarioService] Unhandled change type: ${change.changeType}`);
    }
  }

  private applyAddLine(change: ScenarioChange): void {
    const { line } = change.changeData;

    this.db
      .prepare(
        `INSERT INTO production_lines
          (name, area, plant_id, time_available, active)
        VALUES (?, ?, ?, ?, 1)`
      )
      .run(line.name, line.area, line.plant_id, line.time_available);
  }

  private applyModifyLine(change: ScenarioChange): void {
    const { lineId, changes } = change.changeData;

    const fields = Object.keys(changes).map(key => `${key} = ?`).join(', ');
    const values = Object.values(changes);

    this.db
      .prepare(`UPDATE production_lines SET ${fields} WHERE id = ?`)
      .run(...values, lineId);
  }

  private applyDeleteLine(change: ScenarioChange): void {
    const { lineId } = change.changeData;

    this.db
      .prepare('UPDATE production_lines SET active = 0 WHERE id = ?')
      .run(lineId);
  }

  private applyModifyVolume(change: ScenarioChange): void {
    const { modelId, year, newVolume } = change.changeData;

    this.db
      .prepare(
        `UPDATE product_volumes
        SET volume = ?
        WHERE model_id = ? AND year = ?`
      )
      .run(newVolume, modelId, year);
  }

  private applyScaleVolumes(change: ScenarioChange): void {
    const { factor, years, modelIds } = change.changeData;

    let query = 'UPDATE product_volumes SET volume = ROUND(volume * ?)';
    const params: any[] = [factor];

    if (years && years.length > 0) {
      query += ` WHERE year IN (${years.map(() => '?').join(',')})`;
      params.push(...years);
    }

    if (modelIds && modelIds.length > 0) {
      query += years ? ' AND' : ' WHERE';
      query += ` model_id IN (${modelIds.map(() => '?').join(',')})`;
      params.push(...modelIds);
    }

    this.db.prepare(query).run(...params);
  }

  /**
   * Get comparison data for multiple scenarios.
   */
  async compareScenarios(scenarioIds: number[]): Promise<any> {
    const scenarios = scenarioIds
      .map(id => this.scenarioRepo.getById(id))
      .filter(Boolean);

    const comparison = scenarios.map(scenario => {
      // Get cached result or compute
      const result = scenario!.lastAnalysisResult || {
        avgUtilization: 0,
        bottleneckCount: 0,
        unmetDemandTotal: 0,
      };

      return {
        scenarioId: scenario!.id,
        scenarioName: scenario!.name,
        avgUtilization: result.avgUtilization,
        bottlenecks: result.bottleneckCount,
        unmetDemand: result.unmetDemandTotal,
      };
    });

    return { scenarios, metrics: comparison };
  }
}
```

**CHECKPOINT (1 min):**

```bash
# Type-check
npm run type-check

# Manual test
# 1. Create scenario
# 2. Add change (ADD_LINE)
# 3. Activate scenario
# 4. Verify line appears in database
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Can activate Base scenario
- [ ] Can activate variant scenario
- [ ] Changes are applied correctly
- [ ] Database state matches scenario

---

## BLOQUE 4: IPC Handlers - Scenario Operations

**Objetivo:** Expose scenario operations to renderer.

**File:** `src/main/ipc/handlers/scenario.handler.ts`

```typescript
import { ipcMain } from 'electron';
import { SCENARIO_CHANNELS } from '@shared/constants';
import { ApiResponse } from '@shared/types';
import { Scenario, ScenarioComparison } from '@shared/types/scenario';
import DatabaseConnection from '@main/database/connection';
import { SQLiteScenarioRepository } from '@main/database/repositories/SQLiteScenarioRepository';
import { ScenarioService } from '@main/services/scenario/ScenarioService';

export function registerScenarioHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repo = new SQLiteScenarioRepository(db);
  const service = new ScenarioService(db);

  // ===== GET ALL SCENARIOS =====
  ipcMain.handle(
    SCENARIO_CHANNELS.GET_ALL,
    async (): Promise<ApiResponse<Scenario[]>> => {
      try {
        const scenarios = repo.getAll();
        return { success: true, data: scenarios };
      } catch (error) {
        console.error('[Scenario Handler] Get all error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== CREATE SCENARIO =====
  ipcMain.handle(
    SCENARIO_CHANNELS.CREATE,
    async (_event, name: string, description?: string): Promise<ApiResponse<Scenario>> => {
      try {
        const scenario = repo.create(name, description);
        return { success: true, data: scenario };
      } catch (error) {
        console.error('[Scenario Handler] Create error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== UPDATE SCENARIO =====
  ipcMain.handle(
    SCENARIO_CHANNELS.UPDATE,
    async (_event, id: number, updates: { name?: string; description?: string }): Promise<ApiResponse<void>> => {
      try {
        repo.update(id, updates);
        return { success: true };
      } catch (error) {
        console.error('[Scenario Handler] Update error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== DELETE SCENARIO =====
  ipcMain.handle(
    SCENARIO_CHANNELS.DELETE,
    async (_event, id: number): Promise<ApiResponse<void>> => {
      try {
        repo.delete(id);
        return { success: true };
      } catch (error) {
        console.error('[Scenario Handler] Delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== DUPLICATE SCENARIO =====
  ipcMain.handle(
    SCENARIO_CHANNELS.DUPLICATE,
    async (_event, id: number, newName: string): Promise<ApiResponse<Scenario>> => {
      try {
        const scenario = repo.duplicate(id, newName);
        return { success: true, data: scenario };
      } catch (error) {
        console.error('[Scenario Handler] Duplicate error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== ACTIVATE SCENARIO =====
  ipcMain.handle(
    SCENARIO_CHANNELS.ACTIVATE,
    async (_event, id: number): Promise<ApiResponse<void>> => {
      try {
        await service.activateScenario(id);
        return { success: true };
      } catch (error) {
        console.error('[Scenario Handler] Activate error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== GET ACTIVE SCENARIO =====
  ipcMain.handle(
    SCENARIO_CHANNELS.GET_ACTIVE,
    async (): Promise<ApiResponse<number>> => {
      try {
        const activeId = repo.getActiveScenarioId();
        return { success: true, data: activeId };
      } catch (error) {
        console.error('[Scenario Handler] Get active error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ===== COMPARE SCENARIOS =====
  ipcMain.handle(
    SCENARIO_CHANNELS.COMPARE,
    async (_event, scenarioIds: number[]): Promise<ApiResponse<ScenarioComparison>> => {
      try {
        const comparison = await service.compareScenarios(scenarioIds);
        return { success: true, data: comparison };
      } catch (error) {
        console.error('[Scenario Handler] Compare error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[Scenario Handler] Registered scenario handlers');
}
```

**Register in Main:**

```typescript
// src/main/index.ts
import { registerScenarioHandlers } from './ipc/handlers/scenario.handler';

registerScenarioHandlers();
```

**CHECKPOINT (30 sec):**

```bash
npm run type-check
npm start
# Check console: "[Scenario Handler] Registered scenario handlers"
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Handlers registered without errors

---

## BLOQUE 5: Frontend - Scenario Tabs

**Objetivo:** Add tab interface for switching scenarios.

**File:** `src/renderer/components/scenarios/ScenarioTabs.tsx`

```typescript
import { useCallback } from 'react';
import { PlusIcon, MoreVerticalIcon } from 'lucide-react';
import { useScenarioStore } from '@renderer/store/useScenarioStore';
import { Scenario } from '@shared/types/scenario';

export const ScenarioTabs = () => {
  const { scenarios, activeScenarioId, activateScenario, openScenarioManager } = useScenarioStore();

  const handleTabClick = useCallback((scenarioId: number) => {
    activateScenario(scenarioId);
  }, [activateScenario]);

  const handleNewScenario = useCallback(() => {
    openScenarioManager();
  }, [openScenarioManager]);

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white">
      {scenarios.map(scenario => {
        const isActive = scenario.id === activeScenarioId;

        return (
          <button
            key={scenario.id}
            onClick={() => handleTabClick(scenario.id)}
            className={`
              px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
              ${isActive
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            {scenario.name}
            {scenario.isBase && (
              <span className="ml-2 text-xs text-gray-400">(Base)</span>
            )}
          </button>
        );
      })}

      {/* New Scenario Button */}
      <button
        onClick={handleNewScenario}
        className="px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="New Scenario"
      >
        <PlusIcon className="w-4 h-4" />
      </button>

      {/* Scenario Manager Button */}
      <button
        onClick={openScenarioManager}
        className="ml-auto px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Scenario Manager"
      >
        <MoreVerticalIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
```

**Zustand Store:**

```typescript
// src/renderer/store/useScenarioStore.ts

import { create } from 'zustand';
import { SCENARIO_CHANNELS, SCENARIO_EVENTS } from '@shared/constants';
import { Scenario, ScenarioComparison } from '@shared/types/scenario';

interface ScenarioStore {
  scenarios: Scenario[];
  activeScenarioId: number;
  showScenarioManager: boolean;
  showCompareModal: boolean;
  comparisonData: ScenarioComparison | null;

  // Actions
  loadScenarios: () => Promise<void>;
  createScenario: (name: string, description?: string) => Promise<void>;
  updateScenario: (id: number, updates: { name?: string; description?: string }) => Promise<void>;
  deleteScenario: (id: number) => Promise<void>;
  duplicateScenario: (id: number, newName: string) => Promise<void>;
  activateScenario: (id: number) => Promise<void>;
  compareScenarios: (scenarioIds: number[]) => Promise<void>;

  // UI state
  openScenarioManager: () => void;
  closeScenarioManager: () => void;
  openCompareModal: () => void;
  closeCompareModal: () => void;
}

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenarios: [],
  activeScenarioId: 1,
  showScenarioManager: false,
  showCompareModal: false,
  comparisonData: null,

  loadScenarios: async () => {
    const response = await window.electronAPI.invoke<Scenario[]>(SCENARIO_CHANNELS.GET_ALL);

    if (response.success && response.data) {
      set({ scenarios: response.data });
    }

    // Load active scenario
    const activeResponse = await window.electronAPI.invoke<number>(SCENARIO_CHANNELS.GET_ACTIVE);

    if (activeResponse.success && activeResponse.data) {
      set({ activeScenarioId: activeResponse.data });
    }
  },

  createScenario: async (name, description) => {
    const response = await window.electronAPI.invoke<Scenario>(
      SCENARIO_CHANNELS.CREATE,
      name,
      description
    );

    if (response.success && response.data) {
      await get().loadScenarios();
      await get().activateScenario(response.data.id);
    }
  },

  updateScenario: async (id, updates) => {
    const response = await window.electronAPI.invoke<void>(
      SCENARIO_CHANNELS.UPDATE,
      id,
      updates
    );

    if (response.success) {
      await get().loadScenarios();
    }
  },

  deleteScenario: async (id) => {
    const response = await window.electronAPI.invoke<void>(SCENARIO_CHANNELS.DELETE, id);

    if (response.success) {
      // If deleted active scenario, switch to Base
      if (get().activeScenarioId === id) {
        await get().activateScenario(1);
      }

      await get().loadScenarios();
    }
  },

  duplicateScenario: async (id, newName) => {
    const response = await window.electronAPI.invoke<Scenario>(
      SCENARIO_CHANNELS.DUPLICATE,
      id,
      newName
    );

    if (response.success && response.data) {
      await get().loadScenarios();
      await get().activateScenario(response.data.id);
    }
  },

  activateScenario: async (id) => {
    const response = await window.electronAPI.invoke<void>(SCENARIO_CHANNELS.ACTIVATE, id);

    if (response.success) {
      set({ activeScenarioId: id });
      // Trigger data reload in canvas/analysis stores
      // (Implementation depends on existing store structure)
    }
  },

  compareScenarios: async (scenarioIds) => {
    const response = await window.electronAPI.invoke<ScenarioComparison>(
      SCENARIO_CHANNELS.COMPARE,
      scenarioIds
    );

    if (response.success && response.data) {
      set({ comparisonData: response.data, showCompareModal: true });
    }
  },

  // UI state
  openScenarioManager: () => set({ showScenarioManager: true }),
  closeScenarioManager: () => set({ showScenarioManager: false }),
  openCompareModal: () => set({ showCompareModal: true }),
  closeCompareModal: () => set({ showCompareModal: false }),
}));

// Load scenarios on mount
if (window.electronAPI) {
  setTimeout(() => {
    useScenarioStore.getState().loadScenarios();
  }, 100);
}
```

**Integrate in AppLayout:**

```typescript
// src/renderer/components/layout/AppLayout.tsx

import { ScenarioTabs } from '../scenarios/ScenarioTabs';

export const AppLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      <FileMenu />
      <ScenarioTabs />  {/* NEW */}
      {/* Rest of layout */}
    </div>
  );
};
```

**CHECKPOINT (1 min):**

```bash
npm run type-check
npm start
# Verify:
#  - Scenario tabs appear below File menu
#  - Base tab is active by default
#  - Can click tabs to switch (visual feedback)
#  - + button appears
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Scenario tabs render correctly
- [ ] Active tab is highlighted
- [ ] Can switch between tabs
- [ ] New scenario button appears

---

## BLOQUE 6: Scenario Manager Modal

**Objetivo:** Add modal for managing scenarios (create, rename, delete, duplicate).

**File:** `src/renderer/components/scenarios/ScenarioManagerModal.tsx`

```typescript
import { useState, useCallback } from 'react';
import { XIcon, CopyIcon, TrashIcon, EditIcon } from 'lucide-react';
import { useScenarioStore } from '@renderer/store/useScenarioStore';

export const ScenarioManagerModal = () => {
  const {
    scenarios,
    activeScenarioId,
    showScenarioManager,
    closeScenarioManager,
    createScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
  } = useScenarioStore();

  const [newScenarioName, setNewScenarioName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = useCallback(async () => {
    if (!newScenarioName.trim()) return;

    await createScenario(newScenarioName);
    setNewScenarioName('');
    closeScenarioManager();
  }, [newScenarioName, createScenario, closeScenarioManager]);

  const handleRename = useCallback(async (id: number) => {
    if (!editingName.trim()) return;

    await updateScenario(id, { name: editingName });
    setEditingId(null);
    setEditingName('');
  }, [editingName, updateScenario]);

  const handleDelete = useCallback(async (id: number) => {
    const confirmed = confirm('Are you sure you want to delete this scenario?');
    if (!confirmed) return;

    await deleteScenario(id);
  }, [deleteScenario]);

  const handleDuplicate = useCallback(async (id: number) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;

    const newName = prompt('Enter name for duplicated scenario:', `${scenario.name} (Copy)`);
    if (!newName) return;

    await duplicateScenario(id, newName);
  }, [scenarios, duplicateScenario]);

  if (!showScenarioManager) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Scenario Manager</h2>
          <button
            onClick={closeScenarioManager}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* New Scenario Form */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Create New Scenario
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Scenario name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>

          {/* Scenarios List */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Existing Scenarios</h3>
            <div className="space-y-2">
              {scenarios.map(scenario => {
                const isEditing = editingId === scenario.id;
                const isActive = activeScenarioId === scenario.id;

                return (
                  <div
                    key={scenario.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border
                      ${isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
                    `}
                  >
                    {/* Name */}
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleRename(scenario.id)}
                        onBlur={() => handleRename(scenario.id)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {scenario.name}
                          {scenario.isBase && (
                            <span className="ml-2 text-xs text-gray-500">(Base)</span>
                          )}
                          {isActive && (
                            <span className="ml-2 text-xs text-blue-600">(Active)</span>
                          )}
                        </div>
                        {scenario.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {scenario.description}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!scenario.isBase && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(scenario.id);
                              setEditingName(scenario.name);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Rename"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(scenario.id)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Duplicate"
                          >
                            <CopyIcon className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(scenario.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={closeScenarioManager}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Integrate in AppLayout:**

```typescript
// src/renderer/components/layout/AppLayout.tsx

import { ScenarioManagerModal } from '../scenarios/ScenarioManagerModal';

export const AppLayout = () => {
  return (
    <>
      <div className="h-screen flex flex-col">
        {/* ... */}
      </div>

      {/* Modals */}
      <ScenarioManagerModal />
    </>
  );
};
```

**CHECKPOINT (1 min):**

```bash
npm run type-check
npm start
# Verify:
#  - Click + button or manager button
#  - Modal appears
#  - Can create new scenario
#  - Can rename/duplicate/delete scenarios
```

**Criterios de éxito:**
- [ ] Type-check passes
- [ ] Modal opens/closes correctly
- [ ] Can create scenarios
- [ ] Can rename scenarios
- [ ] Can duplicate scenarios
- [ ] Can delete scenarios (except Base)

---

## BLOQUE FINAL: Compare Scenarios

**File:** `src/renderer/components/scenarios/CompareScenario sModal.tsx`

```typescript
import { XIcon } from 'lucide-react';
import { useScenarioStore } from '@renderer/store/useScenarioStore';

export const CompareScenariosModal = () => {
  const { showCompareModal, closeCompareModal, comparisonData } = useScenarioStore();

  if (!showCompareModal || !comparisonData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Compare Scenarios</h2>
          <button
            onClick={closeCompareModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600">Metric</th>
                {comparisonData.metrics.map(metric => (
                  <th key={metric.scenarioId} className="text-left py-3 px-4 text-gray-800">
                    {metric.scenarioName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-600">Avg Utilization</td>
                {comparisonData.metrics.map(metric => (
                  <td key={metric.scenarioId} className="py-3 px-4 text-gray-800 font-medium">
                    {metric.avgUtilization.toFixed(1)}%
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-600">Bottlenecks</td>
                {comparisonData.metrics.map(metric => (
                  <td key={metric.scenarioId} className="py-3 px-4 text-gray-800 font-medium">
                    {metric.bottlenecks}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-600">Unmet Demand</td>
                {comparisonData.metrics.map(metric => (
                  <td key={metric.scenarioId} className="py-3 px-4 text-gray-800 font-medium">
                    {metric.unmetDemand.toLocaleString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={closeCompareModal}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Testing:**

1. Create 2-3 scenarios
2. Run optimization for each
3. Click "Compare" button
4. Verify metrics table shows all scenarios

---

## Success Criteria

**Phase 8.1 is complete when:**

- [ ] **Scenario Management:**
  - [ ] Base scenario exists by default
  - [ ] Can create new scenarios
  - [ ] Can rename scenarios
  - [ ] Can duplicate scenarios
  - [ ] Can delete scenarios (except Base)

- [ ] **Scenario Switching:**
  - [ ] Tabs appear below File menu
  - [ ] Active tab is highlighted
  - [ ] Clicking tab switches scenario
  - [ ] Canvas reflects scenario-specific data

- [ ] **Data Isolation:**
  - [ ] Changes in one scenario don't affect others
  - [ ] Base scenario is immutable

- [ ] **Comparison:**
  - [ ] Can select multiple scenarios to compare
  - [ ] Comparison table shows key metrics
  - [ ] Metrics are accurate

- [ ] **Persistence:**
  - [ ] All scenarios saved in .lop file
  - [ ] Scenarios persist across save/load
  - [ ] Active scenario restored on project open

---

## Implementation Command

```bash
claude "@backend-architect @frontend-developer implement phase-8.1-scenarios according to docs/specs/phase-8.1-scenarios.md"
```

---

**Status:** Ready for Implementation
**Prerequisite:** Phase 8.0 (Project Files Foundation)
**Blocks:** None (Phase 9 can start independently)
