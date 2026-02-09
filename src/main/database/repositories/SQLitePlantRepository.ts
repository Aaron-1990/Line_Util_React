// ============================================
// SQLITE REPOSITORY: Plant
// Phase 7: Multi-Plant Support
// ============================================

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { Plant, CreatePlantInput, UpdatePlantInput } from '@shared/types';

interface PlantRow {
  id: string;
  code: string;
  name: string;
  region: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  timezone: string;
  currency_code: string;
  default_operations_days: number;
  default_shifts_per_day: number;
  default_hours_per_shift: number;
  color: string | null;
  is_default: number;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLitePlantRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: PlantRow): Plant {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      region: row.region ?? undefined,
      locationCity: row.location_city ?? undefined,
      locationState: row.location_state ?? undefined,
      locationCountry: row.location_country ?? undefined,
      timezone: row.timezone,
      currencyCode: row.currency_code,
      defaultOperationsDays: row.default_operations_days,
      defaultShiftsPerDay: row.default_shifts_per_day,
      defaultHoursPerShift: row.default_hours_per_shift,
      color: row.color ?? undefined,
      isDefault: Boolean(row.is_default),
      isActive: Boolean(row.is_active),
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Get all active plants
   */
  async findAll(): Promise<Plant[]> {
    const rows = this.db
      .prepare('SELECT * FROM plants WHERE is_active = 1 ORDER BY is_default DESC, name')
      .all() as PlantRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get all plants including inactive
   */
  async findAllIncludingInactive(): Promise<Plant[]> {
    const rows = this.db
      .prepare('SELECT * FROM plants ORDER BY is_active DESC, is_default DESC, name')
      .all() as PlantRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find plant by ID
   */
  async findById(id: string): Promise<Plant | null> {
    const row = this.db
      .prepare('SELECT * FROM plants WHERE id = ?')
      .get(id) as PlantRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Find plant by code
   */
  async findByCode(code: string): Promise<Plant | null> {
    const row = this.db
      .prepare('SELECT * FROM plants WHERE code = ? AND is_active = 1')
      .get(code) as PlantRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Get the default plant
   */
  async getDefault(): Promise<Plant | null> {
    const row = this.db
      .prepare('SELECT * FROM plants WHERE is_default = 1 AND is_active = 1')
      .get() as PlantRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Check if a code already exists (for validation)
   */
  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    let sql = 'SELECT 1 FROM plants WHERE code = ? AND is_active = 1';
    const params: unknown[] = [code];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(sql).get(...params);
    return row !== undefined;
  }

  /**
   * Create a new plant
   */
  async create(input: CreatePlantInput): Promise<Plant> {
    const id = nanoid();
    const now = new Date().toISOString();

    // Check for duplicate code
    if (await this.existsByCode(input.code)) {
      throw new Error(`Plant with code "${input.code}" already exists`);
    }

    this.db
      .prepare(`
        INSERT INTO plants (
          id, code, name, region, location_city, location_state, location_country,
          timezone, currency_code, default_operations_days, default_shifts_per_day,
          default_hours_per_shift, color, is_default, is_active, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.code,
        input.name,
        input.region ?? null,
        input.locationCity ?? null,
        input.locationState ?? null,
        input.locationCountry ?? null,
        input.timezone ?? 'America/Chicago',
        input.currencyCode ?? 'USD',
        input.defaultOperationsDays ?? 240,
        input.defaultShiftsPerDay ?? 2,
        input.defaultHoursPerShift ?? 8.0,
        input.color ?? null,
        0, // is_default = false for new plants
        1, // is_active = true
        input.notes ?? null,
        now,
        now
      );

    const plant = await this.findById(id);
    if (!plant) {
      throw new Error('Failed to create plant');
    }
    return plant;
  }

  /**
   * Update an existing plant
   */
  async update(id: string, input: UpdatePlantInput): Promise<Plant> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Plant with id "${id}" not found`);
    }

    // Check for duplicate code if code is being changed
    if (input.code && input.code !== existing.code) {
      if (await this.existsByCode(input.code, id)) {
        throw new Error(`Plant with code "${input.code}" already exists`);
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.code !== undefined) {
      updates.push('code = ?');
      params.push(input.code);
    }
    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.region !== undefined) {
      updates.push('region = ?');
      params.push(input.region);
    }
    if (input.locationCity !== undefined) {
      updates.push('location_city = ?');
      params.push(input.locationCity);
    }
    if (input.locationState !== undefined) {
      updates.push('location_state = ?');
      params.push(input.locationState);
    }
    if (input.locationCountry !== undefined) {
      updates.push('location_country = ?');
      params.push(input.locationCountry);
    }
    if (input.timezone !== undefined) {
      updates.push('timezone = ?');
      params.push(input.timezone);
    }
    if (input.currencyCode !== undefined) {
      updates.push('currency_code = ?');
      params.push(input.currencyCode);
    }
    if (input.defaultOperationsDays !== undefined) {
      updates.push('default_operations_days = ?');
      params.push(input.defaultOperationsDays);
    }
    if (input.defaultShiftsPerDay !== undefined) {
      updates.push('default_shifts_per_day = ?');
      params.push(input.defaultShiftsPerDay);
    }
    if (input.defaultHoursPerShift !== undefined) {
      updates.push('default_hours_per_shift = ?');
      params.push(input.defaultHoursPerShift);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      params.push(input.color);
    }
    if (input.notes !== undefined) {
      updates.push('notes = ?');
      params.push(input.notes);
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing; // Nothing to update
    }

    // Always update timestamp
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    // Add id for WHERE clause
    params.push(id);

    this.db.prepare(`UPDATE plants SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to update plant');
    }
    return updated;
  }

  /**
   * Soft delete a plant (set is_active = 0)
   */
  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Plant with id "${id}" not found`);
    }

    // REMOVED: All delete validations for Untitled Project support
    // - "Cannot delete the default plant" validation removed
    // - "Cannot delete the last remaining plant" validation removed
    // Untitled Project can have 0 plants (like blank Excel document)
    // User creates plants via import or manual creation

    this.db.prepare('UPDATE plants SET is_active = 0 WHERE id = ?').run(id);
  }

  /**
   * Set a plant as the default (and unset previous default)
   */
  async setDefault(id: string): Promise<Plant> {
    const plant = await this.findById(id);
    if (!plant) {
      throw new Error(`Plant with id "${id}" not found`);
    }

    if (!plant.isActive) {
      throw new Error('Cannot set inactive plant as default');
    }

    // Use transaction to ensure atomicity
    const transaction = this.db.transaction(() => {
      // Unset current default
      this.db.prepare('UPDATE plants SET is_default = 0 WHERE is_default = 1').run();
      // Set new default
      this.db.prepare('UPDATE plants SET is_default = 1, updated_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        id
      );
    });

    transaction();

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to set default plant');
    }
    return updated;
  }

  /**
   * Get plant count (active only)
   */
  async count(): Promise<number> {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM plants WHERE is_active = 1')
      .get() as { count: number };
    return result.count;
  }

  /**
   * Get plants by region
   */
  async findByRegion(region: string): Promise<Plant[]> {
    const rows = this.db
      .prepare('SELECT * FROM plants WHERE region = ? AND is_active = 1 ORDER BY name')
      .all(region) as PlantRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get all unique regions
   */
  async getRegions(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT DISTINCT region FROM plants WHERE region IS NOT NULL AND is_active = 1 ORDER BY region')
      .all() as { region: string }[];

    return rows.map(row => row.region);
  }
}
