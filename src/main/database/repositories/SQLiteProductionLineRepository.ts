// ============================================
// SQLITE REPOSITORY: ProductionLine
// Implementacion de IProductionLineRepository
// ============================================

import Database from 'better-sqlite3';
import { IProductionLineRepository } from '@domain/repositories';
import { ProductionLine } from '@domain/entities';

interface LineRow {
  id: string;
  name: string;
  area: string;
  line_type: 'shared' | 'dedicated' | null;
  time_available_daily: number;
  active: number;
  x_position: number;
  y_position: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteProductionLineRepository implements IProductionLineRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: LineRow): ProductionLine {
    return ProductionLine.fromDatabase({
      id: row.id,
      name: row.name,
      area: row.area,
      lineType: row.line_type ?? 'shared',
      timeAvailableDaily: row.time_available_daily,
      active: Boolean(row.active),
      xPosition: row.x_position,
      yPosition: row.y_position,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findAll(): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare('SELECT * FROM production_lines ORDER BY name')
      .all() as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<ProductionLine | null> {
    const row = this.db
      .prepare('SELECT * FROM production_lines WHERE id = ?')
      .get(id) as LineRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByArea(area: string): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare('SELECT * FROM production_lines WHERE area = ? ORDER BY name')
      .all(area) as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<ProductionLine[]> {
    const rows = this.db
      .prepare('SELECT * FROM production_lines WHERE active = 1 ORDER BY name')
      .all() as LineRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async save(line: ProductionLine): Promise<void> {
    const data = line.toJSON();

    const existing = await this.findById(line.id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE production_lines
          SET name = ?, area = ?, line_type = ?, time_available_daily = ?,
              active = ?, x_position = ?, y_position = ?
          WHERE id = ?
        `)
        .run(
          data.name,
          data.area,
          data.lineType,
          data.timeAvailableDaily,
          data.active ? 1 : 0,
          data.xPosition,
          data.yPosition,
          data.id
        );
    } else {
      this.db
        .prepare(`
          INSERT INTO production_lines
          (id, name, area, line_type, time_available_daily, active, x_position, y_position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.id,
          data.name,
          data.area,
          data.lineType,
          data.timeAvailableDaily,
          data.active ? 1 : 0,
          data.xPosition,
          data.yPosition,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('UPDATE production_lines SET active = 0 WHERE id = ?').run(id);
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    let sql = 'SELECT 1 FROM production_lines WHERE name = ? AND active = 1';
    const params: unknown[] = [name];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(sql).get(...params);
    return row !== undefined;
  }

  async findByName(name: string): Promise<ProductionLine | null> {
    const row = this.db
      .prepare('SELECT * FROM production_lines WHERE name = ? AND active = 1')
      .get(name) as LineRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async updatePosition(id: string, x: number, y: number): Promise<void> {
    this.db
      .prepare('UPDATE production_lines SET x_position = ?, y_position = ? WHERE id = ?')
      .run(x, y, id);
  }
}
