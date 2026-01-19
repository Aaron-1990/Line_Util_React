# Multi-Sheet Excel Import Specification

## Metadata
- **Designed**: 2026-01-19
- **Designer**: Aaron Zapata
- **Project**: Line Optimizer
- **Framework**: Híbrido v2.0
- **Domain**: Manufacturing / Industrial Engineering
- **Agent**: `@fullstack-developer` (recommended) or `@backend-architect` → `@frontend-developer` (split)
- **Estimated Complexity**: Complex (12 bloques)
- **Timeline**: 2-3 semanas manual, 2-3 horas con Claude CLI
- **Dependencies**: Phase 3.1-3.3 (Single-Sheet Import) - COMPLETED ✅

---

## Context

### Project Overview

**Line Optimizer** is a desktop application designed to optimize production line utilization in electronics manufacturing at BorgWarner. It transforms manual Excel-based capacity planning workflows into an intuitive visual interface, helping executives make strategic decisions about equipment purchases, transfers between plants, and production reallocation.

**Current Stack**:
- **Frontend**: React 18, TypeScript, Tailwind CSS, ReactFlow
- **Backend**: Electron 28, Node.js v20
- **Database**: SQLite with Clean Architecture
- **State**: Zustand
- **Build**: Vite

### Current State

**Completed Phases**:
- ✅ Phase 1: Interactive canvas with drag & drop production lines
- ✅ Phase 2: Full CRUD for Production Lines
- ✅ Phase 3.1-3.3: Single-Sheet Excel Import (Lines only)

**Current Architecture**:
```sql
production_lines table:
  - name (TEXT PRIMARY KEY)
  - area (TEXT) → FK to area_catalog
  - time_available_daily (INTEGER) → seconds/day
  - x_position, y_position (REAL)
  - active (BOOLEAN)
```

**Single-Sheet Import Working**:
- Parse Excel file ✓
- Auto-detect columns ✓
- Validation with error reporting ✓
- Wizard UI: Select → Map → Validate → Import ✓
- 3 import modes: CREATE, UPDATE, MERGE ✓

### Business Problem

The Python optimization algorithm (`main_5.py`) requires **5 types of data** to calculate line utilization:

1. **Lines** - Line capacity (already importable ✅)
2. **Models** - Product models with annual volumes
3. **Compatibilities** - Line-model matrix with specific efficiency
4. **Volumes** - Integrated into Models (Annual Volume + Operations Days)
5. **Processes** - NOT required (algorithm assigns by individual line)

**Current Pain Point**: Loading data manually is slow and error-prone  
**Goal**: Import complete dataset from multi-sheet Excel in <5 minutes  
**Benefit**: Rapid analysis with real production data

### Architecture Decision: 3 Sheets (NOT 5)

```
production_data.xlsx

├─ 📋 Lines
│  Name        | Area      | Time Available Daily (sec)
│  Line SMT-1  | SMT       | 82800
│  Line ICT-1  | ICT       | 76212

├─ 📋 Models (INCLUDES VOLUMES)
│  Model Name  | Customer   | Program    | Family   | Annual Volume | Operations Days | Active
│  ECU-2024-A  | BorgWarner | EV Program | ECU 2024 | 50000         | 250             | TRUE
│  ECU-2024-B  | Tesla      | Hybrid     | ECU 2024 | 30000         | 300             | TRUE

└─ 📋 Compatibilities (INCLUDES EFFICIENCY & PRIORITY)
   Line Name  | Model Name  | Cycle Time (sec) | Efficiency (%) | Priority
   Line SMT-1 | ECU-2024-A  | 45               | 85             | 1
   Line SMT-1 | ECU-2024-B  | 50               | 82             | 2
   Line ICT-1 | ECU-2024-A  | 30               | 90             | 1
```

**Rationale**:
- ✅ Models includes volumes → Simplifies import, reduces sheets
- ✅ NO Processes table → Algorithm doesn't require sequential flow
- ✅ Efficiency in Compatibilities → OEE varies by line-model pair
- ✅ Priority in Compatibilities → Same model, different priority per line

### Python Algorithm Reference

```python
# For each line
for line in lines:
    remaining_time_daily = line.time_available_daily
    
    # Get compatible models ordered by priority
    compatibilities = get_compatibilities(line.name).sort_by_priority()
    
    for compat in compatibilities:
        model = get_model(compat.model_name)
        
        # Calculate daily demand
        daily_demand = model.annual_volume / model.operations_days
        # ECU-2024-A: 50,000 / 250 = 200 units/day
        
        # Real time per unit (with OEE)
        real_time_per_unit = compat.cycle_time / (compat.efficiency / 100)
        # 45 sec / 0.85 = 52.94 sec/unit
        
        # Assign up to capacity or demand
        units_can_produce_daily = remaining_time_daily / real_time_per_unit
        units_to_assign_daily = min(units_can_produce_daily, daily_demand)
        
        # Update remaining time
        time_used_daily = units_to_assign_daily * real_time_per_unit
        remaining_time_daily -= time_used_daily
    
    # Calculate utilization
    utilization = ((line.time_available_daily - remaining_time_daily) / 
                   line.time_available_daily) * 100
```

**Expected Output**: `Line SMT-1: 87% utilization`

---

## BLOQUE 0: Contracts & Architecture

### Architectural Principles

1. **Backward Compatible**: Single-sheet import continues working
2. **Contracts-First**: TypeScript interfaces before implementation
3. **Validation-Heavy**: Cross-sheet validation for referential integrity
4. **Incremental Import**: Sheet-by-sheet with rollback on error
5. **Clean Architecture**: Domain/Infrastructure/Presentation separation
6. **DRY**: Reuse existing ExcelImporter, ExcelValidator services

### Stack Decisions

**Backend**:
- Extend `ExcelImporter` service for multi-sheet detection
- Create `MultiSheetValidator` for cross-sheet validation
- New IPC handlers: `excel:parse-multi-sheet`, `excel:validate-multi-sheet`, `excel:import-multi-sheet`

**Database Schema**:

```sql
-- New table: product_models
CREATE TABLE product_models (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  customer TEXT NOT NULL,
  program TEXT NOT NULL,
  family TEXT NOT NULL,
  annual_volume INTEGER NOT NULL CHECK(annual_volume >= 0),
  operations_days INTEGER NOT NULL CHECK(operations_days > 0 AND operations_days <= 365),
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- New table: line_model_compatibilities
CREATE TABLE line_model_compatibilities (
  id TEXT PRIMARY KEY,
  line_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  cycle_time INTEGER NOT NULL CHECK(cycle_time > 0),
  efficiency INTEGER NOT NULL CHECK(efficiency > 0 AND efficiency <= 100),
  priority INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_name) REFERENCES production_lines(name) ON DELETE CASCADE,
  FOREIGN KEY (model_name) REFERENCES product_models(name) ON DELETE CASCADE,
  UNIQUE(line_name, model_name)
);

CREATE INDEX idx_compatibilities_line ON line_model_compatibilities(line_name);
CREATE INDEX idx_compatibilities_model ON line_model_compatibilities(model_name);
CREATE INDEX idx_compatibilities_priority ON line_model_compatibilities(line_name, priority);
```

