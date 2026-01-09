// ============================================
// SQLITE REPOSITORY: ProductModel
// Implementacion de IProductModelRepository
// ============================================

import Database from 'better-sqlite3';
import { IProductModelRepository } from '@domain/repositories';
import { ProductModel } from '@domain/entities';

interface ModelRow {
  id: string;
  family: string;
  name: string;
  bu: string;
  area: string;
  priority: number;
  efficiency: number;
  compatible_lines: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteProductModelRepository implements IProductModelRepository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: ModelRow): ProductModel {
    return ProductModel.fromDatabase({
      id: row.id,
      family: row.family,
      name: row.name,
      bu: row.bu,
      area: row.area,
      priority: row.priority,
      efficiency: row.efficiency,
      compatibleLines: JSON.parse(row.compatible_lines),
      active: Boolean(row.active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findAll(): Promise<ProductModel[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models ORDER BY family, name')
      .all() as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<ProductModel | null> {
    const row = this.db
      .prepare('SELECT * FROM product_models WHERE id = ?')
      .get(id) as ModelRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findByFamily(family: string): Promise<ProductModel[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models WHERE family = ? ORDER BY name')
      .all(family) as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByArea(area: string): Promise<ProductModel[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models WHERE area = ? ORDER BY family, name')
      .all(area) as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<ProductModel[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models WHERE active = 1 ORDER BY family, name')
      .all() as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findCompatibleWithLine(lineId: string): Promise<ProductModel[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM product_models 
        WHERE active = 1 
        AND json_extract(compatible_lines, '$') LIKE ?
        ORDER BY priority, family, name
      `)
      .all(`%"${lineId}"%`) as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async save(model: ProductModel): Promise<void> {
    const data = model.toJSON();

    const existing = await this.findById(model.id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE product_models 
          SET family = ?, name = ?, bu = ?, area = ?, priority = ?, 
              efficiency = ?, compatible_lines = ?, active = ?
          WHERE id = ?
        `)
        .run(
          data.family,
          data.name,
          data.bu,
          data.area,
          data.priority,
          data.efficiency,
          JSON.stringify(data.compatibleLines),
          data.active ? 1 : 0,
          data.id
        );
    } else {
      this.db
        .prepare(`
          INSERT INTO product_models 
          (id, family, name, bu, area, priority, efficiency, compatible_lines, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.id,
          data.family,
          data.name,
          data.bu,
          data.area,
          data.priority,
          data.efficiency,
          JSON.stringify(data.compatibleLines),
          data.active ? 1 : 0,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('UPDATE product_models SET active = 0 WHERE id = ?').run(id);
  }

  async existsByName(family: string, name: string, excludeId?: string): Promise<boolean> {
    let sql = 'SELECT 1 FROM product_models WHERE family = ? AND name = ? AND active = 1';
    const params: unknown[] = [family, name];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const row = this.db.prepare(sql).get(...params);
    return row !== undefined;
  }
}
