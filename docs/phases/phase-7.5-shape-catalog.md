# Plan: Sistema de Objetos Polimórficos con Shape Catalog

**Fecha:** 2026-02-02
**Proyecto:** Line Optimizer
**Versión actual:** 0.7.3
**Feature:** Canvas Object System con Shape Catalog extensible

---

## 1. Visión General

Crear un sistema de objetos en el canvas que sea:
1. **Polimórfico**: Cualquier forma puede convertirse a cualquier tipo funcional
2. **Extensible**: Nuevas formas pueden agregarse sin modificar código
3. **Future-ready**: Preparado para importar desde AutoCAD, imágenes, o IA

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ARQUITECTURA DEL SISTEMA                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐   │
│  │  Shape Catalog  │      │  Canvas Object  │      │  Object Type    │   │
│  │  (Formas)       │◀────▶│  (Instancia)    │◀────▶│  (Propiedades)  │   │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘   │
│         │                                                   │             │
│         ▼                                                   ▼             │
│  ┌─────────────────┐                              ┌─────────────────┐    │
│  │ Sources:        │                              │ Types:          │    │
│  │ • Built-in      │                              │ • Process/Line  │    │
│  │ • DXF/AutoCAD   │                              │ • Buffer        │    │
│  │ • SVG/Images    │                              │ • Source        │    │
│  │ • AI Generated  │                              │ • Sink          │    │
│  └─────────────────┘                              │ • Quality Gate  │    │
│                                                   └─────────────────┘    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Base de Datos

### 2.1 Migración: `012_shape_catalog.sql`

```sql
-- ============================================
-- SHAPE CATALOG: Catálogo de formas disponibles
-- Extensible: built-in, imported, AI-generated
-- ============================================

-- Categorías de shapes
CREATE TABLE IF NOT EXISTS shape_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  icon TEXT,  -- Lucide icon name
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo de shapes
CREATE TABLE IF NOT EXISTS shape_catalog (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Fuente del shape
  source TEXT NOT NULL DEFAULT 'builtin',  -- 'builtin' | 'imported' | 'ai_generated' | 'user'
  source_file TEXT,                         -- Path original (para imports)

  -- Rendering (uno de estos campos tendrá valor)
  render_type TEXT NOT NULL DEFAULT 'svg',  -- 'svg' | 'image' | 'path' | 'primitive'
  svg_content TEXT,                          -- SVG completo o path data
  image_url TEXT,                            -- URL/path a imagen
  primitive_type TEXT,                       -- 'rectangle' | 'triangle' | 'circle' | 'diamond'

  -- Dimensiones por defecto
  default_width REAL DEFAULT 200,
  default_height REAL DEFAULT 100,

  -- Metadatos para display
  thumbnail_svg TEXT,                        -- Mini preview para toolbar

  -- Control
  is_active BOOLEAN DEFAULT 1,
  is_favorite BOOLEAN DEFAULT 0,
  usage_count INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES shape_categories(id)
);

-- Anchors (puntos de conexión) para cada shape
CREATE TABLE IF NOT EXISTS shape_anchors (
  id TEXT PRIMARY KEY,
  shape_id TEXT NOT NULL,
  name TEXT,                                 -- 'input', 'output', 'top', etc.
  position TEXT NOT NULL,                    -- 'top' | 'right' | 'bottom' | 'left'
  offset_x REAL DEFAULT 0.5,                 -- 0-1 relative position
  offset_y REAL DEFAULT 0.5,
  is_input BOOLEAN DEFAULT 1,
  is_output BOOLEAN DEFAULT 1,

  FOREIGN KEY (shape_id) REFERENCES shape_catalog(id) ON DELETE CASCADE
);

-- Datos iniciales: categorías
INSERT INTO shape_categories (id, name, display_order, icon) VALUES
  ('basic', 'Basic Shapes', 1, 'Shapes'),
  ('machines', 'Machines & Equipment', 2, 'Cog'),
  ('flow', 'Flow Control', 3, 'GitBranch'),
  ('custom', 'Custom', 99, 'Sparkles');

-- Datos iniciales: shapes básicos
INSERT INTO shape_catalog (id, category_id, name, source, render_type, primitive_type, default_width, default_height) VALUES
  ('rect-basic', 'basic', 'Rectangle', 'builtin', 'primitive', 'rectangle', 200, 100),
  ('triangle-basic', 'basic', 'Triangle', 'builtin', 'primitive', 'triangle', 200, 120),
  ('circle-basic', 'basic', 'Circle', 'builtin', 'primitive', 'circle', 120, 120),
  ('diamond-basic', 'basic', 'Diamond', 'builtin', 'primitive', 'diamond', 120, 120);

-- Anchors para shapes básicos
INSERT INTO shape_anchors (id, shape_id, name, position, offset_x, offset_y) VALUES
  ('rect-top', 'rect-basic', 'top', 'top', 0.5, 0),
  ('rect-bottom', 'rect-basic', 'bottom', 'bottom', 0.5, 1),
  ('rect-left', 'rect-basic', 'left', 'left', 0, 0.5),
  ('rect-right', 'rect-basic', 'right', 'right', 1, 0.5),
  ('tri-top', 'triangle-basic', 'top', 'top', 0.5, 0),
  ('tri-bottom-left', 'triangle-basic', 'bottom-left', 'bottom', 0.25, 1),
  ('tri-bottom-right', 'triangle-basic', 'bottom-right', 'bottom', 0.75, 1),
  ('circle-top', 'circle-basic', 'top', 'top', 0.5, 0),
  ('circle-bottom', 'circle-basic', 'bottom', 'bottom', 0.5, 1),
  ('circle-left', 'circle-basic', 'left', 'left', 0, 0.5),
  ('circle-right', 'circle-basic', 'right', 'right', 1, 0.5);

CREATE INDEX IF NOT EXISTS idx_shape_catalog_category ON shape_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_shape_catalog_source ON shape_catalog(source);
CREATE INDEX IF NOT EXISTS idx_shape_anchors_shape ON shape_anchors(shape_id);
```