**Frontend**:
- Extend `ImportWizard` with sheet selector step
- New component: `SheetSelector` (checkboxes for Lines, Models, Compatibilities)
- Extend `ColumnMapper` to handle multiple sheet mappings
- Extend `ValidationDisplay` to show per-sheet + cross-sheet errors

### TypeScript Interfaces

#### Shared Types (`src/shared/types/excel.ts`)

```typescript
// Multi-sheet column mappings
export interface ModelColumnMapping {
  modelName: string;
  customer: string;
  program: string;
  family: string;
  annualVolume: string;
  operationsDays: string;
  active: string;
}

export interface CompatibilityColumnMapping {
  lineName: string;
  modelName: string;
  cycleTime: string;
  efficiency: string;
  priority: string;
}

// Multi-sheet parsed data
export interface MultiSheetParsedData {
  lines?: {
    rows: unknown[];
    headers: string[];
    mapping: ColumnMapping; // Already exists
  };
  models?: {
    rows: unknown[];
    headers: string[];
    mapping: ModelColumnMapping;
  };
  compatibilities?: {
    rows: unknown[];
    headers: string[];
    mapping: CompatibilityColumnMapping;
  };
}

// Validated entities
export interface ValidatedModel {
  name: string;
  customer: string;
  program: string;
  family: string;
  annualVolume: number;
  operationsDays: number;
  active: boolean;
}

export interface ValidatedCompatibility {
  lineName: string;
  modelName: string;
  cycleTime: number;
  efficiency: number;
  priority: number;
}

// Multi-sheet validation result
export interface MultiSheetValidationResult {
  lines?: ValidationResult; // Already exists
  models?: {
    validModels: ValidatedModel[];
    errors: ValidationError[];
    stats: { total: number; valid: number; invalid: number };
  };
  compatibilities?: {
    validCompatibilities: ValidatedCompatibility[];
    errors: ValidationError[];
    stats: { total: number; valid: number; invalid: number };
  };
  crossSheetErrors: string[]; // e.g., "Model ECU-X referenced in Compatibilities not found in Models sheet"
}

// Multi-sheet import result
export interface MultiSheetImportResult {
  lines?: { created: number; updated: number; errors: number };
  models?: { created: number; updated: number; errors: number };
  compatibilities?: { created: number; updated: number; errors: number };
  totalTime: number; // milliseconds
}
```

#### Domain Entities (`src/domain/entities/`)

```typescript
// ProductModel.ts
export class ProductModel {
  constructor(
    public readonly id: string,
    public name: string,
    public customer: string,
    public program: string,
    public family: string,
    public annualVolume: number,
    public operationsDays: number,
    public active: boolean = true,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name) throw new Error('Model name is required');
    if (this.annualVolume < 0) throw new Error('Annual volume must be >= 0');
    if (this.operationsDays < 1 || this.operationsDays > 365) {
      throw new Error('Operations days must be between 1-365');
    }
  }

  calculateDailyDemand(): number {
    return this.annualVolume / this.operationsDays;
  }
}

// LineModelCompatibility.ts
export class LineModelCompatibility {
  constructor(
    public readonly id: string,
    public lineName: string,
    public modelName: string,
    public cycleTime: number,
    public efficiency: number,
    public priority: number = 1,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.lineName) throw new Error('Line name is required');
    if (!this.modelName) throw new Error('Model name is required');
    if (this.cycleTime <= 0) throw new Error('Cycle time must be > 0');
    if (this.efficiency <= 0 || this.efficiency > 100) {
      throw new Error('Efficiency must be between 0-100');
    }
    if (this.priority < 1) throw new Error('Priority must be >= 1');
  }

  calculateRealTimePerUnit(): number {
    return this.cycleTime / (this.efficiency / 100);
  }
}
```

#### Repository Interfaces (`src/domain/repositories/`)

```typescript
// IProductModelRepository.ts
export interface IProductModelRepository {
  create(model: ProductModel): Promise<void>;
  update(name: string, model: Partial<ProductModel>): Promise<void>;
  findByName(name: string): Promise<ProductModel | null>;
  findAll(): Promise<ProductModel[]>;
  delete(name: string): Promise<void>;
  batchCreate(models: ProductModel[]): Promise<void>;
}

// ICompatibilityRepository.ts
export interface ICompatibilityRepository {
  create(compatibility: LineModelCompatibility): Promise<void>;
  update(id: string, compatibility: Partial<LineModelCompatibility>): Promise<void>;
  findByLineAndModel(lineName: string, modelName: string): Promise<LineModelCompatibility | null>;
  findByLine(lineName: string): Promise<LineModelCompatibility[]>;
  findByModel(modelName: string): Promise<LineModelCompatibility[]>;
  delete(id: string): Promise<void>;
  batchCreate(compatibilities: LineModelCompatibility[]): Promise<void>;
}
```

### IPC Channels (`src/shared/constants/ipc-channels.ts`)

```typescript
export const IPC_CHANNELS = {
  // ... existing channels
  
  // Multi-sheet Excel
  EXCEL_PARSE_MULTI_SHEET: 'excel:parse-multi-sheet',
  EXCEL_VALIDATE_MULTI_SHEET: 'excel:validate-multi-sheet',
  EXCEL_IMPORT_MULTI_SHEET: 'excel:import-multi-sheet',
  
  // Models
  MODELS_CREATE: 'models:create',
  MODELS_UPDATE: 'models:update',
  MODELS_GET_ALL: 'models:get-all',
  MODELS_DELETE: 'models:delete',
  
  // Compatibilities
  COMPAT_CREATE: 'compatibilities:create',
  COMPAT_GET_BY_LINE: 'compatibilities:get-by-line',
  COMPAT_GET_BY_MODEL: 'compatibilities:get-by-model',
  COMPAT_DELETE: 'compatibilities:delete',
} as const;
```

---

## BLOQUE 1: Database Migration

**Objective**: Create tables for Models and Compatibilities with proper constraints and indexes

**File**: `src/main/database/migrations/002_models_and_compatibilities.sql`

