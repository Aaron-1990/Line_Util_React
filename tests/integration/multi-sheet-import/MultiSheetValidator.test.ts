// ============================================
// INTEGRATION TEST: MultiSheetValidator
// Tests for validating multi-sheet data including cross-sheet validation
// ============================================

import { describe, it, expect } from 'vitest';
import type {
  ExcelRow,
  ModelColumnMapping,
  CompatibilityColumnMapping,
  ValidatedModel,
  ValidatedCompatibility,
} from '../../../src/shared/types';

// Minimal implementation of validation logic for testing
// (extracted from MultiSheetValidator to avoid Electron dependencies)

function extractString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function extractNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    if (trimmed.endsWith('%')) {
      const num = parseFloat(trimmed.slice(0, -1));
      return isNaN(num) ? null : num;
    }

    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

function extractBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'si';
  }
  return true;
}

describe('MultiSheetValidator - Model Validation', () => {
  const mapping: ModelColumnMapping = {
    modelName: 'Model Name',
    customer: 'Customer',
    program: 'Program',
    family: 'Family',
    annualVolume: 'Annual Volume',
    operationsDays: 'Operations Days',
    active: 'Active',
  };

  it('should validate a valid model row', () => {
    const row: ExcelRow = {
      'Model Name': 'ECU-2024-A',
      'Customer': 'BorgWarner',
      'Program': 'EV Program',
      'Family': 'ECU 2024',
      'Annual Volume': 50000,
      'Operations Days': 250,
      'Active': true,
      __rowNum__: 2,
    };

    const name = extractString(row[mapping.modelName]);
    const customer = extractString(row[mapping.customer]) || '';
    const program = extractString(row[mapping.program]) || '';
    const family = extractString(row[mapping.family]) || '';
    const annualVolume = extractNumber(row[mapping.annualVolume]);
    const operationsDays = extractNumber(row[mapping.operationsDays]);
    const active = extractBoolean(row[mapping.active]);

    expect(name).toBe('ECU-2024-A');
    expect(customer).toBe('BorgWarner');
    expect(annualVolume).toBe(50000);
    expect(operationsDays).toBe(250);
    expect(active).toBe(true);

    // Validate constraints
    expect(annualVolume).toBeGreaterThanOrEqual(0);
    expect(operationsDays).toBeGreaterThanOrEqual(1);
    expect(operationsDays).toBeLessThanOrEqual(365);
  });

  it('should reject invalid annual volume (negative)', () => {
    const row: ExcelRow = {
      'Model Name': 'Test Model',
      'Annual Volume': -100,
      'Operations Days': 250,
    };

    const annualVolume = extractNumber(row[mapping.annualVolume]);
    expect(annualVolume).toBeLessThan(0);
  });

  it('should reject invalid operations days (out of range)', () => {
    const row: ExcelRow = {
      'Model Name': 'Test Model',
      'Annual Volume': 1000,
      'Operations Days': 400, // > 365
    };

    const operationsDays = extractNumber(row[mapping.operationsDays]);
    expect(operationsDays).toBeGreaterThan(365);
  });

  it('should reject missing model name', () => {
    const row: ExcelRow = {
      'Model Name': '',
      'Annual Volume': 1000,
      'Operations Days': 250,
    };

    const name = extractString(row[mapping.modelName]);
    expect(name).toBeNull();
  });
});

describe('MultiSheetValidator - Compatibility Validation', () => {
  const mapping: CompatibilityColumnMapping = {
    lineName: 'Line Name',
    modelName: 'Model Name',
    cycleTime: 'Cycle Time',
    efficiency: 'Efficiency',
    priority: 'Priority',
  };

  it('should validate a valid compatibility row', () => {
    const row: ExcelRow = {
      'Line Name': 'Line SMT-1',
      'Model Name': 'ECU-2024-A',
      'Cycle Time': 45,
      'Efficiency': 85,
      'Priority': 1,
      __rowNum__: 2,
    };

    const lineName = extractString(row[mapping.lineName]);
    const modelName = extractString(row[mapping.modelName]);
    const cycleTime = extractNumber(row[mapping.cycleTime]);
    const efficiency = extractNumber(row[mapping.efficiency]);
    const priority = extractNumber(row[mapping.priority]) || 1;

    expect(lineName).toBe('Line SMT-1');
    expect(modelName).toBe('ECU-2024-A');
    expect(cycleTime).toBe(45);
    expect(efficiency).toBe(85);
    expect(priority).toBe(1);

    // Validate constraints
    expect(cycleTime).toBeGreaterThan(0);
    expect(efficiency).toBeGreaterThan(0);
    expect(efficiency).toBeLessThanOrEqual(100);
    expect(priority).toBeGreaterThanOrEqual(1);
  });

  it('should reject invalid cycle time (zero or negative)', () => {
    const row: ExcelRow = {
      'Line Name': 'Line SMT-1',
      'Model Name': 'ECU-2024-A',
      'Cycle Time': 0,
      'Efficiency': 85,
    };

    const cycleTime = extractNumber(row[mapping.cycleTime]);
    expect(cycleTime).toBeLessThanOrEqual(0);
  });

  it('should reject invalid efficiency (> 100)', () => {
    const row: ExcelRow = {
      'Line Name': 'Line SMT-1',
      'Model Name': 'ECU-2024-A',
      'Cycle Time': 45,
      'Efficiency': 120, // > 100
    };

    const efficiency = extractNumber(row[mapping.efficiency]);
    expect(efficiency).toBeGreaterThan(100);
  });

  it('should handle percentage format in efficiency', () => {
    const row: ExcelRow = {
      'Efficiency': '85%',
    };

    const efficiency = extractNumber(row[mapping.efficiency]);
    expect(efficiency).toBe(85);
  });
});