### 2.2 Migración: `013_canvas_objects.sql`

```sql
-- ============================================
-- CANVAS OBJECTS: Instancias de shapes en el canvas
-- Polimórficos: pueden convertirse a diferentes tipos
-- ============================================

CREATE TABLE IF NOT EXISTS canvas_objects (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,

  -- Referencia al shape del catálogo
  shape_id TEXT NOT NULL,

  -- Tipo funcional (determina propiedades)
  object_type TEXT NOT NULL DEFAULT 'generic',  -- 'generic'|'process'|'buffer'|'source'|'sink'|'quality_gate'

  -- Identificación
  name TEXT NOT NULL,
  description TEXT,

  -- Posición y tamaño en canvas
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  width REAL,      -- NULL = usar default del shape
  height REAL,     -- NULL = usar default del shape
  rotation REAL DEFAULT 0,  -- Grados

  -- Visual
  color_override TEXT,  -- NULL = usar color por defecto del tipo

  -- Control
  active BOOLEAN DEFAULT 1,
  locked BOOLEAN DEFAULT 0,
  z_index INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  FOREIGN KEY (shape_id) REFERENCES shape_catalog(id)
);

-- Propiedades específicas para tipo 'buffer'
CREATE TABLE IF NOT EXISTS buffer_properties (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL UNIQUE,
  max_capacity INTEGER DEFAULT 100,           -- Unidades máximas
  buffer_time_hours REAL DEFAULT 4.0,         -- Horas de cobertura objetivo
  current_wip INTEGER DEFAULT 0,              -- WIP actual (para simulación)
  fifo_enforced BOOLEAN DEFAULT 1,
  overflow_policy TEXT DEFAULT 'block',       -- 'block' | 'overflow' | 'alert'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE
);

-- Link entre canvas object tipo 'process' y production_line existente
CREATE TABLE IF NOT EXISTS process_line_links (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL UNIQUE,
  production_line_id TEXT,  -- NULL si aún no está linkedado
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE,
  FOREIGN KEY (production_line_id) REFERENCES production_lines(id) ON DELETE SET NULL
);

-- Conexiones entre objetos (edges)
CREATE TABLE IF NOT EXISTS canvas_connections (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  source_anchor TEXT,                         -- Nombre del anchor
  target_object_id TEXT NOT NULL,
  target_anchor TEXT,
  connection_type TEXT DEFAULT 'flow',        -- 'flow' | 'info' | 'material'
  label TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  FOREIGN KEY (source_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE,
  FOREIGN KEY (target_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canvas_objects_plant ON canvas_objects(plant_id);
CREATE INDEX IF NOT EXISTS idx_canvas_objects_type ON canvas_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_plant ON canvas_connections(plant_id);
```

