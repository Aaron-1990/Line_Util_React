// ============================================
// SEED DATA
// Datos de prueba para desarrollo
// ============================================
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export function seedDatabase(db: Database.Database): void {
  console.log('Seeding database with test data...');

  // Verificar si ya hay datos
  const lineCount = db.prepare('SELECT COUNT(*) as count FROM production_lines').get() as { count: number };
  
  if (lineCount.count > 0) {
    console.log('Database already has data, skipping seed');
    return;
  }

  // Seed production lines
  const lines = [
    { id: nanoid(), name: 'SMT Line 1', area: 'SMT', time: 82800, x: 100, y: 100 },
    { id: nanoid(), name: 'SMT Line 2', area: 'SMT', time: 82800, x: 100, y: 250 },
    { id: nanoid(), name: 'ICT Line 1', area: 'ICT', time: 82800, x: 400, y: 100 },
    { id: nanoid(), name: 'ICT Line 2', area: 'ICT', time: 82800, x: 400, y: 250 },
    { id: nanoid(), name: 'Wave Line 1', area: 'WAVE', time: 82800, x: 700, y: 100 },
    { id: nanoid(), name: 'Assembly Line 1', area: 'ASSEMBLY', time: 82800, x: 700, y: 250 },
  ];

  const insertLine = db.prepare(`
    INSERT INTO production_lines 
    (id, name, area, time_available_daily, x_position, y_position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  lines.forEach(line => {
    insertLine.run(line.id, line.name, line.area, line.time, line.x, line.y);
  });

  console.log(`Seeded ${lines.length} production lines`);

  // Seed product models
  const models = [
    { id: nanoid(), family: 'PCM-A', name: 'PCM-A-V1', bu: 'EPS', area: 'SMT', priority: 1, efficiency: 0.95 },
    { id: nanoid(), family: 'PCM-B', name: 'PCM-B-V2', bu: 'EPS', area: 'SMT', priority: 2, efficiency: 0.92 },
    { id: nanoid(), family: 'GDB', name: 'GDB-C1', bu: 'BTS', area: 'ICT', priority: 3, efficiency: 0.90 },
  ];

  const insertModel = db.prepare(`
    INSERT INTO product_models 
    (id, family, name, bu, area, priority, efficiency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  models.forEach(model => {
    insertModel.run(model.id, model.family, model.name, model.bu, model.area, model.priority, model.efficiency);
  });

  console.log(`Seeded ${models.length} product models`);

  // Seed production volumes
  const volumes = [
    { id: nanoid(), family: 'PCM-A', days: 250, year: 2025, quantity: 50000 },
    { id: nanoid(), family: 'PCM-B', days: 250, year: 2025, quantity: 30000 },
    { id: nanoid(), family: 'GDB', days: 250, year: 2025, quantity: 20000 },
  ];

  const insertVolume = db.prepare(`
    INSERT INTO production_volumes 
    (id, family, days_of_operation, year, quantity, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  volumes.forEach(vol => {
    insertVolume.run(vol.id, vol.family, vol.days, vol.year, vol.quantity);
  });

  console.log(`Seeded ${volumes.length} production volumes`);

  console.log('Seed completed successfully');
}