```sql
-- Product Models Table
CREATE TABLE IF NOT EXISTS product_models (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  customer TEXT NOT NULL,
  program TEXT NOT NULL,
  family TEXT NOT NULL,
  annual_volume INTEGER NOT NULL CHECK(annual_volume >= 0),
  operations_days INTEGER NOT NULL CHECK(operations_days > 0 AND operations_days <= 365),
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_models_name ON product_models(name);
CREATE INDEX idx_product_models_family ON product_models(family);
CREATE INDEX idx_product_models_active ON product_models(active);

-- Line-Model Compatibilities Table
CREATE TABLE IF NOT EXISTS line_model_compatibilities (
  id TEXT PRIMARY KEY,
  line_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  cycle_time INTEGER NOT NULL CHECK(cycle_time > 0),
  efficiency INTEGER NOT NULL CHECK(efficiency > 0 AND efficiency <= 100),
  priority INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_name) REFERENCES production_lines(name) ON DELETE CASCADE,
  FOREIGN KEY (model_name) REFERENCES product_models(name) ON DELETE CASCADE,
  UNIQUE(line_name, model_name)
);

CREATE INDEX idx_compatibilities_line ON line_model_compatibilities(line_name);
CREATE INDEX idx_compatibilities_model ON line_model_compatibilities(model_name);
CREATE INDEX idx_compatibilities_priority ON line_model_compatibilities(line_name, priority);

-- Triggers for timestamp updates
CREATE TRIGGER IF NOT EXISTS update_product_models_timestamp
AFTER UPDATE ON product_models
BEGIN
  UPDATE product_models SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_compatibilities_timestamp
AFTER UPDATE ON line_model_compatibilities
BEGIN
  UPDATE line_model_compatibilities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

**CHECKPOINT (30 sec)**:
```bash
# 1. Remove existing DB
rm -f ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db*

# 2. Restart app (applies migration)
npm start

# 3. Verify tables created
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT name FROM sqlite_master WHERE type='table';"
# Expected: product_models, line_model_compatibilities visible
```

**Success Criteria**:
- [ ] Migration 002 applied without errors
- [ ] Tables product_models and line_model_compatibilities exist
- [ ] Indexes created successfully
- [ ] Foreign keys working (test with INSERT)

---

## BLOQUE 2: Domain Entities & Repositories

**Objective**: Create domain entities (ProductModel, LineModelCompatibility) and repository implementations

**Files to create**:
1. `src/domain/entities/ProductModel.ts` (see interface above)
2. `src/domain/entities/LineModelCompatibility.ts` (see interface above)
3. `src/domain/repositories/IProductModelRepository.ts` (see interface above)
4. `src/domain/repositories/ICompatibilityRepository.ts` (see interface above)
5. `src/infrastructure/repositories/SQLiteProductModelRepository.ts`
6. `src/infrastructure/repositories/SQLiteCompatibilityRepository.ts`

**Implementation Notes**:
- Entities: Validation in constructor, business logic methods (calculateDailyDemand, calculateRealTimePerUnit)
- Repositories: Use prepared statements, implement batch operations for performance
- Handle UNIQUE constraint violations gracefully in UPDATE mode

**CHECKPOINT (30 sec)**:
```bash
npm run type-check
# Expected: No TypeScript errors
```

**Success Criteria**:
- [ ] Entities have validation in constructor
- [ ] Business logic methods implemented (calculateDailyDemand, calculateRealTimePerUnit)
- [ ] Repository interfaces complete (CRUD + batch operations)
- [ ] SQLite implementations use prepared statements
- [ ] Type-check passes

---

## BLOQUE 3: Multi-Sheet Parser

**Objective**: Extend ExcelImporter to detect and parse multiple sheets

**File**: `src/main/services/excel/MultiSheetImporter.ts`

```typescript
import * as XLSX from 'xlsx';
import { MultiSheetParsedData, ModelColumnMapping, CompatibilityColumnMapping } from '@shared/types/excel';
import { ExcelImporter } from './ExcelImporter';

export class MultiSheetImporter {
  /**
   * Parse multi-sheet Excel file
   * Detects available sheets: Lines, Models, Compatibilities
   */
  static parseFile(filePath: string): MultiSheetParsedData {
    const workbook = XLSX.readFile(filePath);
    const result: MultiSheetParsedData = {};
    
    // Detect available sheets (case-insensitive)
    const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
    
    // Parse Lines sheet (if exists)
    const linesSheetName = workbook.SheetNames.find(s => 
      s.toLowerCase().includes('line')
    );
    if (linesSheetName) {
      const data = ExcelImporter.parseSheet(workbook, linesSheetName);
      result.lines = {
        rows: data.rows,
        headers: data.headers,
        mapping: ExcelImporter.detectColumns(data.headers)!
      };
    }
    
    // Parse Models sheet (if exists)
    const modelsSheetName = workbook.SheetNames.find(s => 
      s.toLowerCase().includes('model')
    );
    if (modelsSheetName) {
      const data = ExcelImporter.parseSheet(workbook, modelsSheetName);
      const mapping = this.detectModelColumns(data.headers);
      if (mapping) {
        result.models = {
          rows: data.rows,
          headers: data.headers,
          mapping
        };
      }
    }
    
    // Parse Compatibilities sheet (if exists)
    const compatSheetName = workbook.SheetNames.find(s => 
      s.toLowerCase().includes('compat')
    );
    if (compatSheetName) {
      const data = ExcelImporter.parseSheet(workbook, compatSheetName);
      const mapping = this.detectCompatibilityColumns(data.headers);
      if (mapping) {
        result.compatibilities = {
          rows: data.rows,
          headers: data.headers,
          mapping
        };
      }
    }
    
    return result;
  }
  
  /**
   * Auto-detect column mapping for Models sheet
   */
  static detectModelColumns(headers: string[]): ModelColumnMapping | null {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    const modelName = headers.find((_, i) => 
      lowerHeaders[i].includes('model') && lowerHeaders[i].includes('name')
    );
    const customer = headers.find((_, i) => 
      lowerHeaders[i].includes('customer')
    );
    const program = headers.find((_, i) => 
      lowerHeaders[i].includes('program')
    );
    const family = headers.find((_, i) => 
      lowerHeaders[i].includes('family')
    );
    const annualVolume = headers.find((_, i) => 
      lowerHeaders[i].includes('annual') && lowerHeaders[i].includes('volume')
    );
    const operationsDays = headers.find((_, i) => 
      lowerHeaders[i].includes('operations') && lowerHeaders[i].includes('days')
    );
    const active = headers.find((_, i) => 
      lowerHeaders[i].includes('active')
    );
    
    if (!modelName || !customer || !program || !family || !annualVolume || !operationsDays) {
      return null;
    }
    
    return {
      modelName,
      customer,
      program,
      family,
      annualVolume,
      operationsDays,
      active: active || '' // Optional
    };
  }
  