---

## 3. TypeScript Types

### 3.1 Archivo: `src/shared/types/shape-catalog.ts`

```typescript
// ============================================
// SHAPE CATALOG TYPES
// ============================================

export type ShapeSource = 'builtin' | 'imported' | 'ai_generated' | 'user';
export type ShapeRenderType = 'svg' | 'image' | 'path' | 'primitive';
export type PrimitiveType = 'rectangle' | 'triangle' | 'circle' | 'diamond';

export interface ShapeCategory {
  id: string;
  name: string;
  displayOrder: number;
  icon?: string;
}

export interface ShapeDefinition {
  id: string;
  categoryId: string;
  name: string;
  description?: string;

  // Source
  source: ShapeSource;
  sourceFile?: string;

  // Rendering
  renderType: ShapeRenderType;
  svgContent?: string;
  imageUrl?: string;
  primitiveType?: PrimitiveType;

  // Dimensions
  defaultWidth: number;
  defaultHeight: number;

  // Display
  thumbnailSvg?: string;

  // Metadata
  isActive: boolean;
  isFavorite: boolean;
  usageCount: number;

  // Anchors
  anchors: ShapeAnchor[];
}

export interface ShapeAnchor {
  id: string;
  shapeId: string;
  name?: string;
  position: 'top' | 'right' | 'bottom' | 'left';
  offsetX: number;  // 0-1
  offsetY: number;  // 0-1
  isInput: boolean;
  isOutput: boolean;
}
```

### 3.2 Archivo: `src/shared/types/canvas-object.ts`

```typescript
// ============================================
// CANVAS OBJECT TYPES
// ============================================

export type CanvasObjectType =
  | 'generic'
  | 'process'
  | 'buffer'
  | 'source'
  | 'sink'
  | 'quality_gate';

export interface CanvasObject {
  id: string;
  plantId: string;
  shapeId: string;
  objectType: CanvasObjectType;
  name: string;
  description?: string;
  xPosition: number;
  yPosition: number;
  width?: number;
  height?: number;
  rotation: number;
  colorOverride?: string;
  active: boolean;
  locked: boolean;
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BufferProperties {
  id: string;
  canvasObjectId: string;
  maxCapacity: number;
  bufferTimeHours: number;
  currentWip: number;
  fifoEnforced: boolean;
  overflowPolicy: 'block' | 'overflow' | 'alert';
}

export interface ProcessLineLink {
  id: string;
  canvasObjectId: string;
  productionLineId?: string;
}

export interface CanvasConnection {
  id: string;
  plantId: string;
  sourceObjectId: string;
  sourceAnchor?: string;
  targetObjectId: string;
  targetAnchor?: string;
  connectionType: 'flow' | 'info' | 'material';
  label?: string;
}

// Combined type for UI
export interface CanvasObjectWithDetails extends CanvasObject {
  shape: ShapeDefinition;
  bufferProperties?: BufferProperties;
  processLink?: ProcessLineLink;
  linkedLine?: ProductionLine;
}
```

### 3.3 Archivo: `src/shared/types/canvas-tool.ts`

```typescript
// ============================================
// CANVAS TOOL STATE TYPES
// ============================================

export type CanvasTool =
  | 'select'
  | 'pan'
  | 'connect'
  | { type: 'place'; shapeId: string };

export interface ToolState {
  activeTool: CanvasTool;
  ghostPosition: { x: number; y: number } | null;
  selectedObjectIds: string[];
  connectionSource: { objectId: string; anchor: string } | null;
}
```

---

## 4. IPC Channels

### Archivo: `src/shared/constants/index.ts`

