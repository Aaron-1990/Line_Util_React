# Phase 11: Simulation Export Feature

**Date Created**: 2026-02-01
**Status**: 📋 Planned
**Developer**: Aaron Zapata
**IE Agent Validated**: ✅ Yes

---

## Table of Contents

1. [Overview](#overview)
2. [Business Value](#business-value)
3. [Export Formats](#export-formats)
4. [Data Enrichment Requirements](#data-enrichment-requirements)
5. [Database Schema Extensions](#database-schema-extensions)
6. [Canonical Data Model](#canonical-data-model)
7. [Architecture](#architecture)
8. [Implementation Phases](#implementation-phases)
9. [Practical Considerations](#practical-considerations)
10. [Files to Create](#files-to-create)
11. [Verification Checklist](#verification-checklist)

---

## Overview

Export DAG-based routing information to formats compatible with discrete event simulation (DES) tools. This bridges capacity planning with simulation, enabling:

- **Process Simulator** (ProModel) integration
- **Simio** integration via BPMN
- **Arena** (Rockwell) via custom format
- **Custom simulation tool** (future development)

### Key Concept

The DAG routing data already models process flows:

```
   SMT (start)
     │
     ▼
   ┌─────────────────┐
   │                 │
   ▼                 ▼
  ICT           Conformal  (parallel)
   │                 │
   └─────────────────┘
           │
           ▼
       Assembly (end)
```

Exporting this to Visio/BPMN creates a **single source of truth** for both capacity planning and simulation.

---

## Business Value

### ROI Analysis

| Activity | Manual Effort | With Export | Savings |
|----------|---------------|-------------|---------|
| Process mapping | 4-8 hours | 0 hours | 100% |
| Data collection | 8-16 hours | 2-4 hours | 75% |
| Model construction | 16-40 hours | 8-20 hours | 50% |
| **Total per study** | **28-64 hours** | **10-24 hours** | **60%** |

At engineering rates ($75-150/hr loaded), this represents **$1,350-$6,000 saved per simulation study**.

### Strategic Value

| Stakeholder | Benefit |
|-------------|---------|
| **Industrial Engineers** | Single source of truth; no manual Visio redrawing |
| **Simulation Analysts** | Pre-populated structure accelerates model building 40-60% |
| **Plant Managers** | Visual process documentation for reviews/audits |
| **Corporate Teams** | Standardized process visualization across plants |

---

## Export Formats

### Multi-Format Strategy

| Format | Priority | Use Case | Tool Compatibility |
|--------|----------|----------|-------------------|
| **JSON** | 1 (First) | API integration, custom tools | Universal |
| **BPMN 2.0 XML** | 1 (First) | Open standard interchange | Simio, Camunda, many others |
| **Visio (.vsdx)** | 2 (Later) | Process Simulator, presentations | ProModel, documentation |
| **Arena .doe** | 3 (Future) | Direct Arena import | Arena (Rockwell) |

### Why BPMN Before Visio

1. **Open standard** (OMG-maintained) - No vendor lock-in
2. **Text-based XML** - Easier to generate programmatically
3. **Extensible** - Custom attributes via extensions
4. **Wide tool support** - Simio, Signavio, Camunda

### Visio Format Complexity

The `.vsdx` format is a ZIP archive:

```
mydiagram.vsdx (ZIP)
├── [Content_Types].xml
├── _rels/
├── visio/
│   ├── document.xml
│   ├── pages/
│   │   ├── page1.xml      # Shape definitions
│   │   └── pages.xml
│   ├── masters/           # Stencil references
│   └── windows.xml
└── docProps/
```

**Recommendation**: Use template-based approach with pre-built Visio template.

---

## Data Enrichment Requirements

### Current State vs. Simulation Needs

| Data Category | Current State | Simulation Requirement | Priority |
|---------------|---------------|------------------------|----------|
| Process sequence | ✅ DAG structure | Sufficient | - |
| Cycle times | Point estimate | Distribution params (mean, std dev) | **High** |
| Setup/changeover | ✅ Matrix exists | Sequence-dependent logic | **High** |
| Yield | `expected_yield` field | Rework vs. scrap split | Medium |
| Resources | ❌ Not modeled | Operators, tools, fixtures | **High** |
| Reliability | ❌ Not modeled | MTBF/MTTR per equipment | **High** |
| Buffers | ❌ Not modeled | WIP limits per station | Medium |
| Shifts | `time_available_daily` | Detailed schedule patterns | Medium |
| Batch sizes | ❌ Not modeled | Transfer vs. process batch | Medium |

### Cycle Time Distribution Defaults

If measured variability is not available, use these defaults:

| Process Type | CV (Coefficient of Variation) | Example |
|--------------|------------------------------|---------|
| Automated (SMT, ICT) | 0.10 | `std_dev = cycle_time × 0.10` |
| Semi-automated | 0.15 | `std_dev = cycle_time × 0.15` |
| Manual assembly | 0.20-0.30 | `std_dev = cycle_time × 0.25` |

---

## Database Schema Extensions

### New Tables for Simulation Data

```sql
-- ============================================
-- Migration: 0XX_simulation_export.sql
-- Purpose: Data enrichment for simulation export
-- ============================================

-- Equipment reliability data
CREATE TABLE IF NOT EXISTS equipment_reliability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL,
  mtbf_hours DECIMAL(10,2),           -- Mean Time Between Failures
  mttr_hours DECIMAL(10,2),           -- Mean Time To Repair
  failure_distribution TEXT DEFAULT 'exponential',  -- exponential, weibull
  weibull_shape DECIMAL(5,2),         -- β parameter if weibull
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE
);

-- Resource requirements per area
CREATE TABLE IF NOT EXISTS area_resource_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_code TEXT NOT NULL,
  resource_type TEXT NOT NULL,        -- 'operator', 'fixture', 'tool', 'material_handler'
  resource_name TEXT,                 -- 'Soldering Operator', 'Test Fixture A'
  quantity_required INTEGER DEFAULT 1,
  skill_level TEXT,                   -- 'entry', 'skilled', 'expert'
  is_shared BOOLEAN DEFAULT FALSE,    -- Can be shared across lines?
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(area_code, resource_type, resource_name)
);

-- Buffer/WIP constraints between areas
CREATE TABLE IF NOT EXISTS inter_area_buffers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_area_code TEXT NOT NULL,
  to_area_code TEXT NOT NULL,
  buffer_capacity INTEGER,            -- Max WIP units
  transport_time_minutes DECIMAL(8,2),
  transport_type TEXT,                -- 'conveyor', 'agv', 'manual', 'none'
  fifo_enforced BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_area_code, to_area_code)
);

-- Shift patterns for availability modeling
CREATE TABLE IF NOT EXISTS shift_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_name TEXT UNIQUE NOT NULL,  -- 'Shift_3x8', 'Shift_2x10', 'Weekday_Only'
  pattern_json TEXT NOT NULL,         -- JSON array of time blocks
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link lines to shift patterns
ALTER TABLE production_lines ADD COLUMN shift_pattern_id INTEGER REFERENCES shift_patterns(id);
```

### Shift Pattern JSON Example

```json
[
  {"days": [1,2,3,4,5], "start": "06:00", "end": "14:00", "break_minutes": 30},
  {"days": [1,2,3,4,5], "start": "14:00", "end": "22:00", "break_minutes": 30},
  {"days": [1,2,3,4,5], "start": "22:00", "end": "06:00", "break_minutes": 30}
]
```

### Extend Existing Tables

```sql
-- Add distribution parameters to line_model_compatibilities
ALTER TABLE line_model_compatibilities ADD COLUMN cycle_time_std_dev DECIMAL(10,4);
ALTER TABLE line_model_compatibilities ADD COLUMN cycle_time_distribution TEXT DEFAULT 'normal';
-- Options: 'normal', 'lognormal', 'triangular', 'uniform', 'exponential'
ALTER TABLE line_model_compatibilities ADD COLUMN cycle_time_min DECIMAL(10,4);  -- For triangular/uniform
ALTER TABLE line_model_compatibilities ADD COLUMN cycle_time_max DECIMAL(10,4);  -- For triangular/uniform
```

---

## Canonical Data Model

### TypeScript Interfaces

```typescript
// src/shared/types/simulation-export.ts

export interface SimulationProcessFlow {
  metadata: {
    modelId: number;
    modelName: string;
    exportDate: string;
    schemaVersion: string;
    sourceSystem: 'LineOptimizer';
  };

  nodes: SimulationNode[];
  edges: SimulationEdge[];
  resources: SimulationResource[];
  schedules: ShiftSchedule[];
}

export interface SimulationNode {
  id: string;
  areaCode: string;
  areaName: string;
  nodeType: 'start' | 'process' | 'inspection' | 'transport' | 'storage' | 'end';

  // Geometry (for visual exports)
  position: { x: number; y: number };
  size: { width: number; height: number };

  // Timing
  timing: {
    cycleTime: DistributionSpec;
    setupTime?: DistributionSpec;
    minBufferTime?: number;  // Post-process wait (cure time, etc.)
  };

  // Capacity
  capacity: {
    numberOfUnits: number;      // Parallel machines/stations
    batchSize: number;          // 1 = continuous flow
    inputBufferCapacity?: number;
    outputBufferCapacity?: number;
  };

  // Reliability
  reliability?: {
    mtbfHours: number;
    mttrHours: number;
    failureDistribution: 'exponential' | 'weibull';
    weibullShape?: number;
  };

  // Quality
  quality: {
    expectedYield: number;      // 0.0 - 1.0
    reworkProbability?: number;
    scrapProbability?: number;
  };

  // Routing
  routing: {
    isRequired: boolean;
    volumeFraction: number;
  };

  // Resource requirements
  resourceRequirements: ResourceRequirement[];
}

export interface SimulationEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';

  transport?: {
    timeDistribution: DistributionSpec;
    mode: 'conveyor' | 'agv' | 'manual' | 'none';
    conveyorSpeed?: number;
  };
}

export interface DistributionSpec {
  type: 'constant' | 'normal' | 'lognormal' | 'triangular' | 'uniform' | 'exponential' | 'weibull';
  mean?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  mode?: number;   // For triangular
  shape?: number;  // For weibull β
  scale?: number;  // For weibull η
}

export interface ResourceRequirement {
  resourceType: 'operator' | 'fixture' | 'tool' | 'material_handler';
  resourcePoolId: string;
  quantity: number;
  acquireRule: 'seize' | 'share';  // Exclusive vs. shared
}

export interface SimulationResource {
  id: string;
  name: string;
  type: 'operator' | 'fixture' | 'tool' | 'material_handler';
  capacity: number;
  schedule?: string;  // Reference to ShiftSchedule
}

export interface ShiftSchedule {
  id: string;
  name: string;
  blocks: {
    daysOfWeek: number[];  // 0=Sun, 1=Mon, etc.
    startTime: string;     // 'HH:mm'
    endTime: string;
    breakMinutes: number;
  }[];
}

// Validation result
export interface ExportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

---

## Architecture

### File Structure

```
src/
├── main/
│   └── services/
│       └── export/
│           ├── ExportOrchestrator.ts        # Coordinates format selection
│           ├── RoutingDataCollector.ts      # Aggregates data from DB
│           ├── ExportValidator.ts           # Pre-export validation
│           ├── formats/
│           │   ├── BaseExporter.ts          # Abstract base class
│           │   ├── JsonExporter.ts          # Custom JSON schema
│           │   ├── BpmnExporter.ts          # BPMN 2.0 XML
│           │   ├── VisioExporter.ts         # .vsdx generation
│           │   └── ArenaExporter.ts         # Arena .doe (future)
│           ├── templates/
│           │   └── visio-simulation.vstx    # Visio template with stencils
│           └── schemas/
│               ├── simulation-export.schema.json
│               └── bpmn-extensions.xsd
├── shared/
│   └── types/
│       └── simulation-export.ts             # TypeScript interfaces
└── renderer/
    └── features/
        └── routings/
            └── components/
                └── ExportRoutingButton.tsx  # UI trigger
```

### Data Flow

```
┌─────────────────┐
│  SQLite DB      │
│  (Routing DAG)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RoutingData     │  ← Aggregates: model_area_routing, predecessors,
│ Collector       │    line_model_compatibilities, equipment_reliability
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Export          │  ← Validates completeness, warns on issues
│ Validator       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Canonical Model │  ← SimulationProcessFlow (TypeScript)
│ (ProcessFlow)   │
└────────┬────────┘
         │
    ┌────┴────┬─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│ JSON  │ │ BPMN  │ │ Visio │
│ .json │ │ .bpmn │ │ .vsdx │
└───────┘ └───────┘ └───────┘
```

### IPC Channels

```typescript
// src/shared/constants/index.ts

export const SIMULATION_EXPORT_CHANNELS = {
  EXPORT_JSON: 'simulation-export:json',
  EXPORT_BPMN: 'simulation-export:bpmn',
  EXPORT_VISIO: 'simulation-export:visio',
  VALIDATE: 'simulation-export:validate',
  GET_AVAILABLE_FORMATS: 'simulation-export:formats',
} as const;
```

---

## Implementation Phases

### Phase 11A: Foundation (1-2 weeks)

**Goal**: JSON export with basic validation

- [ ] Define `SimulationProcessFlow` TypeScript interfaces
- [ ] Create `RoutingDataCollector` service
- [ ] Implement `JsonExporter`
- [ ] Add `ExportValidator` with basic checks
- [ ] Add "Export Routing" button to Routings page
- [ ] IPC handlers for export
- [ ] File save dialog integration

**Deliverable**: Export any model's routing to `.json` file

### Phase 11B: BPMN Export (1 week)

**Goal**: Open standard format for simulation tools

- [ ] Implement `BpmnExporter` with custom extensions
- [ ] Handle DAG → BPMN gateway mapping for parallel paths
- [ ] Test import into Simio (if available)
- [ ] Document BPMN-to-tool attribute mapping

**Deliverable**: Export to BPMN 2.0 XML compatible with Simio

### Phase 11C: Data Enrichment UI (2 weeks)

**Goal**: Capture simulation-specific data

- [ ] Database migration for new tables
- [ ] Reliability data editor (MTBF/MTTR per line)
- [ ] Resource requirements editor (operators per area)
- [ ] Cycle time distribution parameters
- [ ] Shift pattern configuration
- [ ] Buffer capacity settings

**Deliverable**: UI to enter all simulation parameters

### Phase 11D: Visio Export (2-3 weeks)

**Goal**: Process Simulator compatible output

- [ ] Create Visio template with simulation stencils
- [ ] Implement `VisioExporter` using template injection
- [ ] Use `dagre` for automatic DAG layout
- [ ] Handle large diagrams (pagination if needed)
- [ ] Test with ProModel Process Simulator

**Deliverable**: Export to `.vsdx` with proper shape properties

### Phase 11E: Batch Export & Polish (1 week)

**Goal**: Production-ready feature

- [ ] Export all models at once
- [ ] Export format preferences in settings
- [ ] Progress indicator for large exports
- [ ] Error handling and user feedback
- [ ] Documentation for simulation analysts

---

## Practical Considerations

### Coordinate Systems

Visio uses EMUs (English Metric Units): **914400 EMUs = 1 inch**

```typescript
const EMUS_PER_INCH = 914400;
const toEmu = (inches: number) => Math.round(inches * EMUS_PER_INCH);

// Typical process shape: 1.5" wide × 0.75" tall
const PROCESS_SHAPE_WIDTH = toEmu(1.5);   // 1,371,600 EMUs
const PROCESS_SHAPE_HEIGHT = toEmu(0.75); // 685,800 EMUs
```

### Automatic DAG Layout

Use `dagre` library - do not manually compute coordinates:

```typescript
import dagre from 'dagre';

function layoutProcessFlow(nodes: SimulationNode[], edges: SimulationEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(n => g.setNode(n.id, { width: 150, height: 75 }));
  edges.forEach(e => g.setEdge(e.fromNodeId, e.toNodeId));

  dagre.layout(g);

  return nodes.map(n => ({
    ...n,
    position: g.node(n.id)  // { x, y }
  }));
}
```

### Shape IDs

Use deterministic IDs for debugging:

```typescript
// Good: Deterministic, debuggable
const shapeId = `${modelId}_${areaCode}_${sequence}`;

// Bad: Random UUIDs make debugging impossible
const shapeId = crypto.randomUUID();
```

### Process Simulator Shape Names

If targeting ProModel Process Simulator, use their expected shapes:

| Shape Name | Use For |
|------------|---------|
| `Activity` | Processing steps |
| `Decision` | Routing decisions (yield split) |
| `Start` | Entry point |
| `End` | Exit point |
| `Connector` | Flow arrows |

### Changeover Matrix Translation

Simulation tools handle changeover differently:

```typescript
// Line Optimizer: Matrix lookup
changeoverMatrix[fromModel][toModel] = 30; // minutes

// Simulation: Often needs attribute-dependent setup
// Arena: Use SEQUENCE data structure
// Simio: Use Add-On Process with lookup table

// Recommendation: Export matrix as separate lookup table
// with tool-specific import instructions
```

### Pre-Export Validation

```typescript
function validateForSimulation(flow: SimulationProcessFlow): ExportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have exactly one start node
  const startNodes = flow.nodes.filter(n => n.nodeType === 'start');
  if (startNodes.length !== 1) {
    errors.push(`Expected 1 start node, found ${startNodes.length}`);
  }

  // Cycle times should be reasonable (0.1 sec to 60 min)
  flow.nodes.forEach(node => {
    const ct = node.timing.cycleTime.mean;
    if (ct && (ct < 0.001 || ct > 60)) {
      warnings.push(`${node.areaCode}: Unusual cycle time ${ct} min`);
    }
  });

  // Yield should be 0.9-1.0 for most processes
  flow.nodes.forEach(node => {
    if (node.quality.expectedYield < 0.9) {
      warnings.push(`${node.areaCode}: Low yield ${(node.quality.expectedYield * 100).toFixed(1)}%`);
    }
  });

  // All nodes should be reachable (DAG validation)
  // ... (already implemented in routing store)

  return { valid: errors.length === 0, errors, warnings };
}
```

### Schema Versioning

Always include version for future compatibility:

```json
{
  "schemaVersion": "1.0.0",
  "metadata": {
    "modelId": 123,
    "modelName": "BEV2-2 Dual",
    "exportDate": "2026-02-01T10:30:00Z",
    "sourceSystem": "LineOptimizer"
  },
  "nodes": [...],
  "edges": [...]
}
```

---

## Files to Create

### Phase 11A (Foundation)

| File | Purpose |
|------|---------|
| `src/shared/types/simulation-export.ts` | TypeScript interfaces |
| `src/main/services/export/ExportOrchestrator.ts` | Coordinates exports |
| `src/main/services/export/RoutingDataCollector.ts` | Data aggregation |
| `src/main/services/export/ExportValidator.ts` | Pre-export validation |
| `src/main/services/export/formats/BaseExporter.ts` | Abstract base |
| `src/main/services/export/formats/JsonExporter.ts` | JSON format |
| `src/main/ipc/handlers/simulation-export.handler.ts` | IPC handlers |
| `src/renderer/features/routings/components/ExportRoutingButton.tsx` | UI trigger |

### Phase 11B (BPMN)

| File | Purpose |
|------|---------|
| `src/main/services/export/formats/BpmnExporter.ts` | BPMN 2.0 XML |
| `src/main/services/export/schemas/bpmn-extensions.xsd` | Custom extensions |

### Phase 11C (Data Enrichment)

| File | Purpose |
|------|---------|
| `src/main/database/migrations/0XX_simulation_export.sql` | Schema extensions |
| `src/main/database/repositories/SQLiteReliabilityRepository.ts` | Reliability CRUD |
| `src/main/database/repositories/SQLiteResourceRepository.ts` | Resources CRUD |
| `src/renderer/features/simulation/components/ReliabilityEditor.tsx` | MTBF/MTTR UI |
| `src/renderer/features/simulation/components/ResourceEditor.tsx` | Resources UI |
| `src/renderer/features/simulation/components/ShiftPatternEditor.tsx` | Schedules UI |

### Phase 11D (Visio)

| File | Purpose |
|------|---------|
| `src/main/services/export/formats/VisioExporter.ts` | .vsdx generation |
| `src/main/services/export/templates/visio-simulation.vstx` | Template file |

---

## Verification Checklist

### Phase 11A

- [ ] Export button appears in Routings page
- [ ] JSON file contains all routing data
- [ ] Validation catches missing start node
- [ ] Validation warns on unusual cycle times
- [ ] File save dialog works correctly

### Phase 11B

- [ ] BPMN file is valid XML
- [ ] Parallel paths use BPMN gateways correctly
- [ ] BPMN imports into Simio (if testable)

### Phase 11C

- [ ] Reliability editor saves MTBF/MTTR
- [ ] Resource requirements associate with areas
- [ ] Shift patterns can be created/edited
- [ ] Distribution parameters appear in export

### Phase 11D

- [ ] Visio file opens in Microsoft Visio
- [ ] Shapes have correct properties
- [ ] DAG layout is readable (no overlaps)
- [ ] File imports into Process Simulator

### Overall

- [ ] All export formats include schema version
- [ ] Large models (20+ areas) export correctly
- [ ] Export completes in < 5 seconds
- [ ] TypeScript: `npm run type-check` passes

---

## Dependencies

### NPM Packages (to install when implementing)

```bash
# Graph layout
npm install dagre @types/dagre

# BPMN generation (evaluate options)
npm install bpmn-moddle

# XML manipulation
npm install fast-xml-parser

# ZIP handling (for Visio)
npm install jszip
```

---

## References

- [BPMN 2.0 Specification](https://www.omg.org/spec/BPMN/2.0/)
- [Visio File Format (.vsdx)](https://docs.microsoft.com/en-us/office/client-developer/visio/introduction-to-the-visio-file-formatvsdx)
- [Process Simulator Documentation](https://www.promodel.com/products/process-simulator/)
- [dagre - Directed Graph Layout](https://github.com/dagrejs/dagre)
- [ISA-95 Standard](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa95) - Manufacturing data models