  /**
   * Auto-detect column mapping for Compatibilities sheet
   */
  static detectCompatibilityColumns(headers: string[]): CompatibilityColumnMapping | null {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    const lineName = headers.find((_, i) => 
      lowerHeaders[i].includes('line') && lowerHeaders[i].includes('name')
    );
    const modelName = headers.find((_, i) => 
      lowerHeaders[i].includes('model') && lowerHeaders[i].includes('name')
    );
    const cycleTime = headers.find((_, i) => 
      lowerHeaders[i].includes('cycle') && lowerHeaders[i].includes('time')
    );
    const efficiency = headers.find((_, i) => 
      lowerHeaders[i].includes('efficiency')
    );
    const priority = headers.find((_, i) => 
      lowerHeaders[i].includes('priority')
    );
    
    if (!lineName || !modelName || !cycleTime || !efficiency) {
      return null;
    }
    
    return {
      lineName,
      modelName,
      cycleTime,
      efficiency,
      priority: priority || '' // Optional, defaults to 1
    };
  }
}
```

**CHECKPOINT (30 sec)**:
```bash
# Create test fixture
# tests/fixtures/multi-sheet-test.xlsx with 3 sheets

# Test parsing in handler (console.log result)
npm start
# Upload fixture, verify parsed data structure in console
```

**Success Criteria**:
- [ ] Detects sheets correctly (case-insensitive)
- [ ] Parses each sheet independently
- [ ] Auto-detects columns for Models and Compatibilities
- [ ] Returns complete MultiSheetParsedData structure

---

## BLOQUE 4: Cross-Sheet Validator

**Objective**: Validate relationships between sheets (e.g., Model in Compatibilities must exist in Models)

**File**: `src/main/services/excel/MultiSheetValidator.ts`

```typescript
import { 
  MultiSheetParsedData, 
  MultiSheetValidationResult,
  ValidatedModel,
  ValidatedCompatibility,
  ValidationError
} from '@shared/types/excel';
import { ExcelValidator } from './ExcelValidator';
import { ProductModel } from '@domain/entities/ProductModel';
import { LineModelCompatibility } from '@domain/entities/LineModelCompatibility';

export class MultiSheetValidator {
  /**
   * Validate multi-sheet data with cross-sheet validation
   */
  static async validateMultiSheet(
    data: MultiSheetParsedData,
    existingLines: string[] // From DB
  ): Promise<MultiSheetValidationResult> {
    const result: MultiSheetValidationResult = {
      crossSheetErrors: []
    };
    
    // 1. Validate each sheet individually
    if (data.lines) {
      result.lines = ExcelValidator.validateBatch(
        data.lines.rows,
        data.lines.mapping
      );
    }
    
    if (data.models) {
      result.models = this.validateModels(data.models.rows, data.models.mapping);
    }
    
    if (data.compatibilities) {
      result.compatibilities = this.validateCompatibilities(
        data.compatibilities.rows,
        data.compatibilities.mapping
      );
    }
    
    // 2. Cross-sheet validation
    if (data.compatibilities && data.models) {
      this.validateCompatibilityModelReferences(
        result.compatibilities!.validCompatibilities,
        result.models!.validModels,
        result.crossSheetErrors
      );
    }
    
    if (data.compatibilities) {
      const allLines = [
        ...existingLines,
        ...(result.lines?.validLines.map(l => l.name) || [])
      ];
      this.validateCompatibilityLineReferences(
        result.compatibilities!.validCompatibilities,
        allLines,
        result.crossSheetErrors
      );
    }
    
    return result;
  }
  
  /**
   * Validate Models sheet
   */
  private static validateModels(
    rows: unknown[],
    mapping: ModelColumnMapping
  ): {
    validModels: ValidatedModel[];
    errors: ValidationError[];
    stats: { total: number; valid: number; invalid: number };
  } {
    const validModels: ValidatedModel[] = [];
    const errors: ValidationError[] = [];
    const seenNames = new Set<string>();
    
    rows.forEach((row: any, index) => {
      try {
        // Extract values
        const name = row[mapping.modelName]?.toString().trim();
        const customer = row[mapping.customer]?.toString().trim();
        const program = row[mapping.program]?.toString().trim();
        const family = row[mapping.family]?.toString().trim();
        const annualVolume = parseInt(row[mapping.annualVolume]);
        const operationsDays = parseInt(row[mapping.operationsDays]);
        const active = mapping.active ? 
          row[mapping.active]?.toString().toLowerCase() === 'true' : 
          true;
        
        // Check duplicates
        if (seenNames.has(name)) {
          errors.push({
            row: index + 2,
            field: 'Model Name',
            message: `Duplicate model name '${name}'`
          });
          return;
        }
        seenNames.add(name);
        
        // Validate using entity
        const model = new ProductModel(
          crypto.randomUUID(),
          name,
          customer,
          program,
          family,
          annualVolume,
          operationsDays,
          active
        );
        
        validModels.push({
          name: model.name,
          customer: model.customer,
          program: model.program,
          family: model.family,
          annualVolume: model.annualVolume,
          operationsDays: model.operationsDays,
          active: model.active
        });
        
      } catch (error: any) {
        errors.push({
          row: index + 2,
          field: 'Multiple',
          message: error.message
        });
      }
    });
    
    return {
      validModels,
      errors,
      stats: {
        total: rows.length,
        valid: validModels.length,
        invalid: errors.length
      }
    };
  }
  
  /**
   * Validate Compatibilities sheet
   */
  private static validateCompatibilities(
    rows: unknown[],
    mapping: CompatibilityColumnMapping
  ): {
    validCompatibilities: ValidatedCompatibility[];
    errors: ValidationError[];
    stats: { total: number; valid: number; invalid: number };
  } {
    const validCompatibilities: ValidatedCompatibility[] = [];
    const errors: ValidationError[] = [];
    const seenPairs = new Set<string>();
    
    rows.forEach((row: any, index) => {
      try {
        const lineName = row[mapping.lineName]?.toString().trim();
        const modelName = row[mapping.modelName]?.toString().trim();
        const cycleTime = parseInt(row[mapping.cycleTime]);
        const efficiency = parseInt(row[mapping.efficiency]);
        const priority = mapping.priority ? 
          parseInt(row[mapping.priority]) : 
          1;
        
        // Check duplicates
        const pairKey = `${lineName}|${modelName}`;
        if (seenPairs.has(pairKey)) {
          errors.push({
            row: index + 2,
            field: 'Line-Model Pair',
            message: `Duplicate compatibility for line '${lineName}' and model '${modelName}'`
          });
          return;
        }
        seenPairs.add(pairKey);
        
        // Validate using entity
        const compat = new LineModelCompatibility(
          crypto.randomUUID(),
          lineName,
          modelName,
          cycleTime,
          efficiency,
          priority
        );
        
        validCompatibilities.push({
          lineName: compat.lineName,
          modelName: compat.modelName,
          cycleTime: compat.cycleTime,
          efficiency: compat.efficiency,
          priority: compat.priority
        });
        
      } catch (error: any) {
        errors.push({
          row: index + 2,
          field: 'Multiple',
          message: error.message
        });
      }
    });
    
    return {
      validCompatibilities,
      errors,
      stats: {
        total: rows.length,
        valid: validCompatibilities.length,
        invalid: errors.length
      }
    };
  }
  
