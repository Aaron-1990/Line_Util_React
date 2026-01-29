// ============================================
// SQLITE REPOSITORY: Changeover
// Phase 5: Changeover time management
// Three-tier resolution: Global → Family → Line Override
// ============================================

import Database from 'better-sqlite3';
import crypto from 'crypto';
import type {
  FamilyChangeoverDefault,
  LineChangeoverOverride,
  ResolvedChangeoverTime,
  ChangeoverMatrix,
  ChangeoverMatrixCell,
  MatrixModel,
  MatrixFamily,
  ChangeoverMethodId,
} from '@shared/types/changeover';
import { CHANGEOVER_DEFAULTS } from '@shared/types/changeover';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface FamilyChangeoverRow {
  id: string;
  from_family: string;
  to_family: string;
  changeover_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LineChangeoverRow {
  id: string;
  line_id: string;
  from_model_id: string;
  to_model_id: string;
  changeover_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ResolvedChangeoverRow {
  line_id: string;
  from_model_id: string;
  from_model_name: string;
  from_family: string;
  to_model_id: string;
  to_model_name: string;
  to_family: string;
  changeover_minutes: number;
  source: 'same_model' | 'line_override' | 'family_default' | 'global_default';
}

interface ModelRow {
  id: string;
  name: string;
  family: string;
}

interface LineRow {
  id: string;
  name: string;
  area: string;
}

interface MethodConfigRow {
  id: string;
  context: string;
  method_id: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// REPOSITORY CLASS
// ============================================

export class SQLiteChangeoverRepository {
  constructor(private db: Database.Database) {}

  // ============================================
  // USER PREFERENCES (Global Settings)
  // ============================================

  async getGlobalDefault(): Promise<number> {
    const row = this.db
      .prepare('SELECT value FROM user_preferences WHERE key = ?')
      .get('changeover_default_minutes') as { value: string } | undefined;

    return row
      ? parseInt(row.value, 10)
      : CHANGEOVER_DEFAULTS.GLOBAL_DEFAULT_MINUTES;
  }

  async setGlobalDefault(minutes: number): Promise<void> {
    this.db
      .prepare(
        `UPDATE user_preferences
         SET value = ?, updated_at = datetime('now')
         WHERE key = ?`
      )
      .run(minutes.toString(), 'changeover_default_minutes');
  }

  async getSmedBenchmark(): Promise<number> {
    const row = this.db
      .prepare('SELECT value FROM user_preferences WHERE key = ?')
      .get('smed_benchmark_minutes') as { value: string } | undefined;

    return row
      ? parseInt(row.value, 10)
      : CHANGEOVER_DEFAULTS.SMED_BENCHMARK_MINUTES;
  }

  async setSmedBenchmark(minutes: number): Promise<void> {
    this.db
      .prepare(
        `UPDATE user_preferences
         SET value = ?, updated_at = datetime('now')
         WHERE key = ?`
      )
      .run(minutes.toString(), 'smed_benchmark_minutes');
  }

  // ============================================
  // GLOBAL CHANGEOVER TOGGLE (Phase 5.6)
  // ============================================

  async getGlobalEnabled(): Promise<boolean> {
    const row = this.db
      .prepare('SELECT value FROM user_preferences WHERE key = ?')
      .get('changeover_global_enabled') as { value: string } | undefined;

    // Default to true (enabled) if not found
    return row ? row.value === '1' : true;
  }

  async setGlobalEnabled(enabled: boolean): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO user_preferences (id, key, value, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = datetime('now')`
      )
      .run(
        'pref-changeover-global-enabled',
        'changeover_global_enabled',
        enabled ? '1' : '0',
        'Global toggle for changeover calculation (1=ON, 0=OFF)'
      );
  }

  // ============================================
  // FAMILY CHANGEOVER DEFAULTS
  // ============================================

  private mapFamilyRow(row: FamilyChangeoverRow): FamilyChangeoverDefault {
    return {
      id: row.id,
      fromFamily: row.from_family,
      toFamily: row.to_family,
      changeoverMinutes: row.changeover_minutes,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async getAllFamilyDefaults(): Promise<FamilyChangeoverDefault[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM family_changeover_defaults
         ORDER BY from_family, to_family`
      )
      .all() as FamilyChangeoverRow[];

    return rows.map(row => this.mapFamilyRow(row));
  }

  async getFamilyDefault(
    fromFamily: string,
    toFamily: string
  ): Promise<FamilyChangeoverDefault | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM family_changeover_defaults
         WHERE from_family = ? AND to_family = ?`
      )
      .get(fromFamily, toFamily) as FamilyChangeoverRow | undefined;

    return row ? this.mapFamilyRow(row) : null;
  }

  async setFamilyDefault(
    fromFamily: string,
    toFamily: string,
    changeoverMinutes: number,
    notes?: string
  ): Promise<FamilyChangeoverDefault> {
    const existing = await this.getFamilyDefault(fromFamily, toFamily);
    const now = new Date().toISOString();

    if (existing) {
      this.db
        .prepare(
          `UPDATE family_changeover_defaults
           SET changeover_minutes = ?, notes = ?, updated_at = ?
           WHERE from_family = ? AND to_family = ?`
        )
        .run(changeoverMinutes, notes ?? null, now, fromFamily, toFamily);

      return {
        ...existing,
        changeoverMinutes,
        notes,
        updatedAt: new Date(now),
      };
    } else {
      const id = crypto.randomUUID();
      this.db
        .prepare(
          `INSERT INTO family_changeover_defaults
           (id, from_family, to_family, changeover_minutes, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, fromFamily, toFamily, changeoverMinutes, notes ?? null, now, now);

      return {
        id,
        fromFamily,
        toFamily,
        changeoverMinutes,
        notes,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
    }
  }

  async deleteFamilyDefault(fromFamily: string, toFamily: string): Promise<boolean> {
    const result = this.db
      .prepare(
        `DELETE FROM family_changeover_defaults
         WHERE from_family = ? AND to_family = ?`
      )
      .run(fromFamily, toFamily);

    return result.changes > 0;
  }

  async bulkSetFamilyDefaults(
    defaults: Array<{
      fromFamily: string;
      toFamily: string;
      changeoverMinutes: number;
      notes?: string;
    }>
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO family_changeover_defaults
      (id, from_family, to_family, changeover_minutes, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(from_family, to_family) DO UPDATE SET
        changeover_minutes = excluded.changeover_minutes,
        notes = excluded.notes,
        updated_at = datetime('now')
    `);

    const insertMany = this.db.transaction((items: typeof defaults) => {
      for (const item of items) {
        stmt.run(
          crypto.randomUUID(),
          item.fromFamily,
          item.toFamily,
          item.changeoverMinutes,
          item.notes ?? null
        );
      }
      return items.length;
    });

    return insertMany(defaults);
  }

  // ============================================
  // LINE CHANGEOVER OVERRIDES
  // ============================================

  private mapLineOverrideRow(row: LineChangeoverRow): LineChangeoverOverride {
    return {
      id: row.id,
      lineId: row.line_id,
      fromModelId: row.from_model_id,
      toModelId: row.to_model_id,
      changeoverMinutes: row.changeover_minutes,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async getLineOverrides(lineId: string): Promise<LineChangeoverOverride[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM line_changeover_overrides
         WHERE line_id = ?
         ORDER BY from_model_id, to_model_id`
      )
      .all(lineId) as LineChangeoverRow[];

    return rows.map(row => this.mapLineOverrideRow(row));
  }

  async getLineOverride(
    lineId: string,
    fromModelId: string,
    toModelId: string
  ): Promise<LineChangeoverOverride | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM line_changeover_overrides
         WHERE line_id = ? AND from_model_id = ? AND to_model_id = ?`
      )
      .get(lineId, fromModelId, toModelId) as LineChangeoverRow | undefined;

    return row ? this.mapLineOverrideRow(row) : null;
  }

  async setLineOverride(
    lineId: string,
    fromModelId: string,
    toModelId: string,
    changeoverMinutes: number,
    notes?: string
  ): Promise<LineChangeoverOverride> {
    const existing = await this.getLineOverride(lineId, fromModelId, toModelId);
    const now = new Date().toISOString();

    if (existing) {
      this.db
        .prepare(
          `UPDATE line_changeover_overrides
           SET changeover_minutes = ?, notes = ?, updated_at = ?
           WHERE line_id = ? AND from_model_id = ? AND to_model_id = ?`
        )
        .run(changeoverMinutes, notes ?? null, now, lineId, fromModelId, toModelId);

      return {
        ...existing,
        changeoverMinutes,
        notes,
        updatedAt: new Date(now),
      };
    } else {
      const id = crypto.randomUUID();
      this.db
        .prepare(
          `INSERT INTO line_changeover_overrides
           (id, line_id, from_model_id, to_model_id, changeover_minutes, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, lineId, fromModelId, toModelId, changeoverMinutes, notes ?? null, now, now);

      return {
        id,
        lineId,
        fromModelId,
        toModelId,
        changeoverMinutes,
        notes,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
    }
  }

  async deleteLineOverride(
    lineId: string,
    fromModelId: string,
    toModelId: string
  ): Promise<boolean> {
    const result = this.db
      .prepare(
        `DELETE FROM line_changeover_overrides
         WHERE line_id = ? AND from_model_id = ? AND to_model_id = ?`
      )
      .run(lineId, fromModelId, toModelId);

    return result.changes > 0;
  }

  async deleteAllLineOverrides(lineId: string): Promise<number> {
    const result = this.db
      .prepare('DELETE FROM line_changeover_overrides WHERE line_id = ?')
      .run(lineId);

    return result.changes;
  }

  async bulkSetLineOverrides(
    overrides: Array<{
      lineId: string;
      fromModelId: string;
      toModelId: string;
      changeoverMinutes: number;
      notes?: string;
    }>
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO line_changeover_overrides
      (id, line_id, from_model_id, to_model_id, changeover_minutes, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(line_id, from_model_id, to_model_id) DO UPDATE SET
        changeover_minutes = excluded.changeover_minutes,
        notes = excluded.notes,
        updated_at = datetime('now')
    `);

    const insertMany = this.db.transaction((items: typeof overrides) => {
      for (const item of items) {
        stmt.run(
          crypto.randomUUID(),
          item.lineId,
          item.fromModelId,
          item.toModelId,
          item.changeoverMinutes,
          item.notes ?? null
        );
      }
      return items.length;
    });

    return insertMany(overrides);
  }

  // ============================================
  // RESOLVED CHANGEOVER TIMES (VIEW)
  // ============================================

  async getResolvedChangeoverTimes(
    lineId: string
  ): Promise<ResolvedChangeoverTime[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM v_resolved_changeover_times
         WHERE line_id = ?
         ORDER BY from_model_name, to_model_name`
      )
      .all(lineId) as ResolvedChangeoverRow[];

    return rows.map(row => ({
      fromModelId: row.from_model_id,
      fromModelName: row.from_model_name,
      fromFamily: row.from_family,
      toModelId: row.to_model_id,
      toModelName: row.to_model_name,
      toFamily: row.to_family,
      changeoverMinutes: row.changeover_minutes,
      source: row.source,
    }));
  }

  async getResolvedChangeoverTime(
    lineId: string,
    fromModelId: string,
    toModelId: string
  ): Promise<ResolvedChangeoverTime | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM v_resolved_changeover_times
         WHERE line_id = ? AND from_model_id = ? AND to_model_id = ?`
      )
      .get(lineId, fromModelId, toModelId) as ResolvedChangeoverRow | undefined;

    if (!row) return null;

    return {
      fromModelId: row.from_model_id,
      fromModelName: row.from_model_name,
      fromFamily: row.from_family,
      toModelId: row.to_model_id,
      toModelName: row.to_model_name,
      toFamily: row.to_family,
      changeoverMinutes: row.changeover_minutes,
      source: row.source,
    };
  }

  // ============================================
  // CHANGEOVER MATRIX (Complete Matrix for UI)
  // ============================================

  async getChangeoverMatrix(lineId: string): Promise<ChangeoverMatrix | null> {
    // Get line info
    const line = this.db
      .prepare('SELECT id, name, area FROM production_lines WHERE id = ?')
      .get(lineId) as LineRow | undefined;

    if (!line) return null;

    // Get models assigned to this line
    const modelRows = this.db
      .prepare(
        `SELECT DISTINCT pm.id, pm.name, pm.family
         FROM line_model_compatibilities lmc
         JOIN product_models_v2 pm ON lmc.model_id = pm.id
         WHERE lmc.line_id = ? AND pm.active = 1
         ORDER BY pm.family, pm.name`
      )
      .all(lineId) as ModelRow[];

    if (modelRows.length === 0) {
      return {
        lineId: line.id,
        lineName: line.name,
        area: line.area,
        models: [],
        families: [],
        cells: [],
        globalDefault: await this.getGlobalDefault(),
        smedBenchmark: await this.getSmedBenchmark(),
        stats: {
          totalCells: 0,
          filledCells: 0,
          defaultCells: 0,
          overrideCells: 0,
          exceedsBenchmarkCount: 0,
        },
      };
    }

    // Map to MatrixModel
    const models: MatrixModel[] = modelRows.map(row => ({
      id: row.id,
      name: row.name,
      family: row.family,
    }));

    // Group by family
    const familyMap = new Map<string, MatrixModel[]>();
    for (const model of models) {
      const existing = familyMap.get(model.family) || [];
      existing.push(model);
      familyMap.set(model.family, existing);
    }

    const families: MatrixFamily[] = Array.from(familyMap.entries()).map(
      ([name, familyModels]) => ({
        name,
        models: familyModels,
        modelCount: familyModels.length,
      })
    );

    // Get resolved changeover times
    const resolvedTimes = await this.getResolvedChangeoverTimes(lineId);

    // Build lookup map
    const timeMap = new Map<string, ResolvedChangeoverTime>();
    for (const rt of resolvedTimes) {
      timeMap.set(`${rt.fromModelId}:${rt.toModelId}`, rt);
    }

    const globalDefault = await this.getGlobalDefault();
    const smedBenchmark = await this.getSmedBenchmark();

    // Build 2D cells array
    const cells: ChangeoverMatrixCell[][] = [];
    let filledCells = 0;
    let defaultCells = 0;
    let overrideCells = 0;
    let exceedsBenchmarkCount = 0;

    for (let i = 0; i < models.length; i++) {
      const row: ChangeoverMatrixCell[] = [];
      for (let j = 0; j < models.length; j++) {
        const fromModel = models[i]!;  // Non-null assertion - loop bounds guarantee valid index
        const toModel = models[j]!;    // Non-null assertion - loop bounds guarantee valid index
        const key = `${fromModel.id}:${toModel.id}`;
        const resolved = timeMap.get(key);

        let changeoverMinutes = globalDefault;
        let source: ChangeoverMatrixCell['source'] = 'global_default';

        if (fromModel.id === toModel.id) {
          changeoverMinutes = 0;
          source = 'same_model';
        } else if (resolved) {
          changeoverMinutes = resolved.changeoverMinutes;
          source = resolved.source;
        }

        const isDefault = source === 'global_default' || source === 'family_default';
        const exceedsBenchmark = changeoverMinutes > smedBenchmark;

        if (source === 'line_override') overrideCells++;
        if (source === 'family_default') filledCells++;
        if (isDefault && source !== 'same_model') defaultCells++;
        if (exceedsBenchmark && source !== 'same_model') exceedsBenchmarkCount++;

        row.push({
          fromModelId: fromModel.id,
          toModelId: toModel.id,
          changeoverMinutes,
          source,
          isDefault,
          exceedsBenchmark,
        });
      }
      cells.push(row);
    }

    const totalCells = models.length * models.length - models.length; // Exclude diagonal

    return {
      lineId: line.id,
      lineName: line.name,
      area: line.area,
      models,
      families,
      cells,
      globalDefault,
      smedBenchmark,
      stats: {
        totalCells,
        filledCells,
        defaultCells,
        overrideCells,
        exceedsBenchmarkCount,
      },
    };
  }

  // ============================================
  // METHOD CONFIGURATION
  // ============================================

  async getCalculationMethod(
    context: 'global' | 'analysis' | 'simulation' = 'global'
  ): Promise<{ methodId: ChangeoverMethodId; config: Record<string, unknown> }> {
    const row = this.db
      .prepare('SELECT method_id, config_json FROM changeover_method_configs WHERE context = ?')
      .get(context) as MethodConfigRow | undefined;

    if (!row) {
      return {
        methodId: 'probability_weighted',
        config: { includeHHI: true, minModelsForProbability: 2 },
      };
    }

    return {
      methodId: row.method_id as ChangeoverMethodId,
      config: JSON.parse(row.config_json),
    };
  }

  async setCalculationMethod(
    context: 'global' | 'analysis' | 'simulation',
    methodId: ChangeoverMethodId,
    config?: Record<string, unknown>
  ): Promise<void> {
    const configJson = JSON.stringify(config ?? {});

    this.db
      .prepare(
        `INSERT INTO changeover_method_configs (id, context, method_id, config_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(context) DO UPDATE SET
           method_id = excluded.method_id,
           config_json = excluded.config_json,
           updated_at = datetime('now')`
      )
      .run(crypto.randomUUID(), context, methodId, configJson);
  }

  // ============================================
  // COPY MATRIX BETWEEN LINES
  // ============================================

  async copyMatrixFromLine(
    sourceLineId: string,
    targetLineId: string
  ): Promise<number> {
    // Get overrides from source line
    const sourceOverrides = await this.getLineOverrides(sourceLineId);

    if (sourceOverrides.length === 0) return 0;

    // Delete existing overrides on target line
    await this.deleteAllLineOverrides(targetLineId);

    // Copy overrides to target line
    const overridesToInsert = sourceOverrides.map(o => ({
      lineId: targetLineId,
      fromModelId: o.fromModelId,
      toModelId: o.toModelId,
      changeoverMinutes: o.changeoverMinutes,
      notes: o.notes ? `Copied from line: ${o.notes}` : 'Copied from another line',
    }));

    return this.bulkSetLineOverrides(overridesToInsert);
  }

  // ============================================
  // UTILITIES
  // ============================================

  async getAllFamilies(): Promise<string[]> {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT family FROM product_models_v2
         WHERE active = 1 AND family IS NOT NULL AND family != ''
         ORDER BY family`
      )
      .all() as { family: string }[];

    return rows.map(row => row.family);
  }

  async getLinesWithChangeoverData(): Promise<string[]> {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT line_id FROM line_changeover_overrides
         ORDER BY line_id`
      )
      .all() as { line_id: string }[];

    return rows.map(row => row.line_id);
  }
}