```typescript
// Shape Catalog
export const SHAPE_CATALOG_CHANNELS = {
  GET_ALL: 'shape-catalog:get-all',
  GET_BY_CATEGORY: 'shape-catalog:get-by-category',
  GET_BY_ID: 'shape-catalog:get-by-id',
  IMPORT_SVG: 'shape-catalog:import-svg',
  IMPORT_DXF: 'shape-catalog:import-dxf',
  IMPORT_IMAGE: 'shape-catalog:import-image',
  UPDATE_FAVORITE: 'shape-catalog:update-favorite',
  DELETE: 'shape-catalog:delete',
} as const;

// Canvas Objects
export const CANVAS_OBJECT_CHANNELS = {
  GET_BY_PLANT: 'canvas-objects:get-by-plant',
  GET_BY_ID: 'canvas-objects:get-by-id',
  CREATE: 'canvas-objects:create',
  UPDATE: 'canvas-objects:update',
  DELETE: 'canvas-objects:delete',
  UPDATE_POSITION: 'canvas-objects:update-position',
  CONVERT_TYPE: 'canvas-objects:convert-type',
  DUPLICATE: 'canvas-objects:duplicate',
  // Buffer
  GET_BUFFER_PROPS: 'canvas-objects:get-buffer-props',
  SET_BUFFER_PROPS: 'canvas-objects:set-buffer-props',
  // Process linking
  LINK_TO_LINE: 'canvas-objects:link-to-line',
  UNLINK_FROM_LINE: 'canvas-objects:unlink-from-line',
  // Connections
  GET_CONNECTIONS: 'canvas-objects:get-connections',
  CREATE_CONNECTION: 'canvas-objects:create-connection',
  DELETE_CONNECTION: 'canvas-objects:delete-connection',
} as const;
```

---

## 5. Componentes UI

### 5.1 Object Palette (Left Toolbar)
**Archivo:** `src/renderer/features/canvas/components/toolbar/ObjectPalette.tsx`

```
┌────────────┐
│  ≡ TOOLS   │
├────────────┤
│  [✋] V     │  ← Select
│  [⊞] Pan   │  ← Pan/Scroll
│  [⎯] C     │  ← Connect
├────────────┤
│  ≡ SHAPES  │
├────────────┤
│  [□]       │  ← Rectangle
│  [△]       │  ← Triangle
│  [○]       │  ← Circle
│  [◇]       │  ← Diamond
├────────────┤
│  [+] More  │  ← Opens shape browser
└────────────┘
```

### 5.2 Shape Browser Modal
**Archivo:** `src/renderer/features/canvas/components/ShapeBrowserModal.tsx`

Modal para explorar todo el catálogo de shapes:
- Grid de shapes por categoría
- Búsqueda
- Favoritos
- Import buttons (SVG, DXF, Image)

### 5.3 Generic Shape Node
**Archivo:** `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`

Componente ReactFlow que:
- Renderiza según el `renderType` del shape
- Muestra badge del `objectType`
- Muestra propiedades específicas del tipo
- Handles para conexiones basados en anchors

### 5.4 Context Menu
**Archivo:** `src/renderer/features/canvas/components/ContextMenu.tsx`

Menú contextual con:
- Convert to... → Process, Buffer, (otros disabled)
- Delete
- Duplicate
- Lock/Unlock
- Properties...

### 5.5 Properties Panel
**Archivo:** `src/renderer/features/canvas/components/panels/ObjectPropertiesPanel.tsx`

Panel lateral que muestra propiedades según `objectType`:
- **generic**: Solo nombre
- **process**: Campos de ProductionLine
- **buffer**: maxCapacity, bufferTimeHours

---

## 6. Flujo de Usuario

### 6.1 Colocar Objeto
```
1. Usuario click en shape del palette
2. Tool cambia a 'place' mode
3. Ghost preview sigue cursor
4. Click en canvas → objeto creado como 'generic'
5. Tool permanece activo para colocar más
6. Esc → vuelve a Select
```

### 6.2 Convertir Objeto
```
1. Right-click en objeto
2. Context menu aparece
3. Hover "Convert to..." → submenu
4. Click "Process" o "Buffer"
5. Objeto cambia de tipo
6. Si es 'process' → modal para linkear a ProductionLine
7. Si es 'buffer' → panel muestra campos buffer
```

### 6.3 Importar Shape (futuro)
```
1. Click [+] More en palette
2. Shape Browser modal abre
3. Click "Import" → selector de archivo
4. Soporta: .svg, .dxf, .png, .jpg
5. Shape se agrega al catálogo
6. Aparece en categoría "Custom"
```

---