  /**
   * Validate Compatibility references to Models
   */
  private static validateCompatibilityModelReferences(
    compatibilities: ValidatedCompatibility[],
    models: ValidatedModel[],
    errors: string[]
  ): void {
    const modelNames = new Set(models.map(m => m.name));
    
    compatibilities.forEach(compat => {
      if (!modelNames.has(compat.modelName)) {
        errors.push(
          `Compatibility references model "${compat.modelName}" which doesn't exist in Models sheet`
        );
      }
    });
  }
  
  /**
   * Validate Compatibility references to Lines
   */
  private static validateCompatibilityLineReferences(
    compatibilities: ValidatedCompatibility[],
    allLines: string[],
    errors: string[]
  ): void {
    const lineNames = new Set(allLines);
    
    compatibilities.forEach(compat => {
      if (!lineNames.has(compat.lineName)) {
        errors.push(
          `Compatibility references line "${compat.lineName}" which doesn't exist in Lines sheet or database`
        );
      }
    });
  }
}
```

**CHECKPOINT (30 sec)**:
```bash
# Test with fixture that has invalid references
# Verify cross-sheet errors detected
npm test -- multi-sheet-validator.test.ts
```

**Success Criteria**:
- [ ] Validates each sheet independently
- [ ] Detects invalid references between sheets
- [ ] Returns clear, actionable errors
- [ ] Performance: <500ms for 1,000 rows total

---

## BLOQUE 5: IPC Handlers for Multi-Sheet

**Objective**: Create IPC handlers for parse, validate, and import operations

**File**: `src/main/ipc/handlers/multi-sheet-excel.handler.ts`

```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { ApiResponse } from '@shared/types/api';
import { 
  MultiSheetParsedData,
  MultiSheetValidationResult,
  MultiSheetImportResult
} from '@shared/types/excel';
import { MultiSheetImporter } from '@services/excel/MultiSheetImporter';
import { MultiSheetValidator } from '@services/excel/MultiSheetValidator';
import { getDatabase } from '@database/connection';
import { SQLiteProductModelRepository } from '@repositories/SQLiteProductModelRepository';
import { SQLiteCompatibilityRepository } from '@repositories/SQLiteCompatibilityRepository';
import { SQLiteProductionLineRepository } from '@repositories/SQLiteProductionLineRepository';

export function registerMultiSheetExcelHandlers(): void {
  
  // Parse multi-sheet Excel file
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_PARSE_MULTI_SHEET,
    async (_event, filePath: string): Promise<ApiResponse<MultiSheetParsedData>> => {
      try {
        const data = MultiSheetImporter.parseFile(filePath);
        
        return {
          success: true,
          data
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to parse Excel file: ${error.message}`
        };
      }
    }
  );
  
  // Validate multi-sheet data
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_VALIDATE_MULTI_SHEET,
    async (_event, data: MultiSheetParsedData): Promise<ApiResponse<MultiSheetValidationResult>> => {
      try {
        const db = getDatabase();
        const lineRepo = new SQLiteProductionLineRepository(db);
        
        // Get existing lines from DB
        const existingLines = await lineRepo.findAll();
        const existingLineNames = existingLines.map(l => l.name);
        
        const validationResult = await MultiSheetValidator.validateMultiSheet(
          data,
          existingLineNames
        );
        
        return {
          success: true,
          data: validationResult
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Validation failed: ${error.message}`
        };
      }
    }
  );
  
  // Import multi-sheet data (transactional)
  ipcMain.handle(
    IPC_CHANNELS.EXCEL_IMPORT_MULTI_SHEET,
    async (_event, validationResult: MultiSheetValidationResult): Promise<ApiResponse<MultiSheetImportResult>> => {
      const db = getDatabase();
      const startTime = Date.now();
      
      try {
        // Start transaction
        db.prepare('BEGIN TRANSACTION').run();
        
        const result: MultiSheetImportResult = {
          totalTime: 0
        };
        
        // 1. Import Lines (if present)
        if (validationResult.lines) {
          const lineRepo = new SQLiteProductionLineRepository(db);
          let created = 0;
          let updated = 0;
          
          for (const line of validationResult.lines.validLines) {
            const existing = await lineRepo.findByName(line.name);
            if (existing) {
              await lineRepo.update(line.name, line);
              updated++;
            } else {
              await lineRepo.create(line);
              created++;
            }
          }
          
          result.lines = { created, updated, errors: 0 };
        }
        
        // 2. Import Models (if present)
        if (validationResult.models) {
          const modelRepo = new SQLiteProductModelRepository(db);
          let created = 0;
          let updated = 0;
          
          for (const model of validationResult.models.validModels) {
            const existing = await modelRepo.findByName(model.name);
            if (existing) {
              await modelRepo.update(model.name, model);
              updated++;
            } else {
              const entity = new ProductModel(
                crypto.randomUUID(),
                model.name,
                model.customer,
                model.program,
                model.family,
                model.annualVolume,
                model.operationsDays,
                model.active
              );
              await modelRepo.create(entity);
              created++;
            }
          }
          
          result.models = { created, updated, errors: 0 };
        }
        
        // 3. Import Compatibilities (if present)
        if (validationResult.compatibilities) {
          const compatRepo = new SQLiteCompatibilityRepository(db);
          let created = 0;
          let updated = 0;
          
          for (const compat of validationResult.compatibilities.validCompatibilities) {
            const existing = await compatRepo.findByLineAndModel(
              compat.lineName,
              compat.modelName
            );
            if (existing) {
              await compatRepo.update(existing.id, compat);
              updated++;
            } else {
              const entity = new LineModelCompatibility(
                crypto.randomUUID(),
                compat.lineName,
                compat.modelName,
                compat.cycleTime,
                compat.efficiency,
                compat.priority
              );
              await compatRepo.create(entity);
              created++;
            }
          }
          
          result.compatibilities = { created, updated, errors: 0 };
        }
        
        // Commit transaction
        db.prepare('COMMIT').run();
        
        result.totalTime = Date.now() - startTime;
        
        return {
          success: true,
          data: result
        };
        
      } catch (error: any) {
        // Rollback on error
        db.prepare('ROLLBACK').run();
        
        return {
          success: false,
          error: `Import failed: ${error.message}`
        };
      }
    }
  );
}
```

**CHECKPOINT (30 sec)**:
```bash
# Test from Renderer
window.electronAPI.invoke('excel:parse-multi-sheet', '/path/to/file.xlsx')
  .then(console.log);