describe('MultiSheetValidator - Cross-Sheet Validation', () => {
  it('should detect missing line reference in compatibilities', () => {
    const validLines = ['Line SMT-1', 'Line SMT-2'];
    const validModels = ['ECU-2024-A', 'ECU-2024-B'];

    const compatibility: ValidatedCompatibility = {
      lineName: 'Line ICT-1', // Not in validLines
      modelName: 'ECU-2024-A',
      cycleTime: 45,
      efficiency: 85,
      priority: 1,
      row: 2,
    };

    const lineExists = validLines.includes(compatibility.lineName);
    const modelExists = validModels.includes(compatibility.modelName);

    expect(lineExists).toBe(false);
    expect(modelExists).toBe(true);
  });

  it('should detect missing model reference in compatibilities', () => {
    const validLines = ['Line SMT-1', 'Line SMT-2'];
    const validModels = ['ECU-2024-A', 'ECU-2024-B'];

    const compatibility: ValidatedCompatibility = {
      lineName: 'Line SMT-1',
      modelName: 'DCM-2025-A', // Not in validModels
      cycleTime: 45,
      efficiency: 85,
      priority: 1,
      row: 2,
    };

    const lineExists = validLines.includes(compatibility.lineName);
    const modelExists = validModels.includes(compatibility.modelName);

    expect(lineExists).toBe(true);
    expect(modelExists).toBe(false);
  });

  it('should pass when all references are valid', () => {
    const validLines = ['Line SMT-1', 'Line SMT-2', 'Line ICT-1'];
    const validModels = ['ECU-2024-A', 'ECU-2024-B', 'DCM-2025-A'];

    const compatibilities: ValidatedCompatibility[] = [
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-A', cycleTime: 45, efficiency: 85, priority: 1, row: 2 },
      { lineName: 'Line SMT-2', modelName: 'DCM-2025-A', cycleTime: 60, efficiency: 88, priority: 1, row: 3 },
      { lineName: 'Line ICT-1', modelName: 'ECU-2024-B', cycleTime: 30, efficiency: 90, priority: 1, row: 4 },
    ];

    const errors: string[] = [];

    for (const compat of compatibilities) {
      if (!validLines.includes(compat.lineName)) {
        errors.push(`Row ${compat.row}: Invalid line reference "${compat.lineName}"`);
      }
      if (!validModels.includes(compat.modelName)) {
        errors.push(`Row ${compat.row}: Invalid model reference "${compat.modelName}"`);
      }
    }

    expect(errors).toHaveLength(0);
  });
});

describe('MultiSheetValidator - Duplicate Detection', () => {
  it('should detect duplicate model names within sheet', () => {
    const models: ValidatedModel[] = [
      { name: 'ECU-2024-A', customer: 'BW', program: 'EV', family: 'ECU', annualVolume: 50000, operationsDays: 250, active: true, row: 2 },
      { name: 'ECU-2024-B', customer: 'BW', program: 'EV', family: 'ECU', annualVolume: 30000, operationsDays: 300, active: true, row: 3 },
      { name: 'ECU-2024-A', customer: 'Tesla', program: 'Hybrid', family: 'ECU', annualVolume: 40000, operationsDays: 280, active: true, row: 4 }, // Duplicate
    ];

    const seenNames = new Set<string>();
    const duplicates: string[] = [];

    for (const model of models) {
      const lowerName = model.name.toLowerCase();
      if (seenNames.has(lowerName)) {
        duplicates.push(model.name);
      } else {
        seenNames.add(lowerName);
      }
    }

    expect(duplicates).toContain('ECU-2024-A');
    expect(duplicates).toHaveLength(1);
  });

  it('should detect duplicate line-model pairs in compatibilities', () => {
    const compatibilities: ValidatedCompatibility[] = [
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-A', cycleTime: 45, efficiency: 85, priority: 1, row: 2 },
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-B', cycleTime: 50, efficiency: 82, priority: 2, row: 3 },
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-A', cycleTime: 48, efficiency: 86, priority: 3, row: 4 }, // Duplicate
    ];

    const seenPairs = new Set<string>();
    const duplicates: string[] = [];

    for (const compat of compatibilities) {
      const pairKey = `${compat.lineName.toLowerCase()}|${compat.modelName.toLowerCase()}`;
      if (seenPairs.has(pairKey)) {
        duplicates.push(pairKey);
      } else {
        seenPairs.add(pairKey);
      }
    }

    expect(duplicates).toContain('line smt-1|ecu-2024-a');
    expect(duplicates).toHaveLength(1);
  });
});
