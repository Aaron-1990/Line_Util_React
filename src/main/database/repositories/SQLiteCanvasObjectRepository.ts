// ============================================
// SQLITE REPOSITORY: Canvas Objects
// Phase 7.5: Polymorphic Canvas Objects
// ============================================

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  CanvasObject,
  CanvasObjectWithDetails,
  CanvasObjectType,
  BufferProperties,
  ProcessLineLink,
  ProcessProperties,
  UpdateProcessPropertiesInput,
  CanvasConnection,
  CreateCanvasObjectInput,
  UpdateCanvasObjectInput,
  CreateConnectionInput,
  ProductionLine,
  CanvasObjectRow,
  BufferPropertiesRow,
  ProcessLineLinkRow,
  ProcessPropertiesRow,
  CanvasConnectionRow,
} from '@shared/types';

export class SQLiteCanvasObjectRepository {
  constructor(private db: Database.Database) {}

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapObjectRowToEntity(row: CanvasObjectRow): CanvasObject {
    return {
      id: row.id,
      plantId: row.plant_id,
      shapeId: row.shape_id,
      objectType: row.object_type as CanvasObjectType,
      name: row.name,
      description: row.description ?? undefined,
      xPosition: row.x_position,
      yPosition: row.y_position,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      rotation: row.rotation,
      colorOverride: row.color_override ?? undefined,
      active: Boolean(row.active),
      locked: Boolean(row.locked),
      zIndex: row.z_index,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapBufferRowToEntity(row: BufferPropertiesRow): BufferProperties {
    return {
      id: row.id,
      canvasObjectId: row.canvas_object_id,
      maxCapacity: row.max_capacity,
      bufferTimeHours: row.buffer_time_hours,
      currentWip: row.current_wip,
      fifoEnforced: Boolean(row.fifo_enforced),
      overflowPolicy: row.overflow_policy as any,
    };
  }

  private mapProcessLinkRowToEntity(row: ProcessLineLinkRow): ProcessLineLink {
    return {
      id: row.id,
      canvasObjectId: row.canvas_object_id,
      productionLineId: row.production_line_id ?? undefined,
    };
  }

  private mapProcessPropertiesRowToEntity(row: ProcessPropertiesRow): ProcessProperties {
    return {
      id: row.id,
      canvasObjectId: row.canvas_object_id,
      area: row.area,
      timeAvailableDaily: row.time_available_daily,
      lineType: row.line_type as 'shared' | 'dedicated',
      changeoverEnabled: Boolean(row.changeover_enabled),
    };
  }

  private mapConnectionRowToEntity(row: CanvasConnectionRow): CanvasConnection {
    return {
      id: row.id,
      plantId: row.plant_id,
      sourceObjectId: row.source_object_id,
      sourceAnchor: row.source_anchor ?? undefined,
      targetObjectId: row.target_object_id,
      targetAnchor: row.target_anchor ?? undefined,
      connectionType: row.connection_type as any,
      label: row.label ?? undefined,
      active: Boolean(row.active),
    };
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get all canvas objects for a plant (simple version)
   */
  async findAllByPlant(plantId: string): Promise<CanvasObject[]> {
    const rows = this.db
      .prepare('SELECT * FROM canvas_objects WHERE plant_id = ? AND active = 1 ORDER BY z_index, name')
      .all(plantId) as CanvasObjectRow[];

    return rows.map(row => this.mapObjectRowToEntity(row));
  }

  /**
   * Get all canvas objects for a plant with full details
   */
  async findByPlant(plantId: string): Promise<CanvasObjectWithDetails[]> {
    const objects = await this.findAllByPlant(plantId);
    const result: CanvasObjectWithDetails[] = [];

    for (const obj of objects) {
      const details = await this.findByIdWithDetails(obj.id);
      if (details) {
        result.push(details);
      }
    }

    return result;
  }

  /**
   * Get a single canvas object by ID (simple version)
   */
  async findByIdSimple(id: string): Promise<CanvasObject | null> {
    const row = this.db
      .prepare('SELECT * FROM canvas_objects WHERE id = ?')
      .get(id) as CanvasObjectRow | undefined;

    return row ? this.mapObjectRowToEntity(row) : null;
  }

  /**
   * Get a single canvas object by ID (alias for findByIdWithDetails)
   */
  async findById(id: string): Promise<CanvasObjectWithDetails | null> {
    return this.findByIdWithDetails(id);
  }

  /**
   * Get canvas object with all related details (shape, buffer props, process link)
   */
  async findByIdWithDetails(id: string): Promise<CanvasObjectWithDetails | null> {
    const obj = await this.findByIdSimple(id);
    if (!obj) {
      return null;
    }

    // Get shape definition (using join for efficiency)
    const shapeRow = this.db
      .prepare(`
        SELECT sc.* FROM shape_catalog sc
        JOIN canvas_objects co ON co.shape_id = sc.id
        WHERE co.id = ?
      `)
      .get(id);

    if (!shapeRow) {
      throw new Error(`Shape not found for canvas object ${id}`);
    }

    // Get anchors for the shape
    const anchorRows = this.db
      .prepare('SELECT * FROM shape_anchors WHERE shape_id = ?')
      .all(obj.shapeId);

    // Build the result
    const result: CanvasObjectWithDetails = {
      ...obj,
      shape: {
        id: (shapeRow as any).id,
        categoryId: (shapeRow as any).category_id,
        name: (shapeRow as any).name,
        description: (shapeRow as any).description ?? undefined,
        source: (shapeRow as any).source,
        sourceFile: (shapeRow as any).source_file ?? undefined,
        renderType: (shapeRow as any).render_type,
        svgContent: (shapeRow as any).svg_content ?? undefined,
        imageUrl: (shapeRow as any).image_url ?? undefined,
        primitiveType: (shapeRow as any).primitive_type ?? undefined,
        defaultWidth: (shapeRow as any).default_width,
        defaultHeight: (shapeRow as any).default_height,
        thumbnailSvg: (shapeRow as any).thumbnail_svg ?? undefined,
        isActive: Boolean((shapeRow as any).is_active),
        isFavorite: Boolean((shapeRow as any).is_favorite),
        usageCount: (shapeRow as any).usage_count,
        anchors: (anchorRows as any[]).map((a: any) => ({
          id: a.id,
          shapeId: a.shape_id,
          name: a.name ?? undefined,
          position: a.position,
          offsetX: a.offset_x,
          offsetY: a.offset_y,
          isInput: Boolean(a.is_input),
          isOutput: Boolean(a.is_output),
        })),
      },
    };

    // Get buffer properties if object type is buffer
    if (obj.objectType === 'buffer') {
      const bufferRow = this.db
        .prepare('SELECT * FROM buffer_properties WHERE canvas_object_id = ?')
        .get(id) as BufferPropertiesRow | undefined;

      if (bufferRow) {
        result.bufferProperties = this.mapBufferRowToEntity(bufferRow);
      }
    }

    // Get process properties and link if object type is process
    if (obj.objectType === 'process') {
      // Get process properties (new approach - process has its own properties)
      const propsRow = this.db
        .prepare('SELECT * FROM process_properties WHERE canvas_object_id = ?')
        .get(id) as ProcessPropertiesRow | undefined;

      if (propsRow) {
        result.processProperties = this.mapProcessPropertiesRowToEntity(propsRow);
      }

      // Get process link (legacy approach - link to existing production line)
      const linkRow = this.db
        .prepare('SELECT * FROM process_line_links WHERE canvas_object_id = ?')
        .get(id) as ProcessLineLinkRow | undefined;

      if (linkRow) {
        result.processLink = this.mapProcessLinkRowToEntity(linkRow);

        // Get linked production line if linked
        if (linkRow.production_line_id) {
          const lineRow = this.db
            .prepare('SELECT * FROM production_lines WHERE id = ?')
            .get(linkRow.production_line_id);

          if (lineRow) {
            result.linkedLine = {
              id: (lineRow as any).id,
              plantId: (lineRow as any).plant_id,
              name: (lineRow as any).name,
              area: (lineRow as any).area,
              lineType: (lineRow as any).line_type ?? 'manual',
              timeAvailableDaily: (lineRow as any).time_available_daily ?? (lineRow as any).time_available ?? 0,
              xPosition: (lineRow as any).x_position ?? 0,
              yPosition: (lineRow as any).y_position ?? 0,
              changeoverEnabled: Boolean((lineRow as any).changeover_enabled),
              changeoverExplicit: Boolean((lineRow as any).changeover_explicit),
              active: Boolean((lineRow as any).active),
              createdAt: new Date((lineRow as any).created_at),
              updatedAt: new Date((lineRow as any).updated_at),
            } as ProductionLine;
          }
        }
      }
    }

    return result;
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new canvas object
   */
  async create(input: CreateCanvasObjectInput): Promise<CanvasObject> {
    const id = nanoid();
    const now = new Date().toISOString();

    const result = this.db
      .prepare(`
        INSERT INTO canvas_objects (
          id, plant_id, shape_id, object_type, name, description,
          x_position, y_position, width, height, rotation,
          color_override, active, locked, z_index,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.plantId,
        input.shapeId,
        input.objectType ?? 'generic',
        input.name,
        input.description ?? null,
        input.xPosition ?? 0,
        input.yPosition ?? 0,
        input.width ?? null,
        input.height ?? null,
        0, // rotation
        null, // color_override
        1, // active
        0, // locked
        0, // z_index
        now,
        now
      );

    // Verify insert succeeded
    if (result.changes === 0) {
      throw new Error('Failed to insert canvas object');
    }

    // Force WAL checkpoint for persistence
    // WAL checkpoint removed to prevent table locks during bulk operations

    const obj = await this.findByIdSimple(id);
    if (!obj) {
      throw new Error('Failed to retrieve created canvas object');
    }
    return obj;
  }

  /**
   * Update an existing canvas object
   */
  async update(id: string, input: UpdateCanvasObjectInput): Promise<CanvasObject> {
    const existing = await this.findByIdSimple(id);
    if (!existing) {
      throw new Error(`Canvas object with id "${id}" not found`);
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }
    if (input.xPosition !== undefined) {
      updates.push('x_position = ?');
      params.push(input.xPosition);
    }
    if (input.yPosition !== undefined) {
      updates.push('y_position = ?');
      params.push(input.yPosition);
    }
    if (input.width !== undefined) {
      updates.push('width = ?');
      params.push(input.width);
    }
    if (input.height !== undefined) {
      updates.push('height = ?');
      params.push(input.height);
    }
    if (input.rotation !== undefined) {
      updates.push('rotation = ?');
      params.push(input.rotation);
    }
    if (input.colorOverride !== undefined) {
      updates.push('color_override = ?');
      params.push(input.colorOverride);
    }
    if (input.locked !== undefined) {
      updates.push('locked = ?');
      params.push(input.locked ? 1 : 0);
    }
    if (input.zIndex !== undefined) {
      updates.push('z_index = ?');
      params.push(input.zIndex);
    }
    if (input.objectType !== undefined) {
      updates.push('object_type = ?');
      params.push(input.objectType);
    }

    if (updates.length === 0) {
      return existing; // Nothing to update
    }

    // Always update timestamp
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    // Add id for WHERE clause
    params.push(id);

    const result = this.db.prepare(`UPDATE canvas_objects SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Verify update succeeded
    if (result.changes === 0) {
      throw new Error(`Failed to update canvas object ${id} - no rows modified`);
    }

    // Force WAL checkpoint for persistence
    // WAL checkpoint removed to prevent table locks during bulk operations

    const updated = await this.findByIdSimple(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated canvas object');
    }
    return updated;
  }

  /**
   * Soft delete a canvas object
   */
  async delete(id: string): Promise<void> {
    const existing = await this.findByIdSimple(id);

    if (!existing) {
      throw new Error(`Canvas object with id "${id}" not found`);
    }

    const result = this.db
      .prepare('UPDATE canvas_objects SET active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    if (result.changes === 0) {
      throw new Error(`Failed to delete canvas object ${id} - no rows updated`);
    }

    // Force WAL checkpoint to ensure persistence across app restarts
    // WAL checkpoint removed to prevent table locks during bulk operations
  }

  /**
   * Update position of a single object
   */
  async updatePosition(id: string, x: number, y: number): Promise<void> {
    this.db
      .prepare('UPDATE canvas_objects SET x_position = ?, y_position = ?, updated_at = ? WHERE id = ?')
      .run(x, y, new Date().toISOString(), id);
  }

  /**
   * Batch update positions (for drag-select moves)
   */
  async updatePositionsBatch(positions: Array<{ id: string; x: number; y: number }>): Promise<void> {
    const now = new Date().toISOString();

    const updateTx = this.db.transaction(() => {
      const stmt = this.db.prepare(
        'UPDATE canvas_objects SET x_position = ?, y_position = ?, updated_at = ? WHERE id = ?'
      );

      for (const pos of positions) {
        stmt.run(pos.x, pos.y, now, pos.id);
      }
    });

    updateTx();
  }

  /**
   * Duplicate a canvas object
   */
  async duplicate(id: string): Promise<CanvasObject> {
    const original = await this.findByIdSimple(id);
    if (!original) {
      throw new Error(`Canvas object with id "${id}" not found`);
    }

    const newId = nanoid();
    const now = new Date().toISOString();

    // Offset position slightly
    const offsetX = original.xPosition + 20;
    const offsetY = original.yPosition + 20;

    this.db
      .prepare(`
        INSERT INTO canvas_objects (
          id, plant_id, shape_id, object_type, name, description,
          x_position, y_position, width, height, rotation,
          color_override, active, locked, z_index,
          created_at, updated_at
        )
        SELECT ?, plant_id, shape_id, object_type, ? || ' (Copy)', description,
          ?, ?, width, height, rotation,
          color_override, active, locked, z_index,
          ?, ?
        FROM canvas_objects WHERE id = ?
      `)
      .run(newId, original.name, offsetX, offsetY, now, now, id);

    // If it's a buffer, duplicate buffer properties
    if (original.objectType === 'buffer') {
      const bufferRow = this.db
        .prepare('SELECT * FROM buffer_properties WHERE canvas_object_id = ?')
        .get(id) as BufferPropertiesRow | undefined;

      if (bufferRow) {
        this.db
          .prepare(`
            INSERT INTO buffer_properties (
              id, canvas_object_id, max_capacity, buffer_time_hours,
              current_wip, fifo_enforced, overflow_policy, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            nanoid(),
            newId,
            bufferRow.max_capacity,
            bufferRow.buffer_time_hours,
            0, // reset current_wip
            bufferRow.fifo_enforced,
            bufferRow.overflow_policy,
            now,
            now
          );
      }
    }

    // If it's a process, duplicate process properties and create unlinked link
    if (original.objectType === 'process') {
      // Duplicate process properties if they exist
      const propsRow = this.db
        .prepare('SELECT * FROM process_properties WHERE canvas_object_id = ?')
        .get(id) as ProcessPropertiesRow | undefined;

      if (propsRow) {
        this.db
          .prepare(`
            INSERT INTO process_properties (
              id, canvas_object_id, area, time_available_daily,
              line_type, changeover_enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            nanoid(),
            newId,
            propsRow.area,
            propsRow.time_available_daily,
            propsRow.line_type,
            propsRow.changeover_enabled,
            now,
            now
          );
      }

      // Create unlinked process link (don't duplicate the link)
      this.db
        .prepare(`
          INSERT INTO process_line_links (id, canvas_object_id, production_line_id, created_at)
          VALUES (?, ?, NULL, ?)
        `)
        .run(nanoid(), newId, now);
    }

    const duplicated = await this.findByIdSimple(newId);
    if (!duplicated) {
      throw new Error('Failed to duplicate canvas object');
    }
    return duplicated;
  }

  /**
   * Convert object to a different type (polymorphic type change)
   */
  async convertType(id: string, newType: CanvasObjectType): Promise<CanvasObject> {
    const existing = await this.findByIdSimple(id);
    if (!existing) {
      throw new Error(`Canvas object with id "${id}" not found`);
    }

    if (existing.objectType === newType) {
      return existing; // No conversion needed
    }

    const now = new Date().toISOString();

    const convertTx = this.db.transaction(() => {
      // Update object type
      this.db
        .prepare('UPDATE canvas_objects SET object_type = ?, updated_at = ? WHERE id = ?')
        .run(newType, now, id);

      // Clean up old type-specific data
      if (existing.objectType === 'buffer') {
        this.db.prepare('DELETE FROM buffer_properties WHERE canvas_object_id = ?').run(id);
      } else if (existing.objectType === 'process') {
        this.db.prepare('DELETE FROM process_line_links WHERE canvas_object_id = ?').run(id);
        this.db.prepare('DELETE FROM process_properties WHERE canvas_object_id = ?').run(id);
      }

      // Create new type-specific data
      if (newType === 'buffer') {
        this.db
          .prepare(`
            INSERT INTO buffer_properties (
              id, canvas_object_id, max_capacity, buffer_time_hours,
              current_wip, fifo_enforced, overflow_policy, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(nanoid(), id, 100, 4.0, 0, 1, 'block', now, now);
      } else if (newType === 'process') {
        // Create process link (legacy)
        this.db
          .prepare(`
            INSERT INTO process_line_links (id, canvas_object_id, production_line_id, created_at)
            VALUES (?, ?, NULL, ?)
          `)
          .run(nanoid(), id, now);

        // Create process properties with defaults
        this.db
          .prepare(`
            INSERT INTO process_properties (
              id, canvas_object_id, area, time_available_daily,
              line_type, changeover_enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(nanoid(), id, '', 72000, 'shared', 1, now, now);
      }
    });

    convertTx();

    const converted = await this.findByIdSimple(id);
    if (!converted) {
      throw new Error('Failed to convert canvas object type');
    }
    return converted;
  }

  // ============================================
  // BUFFER PROPERTIES
  // ============================================

  /**
   * Get buffer properties for a canvas object
   */
  async getBufferProperties(canvasObjectId: string): Promise<BufferProperties | null> {
    const row = this.db
      .prepare('SELECT * FROM buffer_properties WHERE canvas_object_id = ?')
      .get(canvasObjectId) as BufferPropertiesRow | undefined;

    return row ? this.mapBufferRowToEntity(row) : null;
  }

  /**
   * Set buffer properties (create or update)
   */
  async setBufferProperties(
    canvasObjectId: string,
    props: Partial<BufferProperties>
  ): Promise<BufferProperties> {
    const existing = await this.getBufferProperties(canvasObjectId);
    const now = new Date().toISOString();

    if (!existing) {
      // Create new buffer properties
      const id = nanoid();
      this.db
        .prepare(`
          INSERT INTO buffer_properties (
            id, canvas_object_id, max_capacity, buffer_time_hours,
            current_wip, fifo_enforced, overflow_policy, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          canvasObjectId,
          props.maxCapacity ?? 100,
          props.bufferTimeHours ?? 4.0,
          props.currentWip ?? 0,
          props.fifoEnforced !== false ? 1 : 0,
          props.overflowPolicy ?? 'block',
          now,
          now
        );

      const created = await this.getBufferProperties(canvasObjectId);
      if (!created) {
        throw new Error('Failed to create buffer properties');
      }
      return created;
    } else {
      // Update existing buffer properties
      const updates: string[] = [];
      const params: unknown[] = [];

      if (props.maxCapacity !== undefined) {
        updates.push('max_capacity = ?');
        params.push(props.maxCapacity);
      }
      if (props.bufferTimeHours !== undefined) {
        updates.push('buffer_time_hours = ?');
        params.push(props.bufferTimeHours);
      }
      if (props.currentWip !== undefined) {
        updates.push('current_wip = ?');
        params.push(props.currentWip);
      }
      if (props.fifoEnforced !== undefined) {
        updates.push('fifo_enforced = ?');
        params.push(props.fifoEnforced ? 1 : 0);
      }
      if (props.overflowPolicy !== undefined) {
        updates.push('overflow_policy = ?');
        params.push(props.overflowPolicy);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(canvasObjectId);

        this.db
          .prepare(`UPDATE buffer_properties SET ${updates.join(', ')} WHERE canvas_object_id = ?`)
          .run(...params);
      }

      const updated = await this.getBufferProperties(canvasObjectId);
      if (!updated) {
        throw new Error('Failed to update buffer properties');
      }
      return updated;
    }
  }

  // ============================================
  // PROCESS PROPERTIES
  // ============================================

  /**
   * Get process properties for a canvas object
   */
  async getProcessProperties(canvasObjectId: string): Promise<ProcessProperties | null> {
    const row = this.db
      .prepare('SELECT * FROM process_properties WHERE canvas_object_id = ?')
      .get(canvasObjectId) as ProcessPropertiesRow | undefined;

    return row ? this.mapProcessPropertiesRowToEntity(row) : null;
  }

  /**
   * Set process properties (create or update)
   */
  async setProcessProperties(
    canvasObjectId: string,
    props: UpdateProcessPropertiesInput
  ): Promise<ProcessProperties> {
    const existing = await this.getProcessProperties(canvasObjectId);
    const now = new Date().toISOString();

    if (!existing) {
      // Create new process properties
      const id = nanoid();
      this.db
        .prepare(`
          INSERT INTO process_properties (
            id, canvas_object_id, area, time_available_daily,
            line_type, changeover_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          canvasObjectId,
          props.area ?? '',
          props.timeAvailableDaily ?? 72000,  // 20 hours default
          props.lineType ?? 'shared',
          props.changeoverEnabled !== false ? 1 : 0,
          now,
          now
        );

      // Force WAL checkpoint for persistence
      // WAL checkpoint removed to prevent table locks during bulk operations

      const created = await this.getProcessProperties(canvasObjectId);
      if (!created) {
        throw new Error('Failed to create process properties');
      }
      return created;
    } else {
      // Update existing process properties
      const updates: string[] = [];
      const params: unknown[] = [];

      if (props.area !== undefined) {
        updates.push('area = ?');
        params.push(props.area);
      }
      if (props.timeAvailableDaily !== undefined) {
        updates.push('time_available_daily = ?');
        params.push(props.timeAvailableDaily);
      }
      if (props.lineType !== undefined) {
        updates.push('line_type = ?');
        params.push(props.lineType);
      }
      if (props.changeoverEnabled !== undefined) {
        updates.push('changeover_enabled = ?');
        params.push(props.changeoverEnabled ? 1 : 0);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(canvasObjectId);

        this.db
          .prepare(`UPDATE process_properties SET ${updates.join(', ')} WHERE canvas_object_id = ?`)
          .run(...params);

        // Force WAL checkpoint for persistence
        // WAL checkpoint removed to prevent table locks during bulk operations
      }

      const updated = await this.getProcessProperties(canvasObjectId);
      if (!updated) {
        throw new Error('Failed to update process properties');
      }
      return updated;
    }
  }

  // ============================================
  // PROCESS LINE LINKING
  // ============================================

  /**
   * Link canvas object to a production line
   */
  async linkToLine(canvasObjectId: string, productionLineId: string): Promise<ProcessLineLink> {
    const obj = await this.findByIdSimple(canvasObjectId);
    if (!obj) {
      throw new Error(`Canvas object with id "${canvasObjectId}" not found`);
    }

    if (obj.objectType !== 'process') {
      throw new Error('Can only link process objects to production lines');
    }

    const now = new Date().toISOString();

    // Check if link exists
    const existing = this.db
      .prepare('SELECT * FROM process_line_links WHERE canvas_object_id = ?')
      .get(canvasObjectId) as ProcessLineLinkRow | undefined;

    if (existing) {
      // Update existing link
      this.db
        .prepare('UPDATE process_line_links SET production_line_id = ? WHERE canvas_object_id = ?')
        .run(productionLineId, canvasObjectId);
    } else {
      // Create new link
      this.db
        .prepare(`
          INSERT INTO process_line_links (id, canvas_object_id, production_line_id, created_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(nanoid(), canvasObjectId, productionLineId, now);
    }

    const link = this.db
      .prepare('SELECT * FROM process_line_links WHERE canvas_object_id = ?')
      .get(canvasObjectId) as ProcessLineLinkRow;

    return this.mapProcessLinkRowToEntity(link);
  }

  /**
   * Unlink canvas object from production line
   */
  async unlinkFromLine(canvasObjectId: string): Promise<void> {
    this.db
      .prepare('UPDATE process_line_links SET production_line_id = NULL WHERE canvas_object_id = ?')
      .run(canvasObjectId);
  }

  /**
   * Get linked production line for a canvas object
   */
  async getLinkedLine(canvasObjectId: string): Promise<ProductionLine | null> {
    const link = this.db
      .prepare('SELECT * FROM process_line_links WHERE canvas_object_id = ?')
      .get(canvasObjectId) as ProcessLineLinkRow | undefined;

    if (!link || !link.production_line_id) {
      return null;
    }

    const lineRow = this.db
      .prepare('SELECT * FROM production_lines WHERE id = ?')
      .get(link.production_line_id);

    if (!lineRow) {
      return null;
    }

    return {
      id: (lineRow as any).id,
      plantId: (lineRow as any).plant_id,
      name: (lineRow as any).name,
      area: (lineRow as any).area,
      lineType: (lineRow as any).line_type ?? 'manual',
      timeAvailableDaily: (lineRow as any).time_available_daily ?? (lineRow as any).time_available ?? 0,
      xPosition: (lineRow as any).x_position ?? 0,
      yPosition: (lineRow as any).y_position ?? 0,
      changeoverEnabled: Boolean((lineRow as any).changeover_enabled),
      changeoverExplicit: Boolean((lineRow as any).changeover_explicit),
      active: Boolean((lineRow as any).active),
      createdAt: new Date((lineRow as any).created_at),
      updatedAt: new Date((lineRow as any).updated_at),
    } as ProductionLine;
  }

  // ============================================
  // CONNECTIONS
  // ============================================

  /**
   * Get all connections for a plant
   */
  async getConnections(plantId: string): Promise<CanvasConnection[]> {
    const rows = this.db
      .prepare('SELECT * FROM canvas_connections WHERE plant_id = ? AND active = 1')
      .all(plantId) as CanvasConnectionRow[];

    return rows.map(row => this.mapConnectionRowToEntity(row));
  }

  /**
   * Create a connection between objects
   */
  async createConnection(input: CreateConnectionInput): Promise<CanvasConnection> {
    const id = nanoid();
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO canvas_connections (
          id, plant_id, source_object_id, source_anchor,
          target_object_id, target_anchor, connection_type, label, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.plantId,
        input.sourceObjectId,
        input.sourceAnchor ?? null,
        input.targetObjectId,
        input.targetAnchor ?? null,
        input.connectionType ?? 'flow',
        input.label ?? null,
        1, // active
        now
      );

    const connection = this.db
      .prepare('SELECT * FROM canvas_connections WHERE id = ?')
      .get(id) as CanvasConnectionRow;

    return this.mapConnectionRowToEntity(connection);
  }

  /**
   * Delete a connection
   */
  async deleteConnection(id: string): Promise<void> {
    this.db.prepare('DELETE FROM canvas_connections WHERE id = ?').run(id);
  }

  /**
   * Update a connection's properties
   */
  async updateConnection(
    id: string,
    updates: { connectionType?: 'flow' | 'info' | 'material'; label?: string }
  ): Promise<CanvasConnection> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.connectionType !== undefined) {
      setClauses.push('connection_type = ?');
      values.push(updates.connectionType);
    }

    if (updates.label !== undefined) {
      setClauses.push('label = ?');
      values.push(updates.label);
    }

    if (setClauses.length === 0) {
      // No updates, just return current connection
      const row = this.db
        .prepare('SELECT * FROM canvas_connections WHERE id = ?')
        .get(id) as CanvasConnectionRow;
      return this.mapConnectionRowToEntity(row);
    }

    values.push(id);

    this.db
      .prepare(`UPDATE canvas_connections SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...values);

    const connection = this.db
      .prepare('SELECT * FROM canvas_connections WHERE id = ?')
      .get(id) as CanvasConnectionRow;

    return this.mapConnectionRowToEntity(connection);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get all objects of a specific type for a plant
   */
  async findByPlantAndType(plantId: string, objectType: CanvasObjectType): Promise<CanvasObject[]> {
    const rows = this.db
      .prepare('SELECT * FROM canvas_objects WHERE plant_id = ? AND object_type = ? AND active = 1')
      .all(plantId, objectType) as CanvasObjectRow[];

    return rows.map(row => this.mapObjectRowToEntity(row));
  }

  /**
   * Get object count by type for a plant
   */
  async getObjectCountByType(plantId: string, objectType: CanvasObjectType): Promise<number> {
    const result = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM canvas_objects
        WHERE plant_id = ? AND object_type = ? AND active = 1
      `)
      .get(plantId, objectType) as { count: number };

    return result.count;
  }

  /**
   * Get all unlinked process objects (process objects without production line)
   */
  async findUnlinkedProcesses(plantId: string): Promise<CanvasObject[]> {
    const rows = this.db
      .prepare(`
        SELECT co.* FROM canvas_objects co
        LEFT JOIN process_line_links pll ON co.id = pll.canvas_object_id
        WHERE co.plant_id = ? AND co.object_type = 'process' AND co.active = 1
        AND (pll.production_line_id IS NULL)
      `)
      .all(plantId) as CanvasObjectRow[];

    return rows.map(row => this.mapObjectRowToEntity(row));
  }
}