```

**Success Criteria**:
- [ ] Handlers registered correctly
- [ ] Parse returns MultiSheetParsedData
- [ ] Validate returns MultiSheetValidationResult
- [ ] Import is transactional (rollback on error)

---

## BLOQUE 6: UI - Sheet Selector Component

**Objective**: Component to select which sheets to import

**File**: `src/renderer/features/excel/components/SheetSelector.tsx`

```tsx
import React, { useState } from 'react';

interface SheetSelectorProps {
  availableSheets: {
    lines?: { rowCount: number };
    models?: { rowCount: number };
    compatibilities?: { rowCount: number };
  };
  onSheetsSelected: (selectedSheets: Set<string>) => void;
}

export const SheetSelector: React.FC<SheetSelectorProps> = ({ 
  availableSheets, 
  onSheetsSelected 
}) => {
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  
  const toggleSheet = (sheetName: string) => {
    const newSelection = new Set(selectedSheets);
    if (newSelection.has(sheetName)) {
      newSelection.delete(sheetName);
    } else {
      newSelection.add(sheetName);
    }
    setSelectedSheets(newSelection);
  };
  
  const handleContinue = () => {
    onSheetsSelected(selectedSheets);
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Select Sheets to Import</h3>
      
      <div className="space-y-3 mb-6">
        {availableSheets.lines && (
          <label className="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              checked={selectedSheets.has('Lines')}
              onChange={() => toggleSheet('Lines')}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium">Production Lines</span>
              <span className="text-gray-500 text-sm ml-2">
                ({availableSheets.lines.rowCount} rows)
              </span>
            </div>
          </label>
        )}
        
        {availableSheets.models && (
          <label className="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              checked={selectedSheets.has('Models')}
              onChange={() => toggleSheet('Models')}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium">Product Models</span>
              <span className="text-gray-500 text-sm ml-2">
                ({availableSheets.models.rowCount} rows)
              </span>
            </div>
          </label>
        )}
        
        {availableSheets.compatibilities && (
          <label className="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              checked={selectedSheets.has('Compatibilities')}
              onChange={() => toggleSheet('Compatibilities')}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium">Line-Model Compatibilities</span>
              <span className="text-gray-500 text-sm ml-2">
                ({availableSheets.compatibilities.rowCount} rows)
              </span>
            </div>
          </label>
        )}
      </div>
      
      <button 
        onClick={handleContinue}
        disabled={selectedSheets.size === 0}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Continue ({selectedSheets.size} sheet{selectedSheets.size !== 1 ? 's' : ''} selected)
      </button>
    </div>
  );
};
```

**CHECKPOINT (30 sec)**:
```bash
npm start
# Navigate to Import Wizard
# Verify SheetSelector renders
```

**Success Criteria**:
- [ ] Shows available sheets dynamically
- [ ] Checkboxes work correctly
- [ ] Displays row count per sheet
- [ ] Continue button active only if ≥1 sheet selected

---

## BLOQUE 7: Extend Import Wizard

**Objective**: Integrate multi-sheet flow into existing wizard

**File**: `src/renderer/features/excel/components/ImportWizard.tsx`

**New Flow**:
```
1. Select File
   ↓
2. Detect Sheets → SheetSelector (NEW - only if multi-sheet)
   ↓
3. Map Columns (for each selected sheet)
   ↓
4. Validate Data (multi-sheet validation)
   ↓
5. Import
```

**Key Changes**:
- Add step for SheetSelector (only appears if >1 sheet detected)
- Handle multiple column mappings (one per sheet)
- Pass all sheets to validation handler
- Display multi-sheet validation results

**CHECKPOINT (30 sec)**:
```bash
npm start
# Test complete flow with multi-sheet fixture
# Verify all steps work
```

**Success Criteria**:
- [ ] Wizard auto-detects single vs multi-sheet
- [ ] SheetSelector appears only if >1 sheet available
- [ ] ColumnMapper handles multiple mappings
- [ ] ValidationDisplay shows per-sheet + cross-sheet errors

---

## BLOQUE 8: Validation Display Enhancement

**Objective**: Show multi-sheet validation with sections per sheet

**File**: `src/renderer/features/excel/components/ValidationDisplay.tsx`

```tsx
interface ValidationDisplayProps {
  validationResult: MultiSheetValidationResult;
}

