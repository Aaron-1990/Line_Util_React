// ============================================
// SQLITE REPOSITORY: ProductModelV2
// Implementation of IProductModelV2Repository
// ============================================

import Database from 'better-sqlite3';
import { IProductModelV2Repository } from '@domain/repositories';
import { ProductModelV2 } from '@domain/entities';

interface ModelRow {
  id: string;
  name: string;
  customer: string;
  program: string;
  family: string;
  annual_volume: number;
  operations_days: number;
  active: number;
  launch_plant_id: string | null;    // Phase 7: Plant that launched this model
  primary_plant_id: string | null;   // Phase 7: Current owner plant
  created_at: string;
  updated_at: string;
}

export class SQLiteProductModelV2Repository implements IProductModelV2Repository {
  constructor(private db: Database.Database) {}

  private mapRowToEntity(row: ModelRow): ProductModelV2 {
    return ProductModelV2.fromDatabase({
      id: row.id,
      name: row.name,
      customer: row.customer,
      program: row.program,
      family: row.family,
      annualVolume: row.annual_volume,
      operationsDays: row.operations_days,
      active: Boolean(row.active),
      launchPlantId: row.launch_plant_id ?? undefined,
      primaryPlantId: row.primary_plant_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async create(model: ProductModelV2): Promise<void> {
    const data = model.toJSON();

    this.db
      .prepare(`
        INSERT INTO product_models_v2
        (id, name, customer, program, family, annual_volume, operations_days, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.id,
        data.name,
        data.customer,
        data.program,
        data.family,
        data.annualVolume,
        data.operationsDays,
        data.active ? 1 : 0,
        data.createdAt.toISOString(),
        data.updatedAt.toISOString()
      );
  }

  async update(
    name: string,
    model: Partial<{
      customer: string;
      program: string;
      family: string;
      annualVolume: number;
      operationsDays: number;
      active: boolean;
    }>
  ): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (model.customer !== undefined) {
      updates.push('customer = ?');
      values.push(model.customer);
    }
    if (model.program !== undefined) {
      updates.push('program = ?');
      values.push(model.program);
    }
    if (model.family !== undefined) {
      updates.push('family = ?');
      values.push(model.family);
    }
    if (model.annualVolume !== undefined) {
      updates.push('annual_volume = ?');
      values.push(model.annualVolume);
    }
    if (model.operationsDays !== undefined) {
      updates.push('operations_days = ?');
      values.push(model.operationsDays);
    }
    if (model.active !== undefined) {
      updates.push('active = ?');
      values.push(model.active ? 1 : 0);
    }

    if (updates.length === 0) return;

    values.push(name);

    this.db
      .prepare(`UPDATE product_models_v2 SET ${updates.join(', ')} WHERE name = ?`)
      .run(...values);
  }

  async findByName(name: string): Promise<ProductModelV2 | null> {
    const row = this.db
      .prepare('SELECT * FROM product_models_v2 WHERE name = ?')
      .get(name) as ModelRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findById(id: string): Promise<ProductModelV2 | null> {
    const row = this.db
      .prepare('SELECT * FROM product_models_v2 WHERE id = ?')
      .get(id) as ModelRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  async findAll(): Promise<ProductModelV2[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models_v2 WHERE active = 1 ORDER BY name')
      .all() as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<ProductModelV2[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models_v2 WHERE active = 1 ORDER BY name')
      .all() as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByFamily(family: string): Promise<ProductModelV2[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models_v2 WHERE family = ? ORDER BY name')
      .all(family) as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async findByCustomer(customer: string): Promise<ProductModelV2[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_models_v2 WHERE customer = ? ORDER BY name')
      .all(customer) as ModelRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  async delete(name: string): Promise<void> {
    this.db
      .prepare('UPDATE product_models_v2 SET active = 0 WHERE name = ?')
      .run(name);
  }

  async hardDelete(name: string): Promise<void> {
    this.db
      .prepare('DELETE FROM product_models_v2 WHERE name = ?')
      .run(name);
  }

  async batchCreate(models: ProductModelV2[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT INTO product_models_v2
      (id, name, customer, program, family, annual_volume, operations_days, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((models: ProductModelV2[]) => {
      for (const model of models) {
        const data = model.toJSON();
        insert.run(
          data.id,
          data.name,
          data.customer,
          data.program,
          data.family,
          data.annualVolume,
          data.operationsDays,
          data.active ? 1 : 0,
          data.createdAt.toISOString(),
          data.updatedAt.toISOString()
        );
      }
    });

    insertMany(models);
  }

  async existsByName(name: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 FROM product_models_v2 WHERE name = ? AND active = 1')
      .get(name);
    return row !== undefined;
  }

  async getAllNames(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT name FROM product_models_v2 WHERE active = 1 ORDER BY name')
      .all() as { name: string }[];

    return rows.map(row => row.name);
  }
}
