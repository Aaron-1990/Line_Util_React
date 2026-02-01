// ============================================
// SQLITE REPOSITORY: ModelAreaRouting
// Phase 6.5: DAG-based routing for parallel processes
// ============================================

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  ModelAreaRoutingStep,
  ModelAreaRoutingStepInput,
  ModelRoutingConfig,
  RoutingValidationResult,
  ModelAreaRoutingRow,
  ModelAreaPredecessorRow,
} from '@shared/types/routing';

export class SQLiteModelAreaRoutingRepository {
  constructor(private db: Database.Database) {}

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapRowToStep(
    row: ModelAreaRoutingRow,
    predecessors: string[]
  ): ModelAreaRoutingStep {
    return {
      id: row.id,
      modelId: row.model_id,
      areaCode: row.area_code,
      sequence: row.sequence,
      isRequired: Boolean(row.is_required),
      expectedYield: row.expected_yield,
      volumeFraction: row.volume_fraction,
      predecessors,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get routing configuration for a model
   */
  async findByModel(modelId: string): Promise<ModelRoutingConfig | null> {
    // Get all routing steps for this model
    const stepRows = this.db
      .prepare(`
        SELECT * FROM model_area_routing
        WHERE model_id = ?
        ORDER BY sequence
      `)
      .all(modelId) as ModelAreaRoutingRow[];

    if (stepRows.length === 0) {
      return null;
    }

    // Get all predecessors for this model
    const predRows = this.db
      .prepare(`
        SELECT * FROM model_area_predecessors
        WHERE model_id = ?
      `)
      .all(modelId) as ModelAreaPredecessorRow[];

    // Build predecessor map: areaCode -> predecessor area codes
    const predMap = new Map<string, string[]>();
    for (const pred of predRows) {
      if (!predMap.has(pred.area_code)) {
        predMap.set(pred.area_code, []);
      }
      predMap.get(pred.area_code)!.push(pred.predecessor_area_code);
    }

    // Map rows to steps with predecessors
    const steps = stepRows.map(row =>
      this.mapRowToStep(row, predMap.get(row.area_code) || [])
    );

    return {
      modelId,
      steps,
    };
  }

  /**
   * Get all routing steps for a model (simplified view)
   */
  async findStepsByModel(modelId: string): Promise<ModelAreaRoutingStep[]> {
    const config = await this.findByModel(modelId);
    return config?.steps || [];
  }

  /**
   * Check if a model has any routing defined
   */
  async hasRouting(modelId: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 FROM model_area_routing WHERE model_id = ? LIMIT 1')
      .get(modelId);
    return row !== undefined;
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Set the complete routing for a model (atomic replacement)
   * This is the main method for saving routing from the UI
   */
  async setRouting(modelId: string, steps: ModelAreaRoutingStepInput[]): Promise<void> {
    const now = new Date().toISOString();

    const setRoutingTx = this.db.transaction(() => {
      // 1. Delete existing predecessors first (FK constraint)
      this.db
        .prepare('DELETE FROM model_area_predecessors WHERE model_id = ?')
        .run(modelId);

      // 2. Delete existing routing steps
      this.db
        .prepare('DELETE FROM model_area_routing WHERE model_id = ?')
        .run(modelId);

      // 3. Insert new routing steps
      const insertStep = this.db.prepare(`
        INSERT INTO model_area_routing
        (id, model_id, area_code, sequence, is_required, expected_yield, volume_fraction, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        insertStep.run(
          nanoid(),
          modelId,
          step.areaCode,
          step.sequence ?? i,
          step.isRequired !== false ? 1 : 0,
          step.expectedYield ?? 1.0,
          step.volumeFraction ?? 1.0,
          now,
          now
        );
      }

      // 4. Insert predecessor relationships
      const insertPred = this.db.prepare(`
        INSERT INTO model_area_predecessors
        (id, model_id, area_code, predecessor_area_code, dependency_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const step of steps) {
        if (step.predecessors && step.predecessors.length > 0) {
          for (const pred of step.predecessors) {
            insertPred.run(
              nanoid(),
              modelId,
              step.areaCode,
              pred,
              'finish_to_start',
              now
            );
          }
        }
      }
    });

    setRoutingTx();
  }

  /**
   * Update predecessors for a single area in a model's routing
   */
  async setPredecessors(
    modelId: string,
    areaCode: string,
    predecessors: string[]
  ): Promise<void> {
    const now = new Date().toISOString();

    const setPredTx = this.db.transaction(() => {
      // Delete existing predecessors for this area
      this.db
        .prepare(`
          DELETE FROM model_area_predecessors
          WHERE model_id = ? AND area_code = ?
        `)
        .run(modelId, areaCode);

      // Insert new predecessors
      const insertPred = this.db.prepare(`
        INSERT INTO model_area_predecessors
        (id, model_id, area_code, predecessor_area_code, dependency_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const pred of predecessors) {
        insertPred.run(
          nanoid(),
          modelId,
          areaCode,
          pred,
          'finish_to_start',
          now
        );
      }

      // Update the routing step's updated_at timestamp
      this.db
        .prepare(`
          UPDATE model_area_routing
          SET updated_at = ?
          WHERE model_id = ? AND area_code = ?
        `)
        .run(now, modelId, areaCode);
    });

    setPredTx();
  }

  /**
   * Delete all routing for a model
   */
  async deleteRouting(modelId: string): Promise<void> {
    const deleteTx = this.db.transaction(() => {
      // Delete predecessors first (FK constraint)
      this.db
        .prepare('DELETE FROM model_area_predecessors WHERE model_id = ?')
        .run(modelId);

      // Delete routing steps
      this.db
        .prepare('DELETE FROM model_area_routing WHERE model_id = ?')
        .run(modelId);
    });

    deleteTx();
  }

  // ============================================
  // VALIDATION (CYCLE & ORPHAN DETECTION)
  // ============================================

  /**
   * Validate the routing DAG using Kahn's algorithm
   * Detects cycles and orphan nodes
   */
  async validateRouting(modelId: string): Promise<RoutingValidationResult> {
    const config = await this.findByModel(modelId);

    if (!config || config.steps.length === 0) {
      return {
        isValid: true,
        hasCycle: false,
        hasOrphans: false,
        startNodes: [],
        endNodes: [],
      };
    }

    const steps = config.steps;
    const areaCodes = new Set(steps.map(s => s.areaCode));

    // Build adjacency list and in-degree map
    const adjacency = new Map<string, string[]>(); // predecessor -> successors
    const inDegree = new Map<string, number>();

    // Initialize
    for (const code of areaCodes) {
      adjacency.set(code, []);
      inDegree.set(code, 0);
    }

    // Build graph
    for (const step of steps) {
      for (const pred of step.predecessors) {
        if (areaCodes.has(pred)) {
          adjacency.get(pred)!.push(step.areaCode);
          inDegree.set(step.areaCode, inDegree.get(step.areaCode)! + 1);
        }
      }
    }

    // Find start nodes (no predecessors)
    const startNodes: string[] = [];
    for (const [code, degree] of inDegree) {
      if (degree === 0) {
        startNodes.push(code);
      }
    }

    // Find end nodes (no successors)
    const endNodes: string[] = [];
    for (const [code, successors] of adjacency) {
      if (successors.length === 0) {
        endNodes.push(code);
      }
    }

    // Kahn's algorithm for topological sort (cycle detection)
    const queue = [...startNodes];
    const sortedOrder: string[] = [];
    const inDegreeCopy = new Map(inDegree);

    while (queue.length > 0) {
      const node = queue.shift()!;
      sortedOrder.push(node);

      for (const successor of adjacency.get(node)!) {
        const newDegree = inDegreeCopy.get(successor)! - 1;
        inDegreeCopy.set(successor, newDegree);

        if (newDegree === 0) {
          queue.push(successor);
        }
      }
    }

    // If we couldn't process all nodes, there's a cycle
    const hasCycle = sortedOrder.length < areaCodes.size;

    // Find nodes involved in cycle
    const cycleNodes: string[] = [];
    if (hasCycle) {
      for (const code of areaCodes) {
        if (!sortedOrder.includes(code)) {
          cycleNodes.push(code);
        }
      }
    }

    // Detect orphans (nodes unreachable from any start node)
    const reachable = new Set<string>();
    const visitQueue = [...startNodes];

    while (visitQueue.length > 0) {
      const node = visitQueue.shift()!;
      if (reachable.has(node)) continue;
      reachable.add(node);

      for (const successor of adjacency.get(node)!) {
        if (!reachable.has(successor)) {
          visitQueue.push(successor);
        }
      }
    }

    const orphanNodes: string[] = [];
    for (const code of areaCodes) {
      if (!reachable.has(code)) {
        orphanNodes.push(code);
      }
    }

    const hasOrphans = orphanNodes.length > 0;

    return {
      isValid: !hasCycle && !hasOrphans,
      hasCycle,
      cycleNodes: hasCycle ? cycleNodes : undefined,
      hasOrphans,
      orphanNodes: hasOrphans ? orphanNodes : undefined,
      startNodes,
      endNodes,
    };
  }

  /**
   * Validate steps without saving (for UI validation)
   */
  validateSteps(steps: ModelAreaRoutingStepInput[]): RoutingValidationResult {
    if (steps.length === 0) {
      return {
        isValid: true,
        hasCycle: false,
        hasOrphans: false,
        startNodes: [],
        endNodes: [],
      };
    }

    const areaCodes = new Set(steps.map(s => s.areaCode));

    // Build adjacency list and in-degree map
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const code of areaCodes) {
      adjacency.set(code, []);
      inDegree.set(code, 0);
    }

    for (const step of steps) {
      if (step.predecessors) {
        for (const pred of step.predecessors) {
          if (areaCodes.has(pred)) {
            adjacency.get(pred)!.push(step.areaCode);
            inDegree.set(step.areaCode, inDegree.get(step.areaCode)! + 1);
          }
        }
      }
    }

    // Find start nodes
    const startNodes: string[] = [];
    for (const [code, degree] of inDegree) {
      if (degree === 0) {
        startNodes.push(code);
      }
    }

    // Find end nodes
    const endNodes: string[] = [];
    for (const [code, successors] of adjacency) {
      if (successors.length === 0) {
        endNodes.push(code);
      }
    }

    // Kahn's algorithm
    const queue = [...startNodes];
    const sortedOrder: string[] = [];
    const inDegreeCopy = new Map(inDegree);

    while (queue.length > 0) {
      const node = queue.shift()!;
      sortedOrder.push(node);

      for (const successor of adjacency.get(node)!) {
        const newDegree = inDegreeCopy.get(successor)! - 1;
        inDegreeCopy.set(successor, newDegree);
        if (newDegree === 0) {
          queue.push(successor);
        }
      }
    }

    const hasCycle = sortedOrder.length < areaCodes.size;
    const cycleNodes = hasCycle
      ? [...areaCodes].filter(code => !sortedOrder.includes(code))
      : undefined;

    // Detect orphans
    const reachable = new Set<string>();
    const visitQueue = [...startNodes];

    while (visitQueue.length > 0) {
      const node = visitQueue.shift()!;
      if (reachable.has(node)) continue;
      reachable.add(node);

      for (const successor of adjacency.get(node)!) {
        if (!reachable.has(successor)) {
          visitQueue.push(successor);
        }
      }
    }

    const orphanNodes = [...areaCodes].filter(code => !reachable.has(code));
    const hasOrphans = orphanNodes.length > 0;

    return {
      isValid: !hasCycle && !hasOrphans,
      hasCycle,
      cycleNodes,
      hasOrphans,
      orphanNodes: hasOrphans ? orphanNodes : undefined,
      startNodes,
      endNodes,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get all models that have routing defined
   */
  async getModelsWithRouting(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT DISTINCT model_id FROM model_area_routing')
      .all() as { model_id: string }[];

    return rows.map(r => r.model_id);
  }

  /**
   * Get topologically sorted area order for a model
   * Returns null if there's a cycle
   */
  async getTopologicalOrder(modelId: string): Promise<string[] | null> {
    const config = await this.findByModel(modelId);
    if (!config || config.steps.length === 0) {
      return [];
    }

    const validation = await this.validateRouting(modelId);
    if (validation.hasCycle) {
      return null;
    }

    // Build adjacency and in-degree
    const steps = config.steps;
    const areaCodes = new Set(steps.map(s => s.areaCode));
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const code of areaCodes) {
      adjacency.set(code, []);
      inDegree.set(code, 0);
    }

    for (const step of steps) {
      for (const pred of step.predecessors) {
        if (areaCodes.has(pred)) {
          adjacency.get(pred)!.push(step.areaCode);
          inDegree.set(step.areaCode, inDegree.get(step.areaCode)! + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue = [...validation.startNodes];
    const result: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const successor of adjacency.get(node)!) {
        const newDegree = inDegree.get(successor)! - 1;
        inDegree.set(successor, newDegree);
        if (newDegree === 0) {
          queue.push(successor);
        }
      }
    }

    return result;
  }
}
