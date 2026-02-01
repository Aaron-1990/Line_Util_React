// ============================================
// SQLITE REPOSITORY: AreaCatalog
// Implementation of IAreaCatalogRepository
// ============================================

import Database from 'better-sqlite3';
import { IAreaCatalogRepository } from '@domain/repositories';
import { AreaCatalogItem } from '@shared/types';
import { nanoid } from 'nanoid';

interface AreaRow {
  id: string;
  code: string;
  name: string;
  color: string;
  sequence: number | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteAreaCatalogRepository implements IAreaCatalogRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: AreaRow): AreaCatalogItem {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      color: row.color,
      sequence: row.sequence ?? 0,
      active: Boolean(row.active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findAll(): Promise<AreaCatalogItem[]> {
    const rows = this.db
      .prepare('SELECT * FROM area_catalog ORDER BY sequence, name')
      .all() as AreaRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<AreaCatalogItem | null> {
    const row = this.db
      .prepare('SELECT * FROM area_catalog WHERE id = ?')
      .get(id) as AreaRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByCode(code: string): Promise<AreaCatalogItem | null> {
    const row = this.db
      .prepare('SELECT * FROM area_catalog WHERE LOWER(code) = LOWER(?)')
      .get(code) as AreaRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findActive(): Promise<AreaCatalogItem[]> {
    const rows = this.db
      .prepare('SELECT * FROM area_catalog WHERE active = 1 ORDER BY sequence, name')
      .all() as AreaRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async save(item: AreaCatalogItem): Promise<void> {
    const now = new Date().toISOString();

    // Check if area exists by code (case-insensitive)
    const existing = await this.findByCode(item.code);

    if (existing) {
      // Update existing area
      this.db
        .prepare(`
          UPDATE area_catalog
          SET name = ?,
              color = ?,
              sequence = ?,
              active = ?,
              updated_at = ?
          WHERE LOWER(code) = LOWER(?)
        `)
        .run(
          item.name,
          item.color,
          item.sequence || null,
          item.active ? 1 : 0,
          now,
          item.code
        );
    } else {
      // Insert new area
      this.db
        .prepare(`
          INSERT INTO area_catalog
          (id, code, name, color, sequence, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          item.id || nanoid(),
          item.code,
          item.name,
          item.color,
          item.sequence || null,
          item.active ? 1 : 0,
          item.createdAt?.toISOString() || now,
          now
        );
    }
  }

  async delete(id: string): Promise<void> {
    this.db
      .prepare('UPDATE area_catalog SET active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  async existsByCode(code: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT 1 FROM area_catalog WHERE LOWER(code) = LOWER(?)';
    const params: unknown[] = [code];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(query).get(...params);
    return row !== undefined;
  }

  async isInUse(id: string): Promise<boolean> {
    // Check if any production lines reference this area
    const result = this.db
      .prepare(`
        SELECT 1 FROM production_lines
        WHERE area = (SELECT code FROM area_catalog WHERE id = ?)
        LIMIT 1
      `)
      .get(id);

    return result !== undefined;
  }

  async seed(defaultAreas: readonly { code: string; name: string; color: string }[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO area_catalog (id, code, name, color, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);

    const seedAreas = this.db.transaction((areas: readonly { code: string; name: string; color: string }[]) => {
      const now = new Date().toISOString();
      for (const area of areas) {
        insert.run(nanoid(), area.code, area.name, area.color, now, now);
      }
    });

    seedAreas(defaultAreas);
  }
}