## 7. Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| **Database** ||
| `migrations/012_shape_catalog.sql` | Catálogo de formas |
| `migrations/013_canvas_objects.sql` | Objetos en canvas |
| **Types** ||
| `types/shape-catalog.ts` | Tipos del catálogo |
| `types/canvas-object.ts` | Tipos de objetos |
| `types/canvas-tool.ts` | Estado de herramientas |
| **Domain** ||
| `entities/ShapeDefinition.ts` | Entidad shape |
| `entities/CanvasObject.ts` | Entidad objeto |
| **Repositories** ||
| `repositories/SQLiteShapeCatalogRepository.ts` | Repo shapes |
| `repositories/SQLiteCanvasObjectRepository.ts` | Repo objetos |
| **IPC** ||
| `handlers/shape-catalog.handler.ts` | IPC shapes |
| `handlers/canvas-objects.handler.ts` | IPC objetos |
| **Store** ||
| `store/useToolStore.ts` | Estado herramienta activa |
| `store/useShapeCatalogStore.ts` | Catálogo shapes |
| `store/useCanvasObjectStore.ts` | Objetos canvas |
| **Components** ||
| `toolbar/ObjectPalette.tsx` | Palette izquierdo |
| `ShapeBrowserModal.tsx` | Browser de shapes |
| `nodes/GenericShapeNode.tsx` | Nodo polimórfico |
| `ContextMenu.tsx` | Menú contextual |
| `GhostPreview.tsx` | Preview placement |
| `panels/ObjectPropertiesPanel.tsx` | Panel propiedades |

---

## 8. Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `constants/index.ts` | Agregar channels |
| `types/index.ts` | Exportar nuevos tipos |
| `preload.ts` | Agregar channels |
| `handlers/index.ts` | Registrar handlers |
| `ProductionCanvas.tsx` | Integrar palette, context menu, nuevos nodes |

---

## 9. Backward Compatibility

- `ProductionLineNode` sigue funcionando para líneas existentes
- `GenericShapeNode` es nuevo para objetos del nuevo sistema
- Ambos coexisten en el canvas
- No se requiere migración de datos existentes

---

## 10. Verificación

1. **Shape Catalog**: Shapes builtin aparecen en palette
2. **Click-to-Place**: Seleccionar shape → click canvas → objeto aparece
3. **Context Menu**: Right-click → menú con opciones
4. **Convert to Process**: Cambia tipo, muestra campos línea
5. **Convert to Buffer**: Cambia tipo, muestra maxCapacity
6. **Keyboard Shortcuts**: V=Select, Esc=Select
7. **Persist**: Reload app → objetos persisten con tipo correcto

---

## 11. Futuras Extensiones

### 11.1 Import DXF (AutoCAD)
```typescript
// Parser DXF → SVG path
import { parseDxf } from 'dxf-parser';

async function importDxfShape(filePath: string): Promise<ShapeDefinition> {
  const dxf = await parseDxf(filePath);
  const svgPath = convertDxfToSvgPath(dxf);
  return createShapeFromSvg(svgPath, 'imported');
}
```

### 11.2 AI Shape Generation
```typescript
// Generar SVG con IA
async function generateShape(prompt: string): Promise<ShapeDefinition> {
  const svg = await callAnthropic({
    prompt: `Generate SVG for: ${prompt}`,
    // ...
  });
  return createShapeFromSvg(svg, 'ai_generated');
}
```

### 11.3 Image to Shape
```typescript
// Convertir imagen a shape con fondo
async function importImage(imagePath: string): Promise<ShapeDefinition> {
  const base64 = await readAsBase64(imagePath);
  return {
    renderType: 'image',
    imageUrl: `data:image/png;base64,${base64}`,
    // ...
  };
}
```

---

## 12. Progreso de Implementación

### Completado ✅