export const ValidationDisplay: React.FC<ValidationDisplayProps> = ({ 
  validationResult 
}) => {
  const hasErrors = 
    (validationResult.lines?.stats.invalid || 0) > 0 ||
    (validationResult.models?.stats.invalid || 0) > 0 ||
    (validationResult.compatibilities?.stats.invalid || 0) > 0 ||
    validationResult.crossSheetErrors.length > 0;
  
  return (
    <div className="space-y-4">
      {/* Lines Sheet */}
      {validationResult.lines && (
        <section className="border rounded p-4">
          <h3 className="font-semibold mb-2">Production Lines</h3>
          <div className="flex gap-4 text-sm mb-2">
            <span className="text-green-600">
              Valid: {validationResult.lines.stats.valid}
            </span>
            <span className="text-red-600">
              Invalid: {validationResult.lines.stats.invalid}
            </span>
          </div>
          {validationResult.lines.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {validationResult.lines.errors.map((error, i) => (
                <div key={i} className="text-sm text-red-600">
                  Row {error.row}: {error.message}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      
      {/* Models Sheet */}
      {validationResult.models && (
        <section className="border rounded p-4">
          <h3 className="font-semibold mb-2">Product Models</h3>
          <div className="flex gap-4 text-sm mb-2">
            <span className="text-green-600">
              Valid: {validationResult.models.stats.valid}
            </span>
            <span className="text-red-600">
              Invalid: {validationResult.models.stats.invalid}
            </span>
          </div>
          {validationResult.models.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {validationResult.models.errors.map((error, i) => (
                <div key={i} className="text-sm text-red-600">
                  Row {error.row}: {error.message}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      
      {/* Compatibilities Sheet */}
      {validationResult.compatibilities && (
        <section className="border rounded p-4">
          <h3 className="font-semibold mb-2">Line-Model Compatibilities</h3>
          <div className="flex gap-4 text-sm mb-2">
            <span className="text-green-600">
              Valid: {validationResult.compatibilities.stats.valid}
            </span>
            <span className="text-red-600">
              Invalid: {validationResult.compatibilities.stats.invalid}
            </span>
          </div>
          {validationResult.compatibilities.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {validationResult.compatibilities.errors.map((error, i) => (
                <div key={i} className="text-sm text-red-600">
                  Row {error.row}: {error.message}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      
      {/* Cross-Sheet Errors */}
      {validationResult.crossSheetErrors.length > 0 && (
        <section className="border-2 border-red-500 rounded p-4 bg-red-50">
          <h3 className="font-semibold mb-2 text-red-700">
            Cross-Sheet Validation Errors
          </h3>
          <div className="space-y-1">
            {validationResult.crossSheetErrors.map((error, i) => (
              <div key={i} className="text-sm text-red-700">
                {error}
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* Summary */}
      <div className="mt-4 p-4 bg-gray-50 rounded">
        {hasErrors ? (
          <p className="text-red-600 font-medium">
            ⚠ Please fix errors before importing
          </p>
        ) : (
          <p className="text-green-600 font-medium">
            ✓ All data validated successfully
          </p>
        )}
      </div>
    </div>
  );
};
```

**Success Criteria**:
- [ ] Shows validation per sheet
- [ ] Highlights cross-sheet errors prominently
- [ ] Import button disabled if cross-sheet errors exist

---

## BLOQUE 9: Progress Tracker Enhancement

**Objective**: Show progress per sheet during import

**File**: `src/renderer/features/excel/components/ProgressTracker.tsx`

```tsx
interface ProgressTrackerProps {
  result: MultiSheetImportResult | null;
  isImporting: boolean;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ 
  result, 
  isImporting 
}) => {
  if (isImporting) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Importing data...</span>
      </div>
    );
  }
  
  if (!result) return null;
  
  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-4">
      <h3 className="text-lg font-semibold">Import Complete</h3>
      
      {result.lines && (
        <div className="border-l-4 border-blue-500 pl-4">
          <p className="font-medium">Production Lines</p>
          <p className="text-sm text-gray-600">
            {result.lines.created} created, {result.lines.updated} updated
          </p>
        </div>
      )}
      
      {result.models && (
        <div className="border-l-4 border-green-500 pl-4">
          <p className="font-medium">Product Models</p>
          <p className="text-sm text-gray-600">
            {result.models.created} created, {result.models.updated} updated
          </p>
        </div>
      )}
      
      {result.compatibilities && (
        <div className="border-l-4 border-purple-500 pl-4">
          <p className="font-medium">Compatibilities</p>
          <p className="text-sm text-gray-600">
            {result.compatibilities.created} created, {result.compatibilities.updated} updated
          </p>
        </div>
      )}
      
      <div className="pt-4 border-t">
        <p className="text-sm text-gray-500">
          Completed in {result.totalTime}ms
        </p>
      </div>
    </div>
  );
};
```

**Success Criteria**:
- [ ] Shows progress in real-time
- [ ] Breakdown per sheet
- [ ] Total time visible

---

## BLOQUE 10: Integration Tests

**Objective**: E2E tests for complete flow

**File**: `tests/integration/multi-sheet-import.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MultiSheetImporter } from '@services/excel/MultiSheetImporter';
import { MultiSheetValidator } from '@services/excel/MultiSheetValidator';
import { getDatabase } from '@database/connection';

describe('Multi-Sheet Excel Import', () => {
  beforeEach(() => {
    // Reset DB
  });
  
  it('should import all 3 sheets successfully', async () => {
    // Given: Excel with valid Lines, Models, Compatibilities
    const filePath = 'tests/fixtures/valid-multi-sheet.xlsx';
    
    // When: Parse, validate, import
    const parsed = MultiSheetImporter.parseFile(filePath);
    const validated = await MultiSheetValidator.validateMultiSheet(parsed, []);
    // Import logic...
    
    // Then: All data in DB
    const db = getDatabase();
    const lineCount = db.prepare('SELECT COUNT(*) as count FROM production_lines').get();
    const modelCount = db.prepare('SELECT COUNT(*) as count FROM product_models').get();
    const compatCount = db.prepare('SELECT COUNT(*) as count FROM line_model_compatibilities').get();
    
    expect(lineCount.count).toBeGreaterThan(0);
    expect(modelCount.count).toBeGreaterThan(0);
    expect(compatCount.count).toBeGreaterThan(0);
  });
  
  it('should detect cross-sheet reference errors', async () => {
    // Given: Compatibility references non-existent model
    const filePath = 'tests/fixtures/invalid-reference-multi-sheet.xlsx';
    
    // When: Validate
    const parsed = MultiSheetImporter.parseFile(filePath);
    const validated = await MultiSheetValidator.validateMultiSheet(parsed, []);
    
    // Then: Error in crossSheetErrors
    expect(validated.crossSheetErrors.length).toBeGreaterThan(0);
  });
  
  it('should rollback on partial failure', async () => {
    // Given: Lines OK, Models with error on row 5
    const filePath = 'tests/fixtures/partial-error-multi-sheet.xlsx';
    
    // When: Import (should fail)
    // ...
    
    // Then: Nothing inserted, DB clean
    const db = getDatabase();
    const modelCount = db.prepare('SELECT COUNT(*) as count FROM product_models').get();
    expect(modelCount.count).toBe(0);
  });
});
```

**CHECKPOINT (30 sec)**:
```bash
npm test
# All tests pass
```

**Success Criteria**:
- [ ] Test coverage >80%
- [ ] Happy path works
- [ ] Edge cases covered
- [ ] Rollback verified

---

## BLOQUE FINAL: Alternate Flows & Edge Cases

### Edge Case 1: Solo 1 Sheet en Excel Multi-Sheet

**Scenario**: User uploads Excel with only "Models" sheet

**Expected**:
- SheetSelector shows only Models checkbox
- Allows importing only Models
- No errors about missing sheets

**Handling**:
```typescript
if (selectedSheets.size === 1 && selectedSheets.has('Models')) {
  // Import only Models, skip cross-sheet validation for Compatibilities
}
```

---

### Edge Case 2: Compatibilities Without Models in Same Excel

**Scenario**: Excel with Lines + Compatibilities, but Models in another file

**Expected**:
- Cross-sheet validation fails
- Error: "Cannot import Compatibilities without Models in same file"

**Handling**:
```typescript
if (selectedSheets.has('Compatibilities') && !selectedSheets.has('Models')) {
  throw new Error('Compatibilities require Models sheet in same Excel file');
}
```

---

### Edge Case 3: Duplicate Model Names

**Scenario**: Models sheet has 2 rows with same name

**Expected**:
- Validation detects duplicate
- Error: "Duplicate model name 'ECU-2024-A' in rows 3 and 7"

**Handling**: Already implemented in BLOQUE 4 (MultiSheetValidator)

---

### Edge Case 4: Operations Days = 0

**Scenario**: Model with Operations Days = 0

**Expected**:
- Validation fails
- Error: "Operations Days must be between 1-365"

**Handling**: Entity validation in ProductModel constructor

---

### Edge Case 5: Line Referenced Doesn't Exist in DB

**Scenario**: Compatibility references "Line SMT-99" not in DB

**Expected**:
- Cross-sheet validation fails
- Error: "Line 'SMT-99' does not exist in database"

**Handling**: Already implemented in BLOQUE 4 (validateCompatibilityLineReferences)

---

### Edge Case 6: Corrupted Excel File

**Scenario**: .xlsx file is corrupted or not Excel

**Expected**:
- Parser fails gracefully
- Error: "Invalid Excel file format"

**Handling**:
```typescript
try {
  const workbook = XLSX.readFile(filePath);
} catch (error) {
  return {
    success: false,
    error: 'Invalid Excel file format. Please check the file.'
  };
}
```

---

### Edge Case 7: Large File (>10,000 Rows)

**Scenario**: Excel with 15,000 models

**Expected**:
- Warning: "Large file detected, import may take a few minutes"
- Progress bar works
- No timeout

**Handling**:
```typescript
if (totalRows > 10000) {
  console.warn(`Large file: ${totalRows} rows. Batching import...`);
  
  // Batch insert 1000 at a time
  for (let i = 0; i < validModels.length; i += 1000) {
    const batch = validModels.slice(i, i + 1000);
    await modelRepository.batchCreate(batch);
  }
}
```

---

## Success Criteria

### Functional Requirements
- [ ] Parses Excel with 1, 2, or 3 sheets correctly
- [ ] Auto-detects columns for Models and Compatibilities
- [ ] Cross-sheet validation detects invalid references
- [ ] Import is transactional (rollback on error)
- [ ] UI shows progress per sheet
- [ ] Backward compatible with single-sheet import

### Non-Functional Requirements
- [ ] Performance: <2 seconds for 1,000 rows total
- [ ] Type-check passes without errors
- [ ] Test coverage >80%
- [ ] No memory leaks in large imports
- [ ] Error messages clear and actionable

### Edge Cases Covered
- [ ] Solo 1 sheet in multi-sheet file
- [ ] Compatibilities without Models in same file
- [ ] Duplicate model names
- [ ] Operations Days out of range (0, 366)
- [ ] Line/Model referenced doesn't exist
- [ ] Corrupted Excel file
- [ ] Large files (>10,000 rows)

### Documentation
- [ ] README updated with multi-sheet examples
- [ ] JSDoc on main services
- [ ] Example Excel fixture included

---

## Testing Strategy

### Unit Tests

**Files to test**:
- `MultiSheetImporter.ts` - Sheet detection, parsing
- `MultiSheetValidator.ts` - Validation rules, cross-sheet
- `ProductModel.ts` - Entity validation
- `LineModelCompatibility.ts` - Entity validation
- `SQLiteProductModelRepository.ts` - CRUD operations
- `SQLiteCompatibilityRepository.ts` - CRUD operations

**Coverage target**: >85%

---

### Integration Tests

**Scenarios**:
1. Parse multi-sheet Excel → All sheets detected
2. Validate multi-sheet data → Cross-sheet errors detected
3. Import multi-sheet → Data in DB, transaction committed
4. Import with error → Rollback, DB unchanged
5. Import large file → Batching works, no timeout

**Tools**: Vitest, in-memory SQLite

---

### E2E Tests (Manual)

**Test Plan**:

1. **Happy Path**: Import Lines + Models + Compatibilities
   - All data in DB ✓
   - No errors ✓
   - Canvas shows lines ✓

2. **Partial Import**: Import only Models
   - Models in DB ✓
   - No Compatibilities created ✓

3. **Error Handling**: Import with invalid reference
   - Error message shown ✓
   - Import blocked ✓

4. **Large File**: Import 5,000 models
   - Progress bar works ✓
   - No UI freeze ✓

---

## Implementation Command

```bash
cd ~/projects/line-optimizer

claude "@fullstack-developer implement multi-sheet-excel-import according to docs/specs/multi-sheet-excel-import.md. Apply contracts-first methodology with checkpoints after each block. Use Framework Híbrido v2.0."
```

**Alternative (Split Approach)**:

```bash
# Step 1: Backend (Blocks 1-5)
claude "@backend-architect implement multi-sheet import backend (Blocks 1-5) according to docs/specs/multi-sheet-excel-import.md. Focus on database migration, domain entities, repositories, parsers, validators, and IPC handlers."

# Step 2: Frontend (Blocks 6-9)
claude "@frontend-developer implement multi-sheet import UI (Blocks 6-9) according to docs/specs/multi-sheet-excel-import.md. Use TypeScript types from backend. Extend ImportWizard with SheetSelector, multi-sheet validation display, and progress tracking."

# Step 3: Testing (Block 10)
claude "@test-generator implement integration tests (Block 10) according to docs/specs/multi-sheet-excel-import.md. Coverage target >80%."
```

---

## Post-Implementation Verification

### 1. Type Check
```bash
npm run type-check
# Expected: No errors
```

### 2. Tests
```bash
npm test
# Expected: All tests pass, coverage >80%
```

### 3. Manual Test
```bash
npm start

# 1. Navigate to Import
# 2. Select multi-sheet Excel fixture
# 3. Import Lines + Models + Compatibilities
# 4. Verify data in DB:

sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
SELECT COUNT(*) as lines FROM production_lines;
SELECT COUNT(*) as models FROM product_models;
SELECT COUNT(*) as compatibilities FROM line_model_compatibilities;
EOF
```

### 4. Integration with Python Algorithm
```bash
# Verify imported data compatible with main_5.py
cd python
python src/main_5.py
# Expected: Algorithm runs, calculates line utilization
```

---

## Timeline Estimate

**Total**: 2-3 weeks manual (15-20 hours), 2-3 hours with Claude CLI

| Block | Task | Manual Time | CLI Time |
|-------|------|-------------|----------|
| 0 | Contracts & Architecture | 2h | 5min |
| 1 | Database Migration | 1h | 10min |
| 2 | Domain Entities & Repositories | 3h | 15min |
| 3 | Multi-Sheet Parser | 2h | 10min |
| 4 | Cross-Sheet Validator | 2h | 15min |
| 5 | IPC Handlers | 2h | 10min |
| 6 | Sheet Selector UI | 1h | 10min |
| 7 | Import Wizard Extension | 2h | 15min |
| 8 | Validation Display Enhancement | 1h | 10min |
| 9 | Progress Tracker Enhancement | 1h | 10min |
| 10 | Integration Tests | 2h | 15min |
| Final | Edge Cases & Polish | 1h | 15min |

**Total**: 20h manual vs 2.5h with CLI (88% time reduction)

---

**END OF SPECIFICATION**