| Item | Fecha | Notas |
|------|-------|-------|
| Database migrations 012, 013, 014 | 2026-02-02 | Schema completo + polymorphic connections fix |
| TypeScript types (shape-catalog, canvas-object, canvas-tool) | 2026-02-02 | En `src/shared/types/` |
| IPC channels + handlers | 2026-02-02 | Shape catalog + canvas objects |
| Repositories (SQLite) | 2026-02-02 | ShapeCatalog + CanvasObject |
| Stores (Zustand) | 2026-02-02 | useToolStore, useShapeCatalogStore, useCanvasObjectStore |
| ObjectPalette (left toolbar) | 2026-02-02 | Tools + Basic shapes |
| GenericShapeNode | 2026-02-02 | Polymorphic node rendering |
| ProductionLineNode handles | 2026-02-02 | Updated for ConnectionMode.Loose compatibility |
| Context Menu | 2026-02-02 | Convert to type, delete, duplicate |
| GhostPreview | 2026-02-02 | Placement preview |
| ObjectPropertiesPanel | 2026-02-02 | Right panel for properties |
| LinkProcessModal | 2026-02-02 | Link Process objects to ProductionLines |
| Connect Tool | 2026-02-02 | Visual connections between ANY nodes |
| ConnectionContextMenu | 2026-02-02 | Change type, delete connections |
| Migration 014 | 2026-02-02 | Fixed polymorphic connections (removed FK constraint) |
| ShapeBrowserModal | 2026-02-02 | Full catalog browser with search, favorites, categories |
| Keyboard shortcut M | 2026-02-02 | Press M to open shape browser |
| **Canvas Object Compatibilities** | 2026-02-03 | Migration 016 + Repository + IPC handlers + Zustand store |
| **Assign Models to Process objects** | 2026-02-03 | AssignModelToObjectModal (cycle time, efficiency, priority) |
| **Convert Production Line to Canvas Object** | 2026-02-03 | Context menu works for imported lines, copies compatibilities |
| **Unified Properties Panel** | 2026-02-03 | Single floating panel for Lines AND Canvas Objects |
| **useSelectionState hook** | 2026-02-03 | Unified selection logic (line/object/multi/none) |
| **MiniMap dynamic positioning** | 2026-02-03 | Shifts left when properties panel is open |
| **Grid layout for AnalysisControlBar** | 2026-02-03 | Panel no longer overlaps control bar |
| **Tailwind slide-in animation** | 2026-02-03 | Smooth panel entrance animation |

### Próximos Pasos 🚧

| Item | Prioridad | Descripción |
|------|-----------|-------------|
| MiniMap UX refinement | Alta | Posición óptima cuando panel está abierto |
| Import SVG | Media | Importar shapes personalizados desde SVG (button ready in modal) |
| Import DXF | Baja | Parser DXF → SVG para AutoCAD |
| Import Image | Baja | Convertir imágenes a shapes |
| Multi-select operations | Baja | Alinear, distribuir, agrupar |

### Bugs Conocidos / Deuda Técnica

| Item | Severidad | Notas |
|------|-----------|-------|
| VIEW v_process_objects_with_lines | Fixed | Migración 014 arregló referencia a columna incorrecta |
| ProductionLineNode vs GenericShapeNode IDs | Info | ProductionLineNode usa IDs de `production_lines`, GenericShapeNode usa IDs de `canvas_objects`. Migración 014 quitó FK constraint para permitir conexiones mixtas. |
| LinePropertiesPanel / ObjectPropertiesPanel | Deprecated | Replaced by UnifiedPropertiesPanel, old files kept for reference |

---

## Contexto para Continuar

Para continuar en otra sesión, proporciona este contexto:

> "Continuando Phase 7.5: Shape Catalog & Polymorphic Objects para Line Optimizer.
>
> **Plan completo:** `docs/phases/phase-7.5-shape-catalog.md`
>
> **Estado actual:** Core + UI + Unified Properties COMPLETO
> - Shape catalog con 4 shapes básicos (rect, triangle, circle, diamond)
> - Click-to-place objetos genéricos
> - Convert to Process/Buffer via context menu (incluye production lines importadas)
> - Connections funcionan entre TODOS los nodos (nuevos + importados Excel)
> - **UnifiedPropertiesPanel**: Panel flotante único para Lines y Canvas Objects
> - **Canvas Object Compatibilities**: Asignar modelos a Process objects
> - **MiniMap dinámico**: Se desplaza cuando el panel está abierto
> - Link Process to ProductionLine modal
> - ShapeBrowserModal con búsqueda, favoritos, categorías
> - Keyboard shortcuts: V (Select), H (Pan), C (Connect), M (More shapes), Esc
>
> **Próximo:** Refinar UX del MiniMap, Import SVG para agregar shapes personalizados.
>
> **Archivos clave (nuevos 2026-02-03):**
> - `src/renderer/features/canvas/components/panels/UnifiedPropertiesPanel.tsx`
> - `src/renderer/features/canvas/hooks/useSelectionState.ts`
> - `src/renderer/features/canvas/store/useCanvasObjectCompatibilityStore.ts`
> - `src/main/database/repositories/SQLiteCanvasObjectCompatibilityRepository.ts`
> - `src/main/database/migrations/016_canvas_object_compatibilities.sql`
>
> **Archivos clave (existentes):**
> - `src/renderer/features/canvas/ProductionCanvas.tsx`
> - `src/renderer/features/canvas/components/toolbar/ObjectPalette.tsx`
> - `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`
> - `src/renderer/features/canvas/store/useCanvasObjectStore.ts`"
