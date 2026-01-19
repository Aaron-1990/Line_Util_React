// ============================================
// INTEGRATION TEST: MultiSheetImporter
// Tests for parsing multi-sheet Excel files
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

// Since we can't import the actual service in tests easily due to Electron dependencies,
// we'll test the core parsing logic directly using xlsx

describe('MultiSheetImporter - Sheet Detection', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures');
  const testFilePath = path.join(fixturesDir, 'multi-sheet-production-data.xlsx');

  beforeAll(() => {
    // Verify test fixture exists
    expect(fs.existsSync(testFilePath)).toBe(true);
  });

  it('should detect all three sheets in multi-sheet Excel file', () => {
    const buffer = fs.readFileSync(testFilePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toContain('Lines');
    expect(workbook.SheetNames).toContain('Models');
    expect(workbook.SheetNames).toContain('Compatibilities');
  });

  it('should parse Lines sheet correctly', () => {
    const buffer = fs.readFileSync(testFilePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const linesSheet = workbook.Sheets['Lines'];

    const data: unknown[][] = XLSX.utils.sheet_to_json(linesSheet, {
      header: 1,
      defval: null,
    });

    // Check headers
    const headers = data[0] as string[];
    expect(headers).toContain('Line Name');
    expect(headers).toContain('Area');
    expect(headers).toContain('Time Available (hours)');

    // Check data rows
    expect(data.length).toBeGreaterThan(1); // Headers + data
    const dataRows = data.slice(1).filter(row =>
      row.some(cell => cell !== null && cell !== '')
    );
    expect(dataRows.length).toBe(5); // 5 production lines
  });

  it('should parse Models sheet correctly', () => {
    const buffer = fs.readFileSync(testFilePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const modelsSheet = workbook.Sheets['Models'];

    const data: unknown[][] = XLSX.utils.sheet_to_json(modelsSheet, {
      header: 1,
      defval: null,
    });

    // Check headers
    const headers = data[0] as string[];
    expect(headers).toContain('Model Name');
    expect(headers).toContain('Customer');
    expect(headers).toContain('Annual Volume');
    expect(headers).toContain('Operations Days');

    // Check data rows
    const dataRows = data.slice(1).filter(row =>
      row.some(cell => cell !== null && cell !== '')
    );
    expect(dataRows.length).toBe(5); // 5 models
  });

  it('should parse Compatibilities sheet correctly', () => {
    const buffer = fs.readFileSync(testFilePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const compatSheet = workbook.Sheets['Compatibilities'];

    const data: unknown[][] = XLSX.utils.sheet_to_json(compatSheet, {
      header: 1,
      defval: null,
    });

    // Check headers
    const headers = data[0] as string[];
    expect(headers).toContain('Line Name');
    expect(headers).toContain('Model Name');
    expect(headers).toContain('Cycle Time (sec)');
    expect(headers).toContain('Efficiency (%)');
    expect(headers).toContain('Priority');

    // Check data rows
    const dataRows = data.slice(1).filter(row =>
      row.some(cell => cell !== null && cell !== '')
    );
    expect(dataRows.length).toBe(10); // 10 compatibilities
  });
});

describe('MultiSheetImporter - Column Auto-Detection', () => {
  const findMatch = (headers: string[], patterns: string[]): string | null => {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '');
    return headers.find(h => {
      const normalized = normalize(h);
      return patterns.some(p => normalized.includes(p));
    }) || null;
  };

  it('should auto-detect line columns', () => {
    const headers = ['Line Name', 'Area', 'Time Available (hours)', 'Extra Column'];

    const namePatterns = ['name', 'linename', 'line', 'nombre', 'nombrelinea'];
    const areaPatterns = ['area', 'zone', 'zona', 'productionarea'];
    const timePatterns = ['time', 'hours', 'hoursavailable', 'timeavailable', 'horas', 'tiempo'];

    expect(findMatch(headers, namePatterns)).toBe('Line Name');
    expect(findMatch(headers, areaPatterns)).toBe('Area');
    expect(findMatch(headers, timePatterns)).toBe('Time Available (hours)');
  });

  it('should auto-detect model columns', () => {
    const headers = ['Model Name', 'Customer', 'Program', 'Family', 'Annual Volume', 'Operations Days', 'Active'];

    const modelPatterns = ['model name', 'modelname', 'model', 'nombre modelo', 'nombre'];
    const customerPatterns = ['customer', 'cliente', 'client'];
    const volumePatterns = ['annual volume', 'annualvolume', 'volumen anual', 'volume', 'volumen'];
    const daysPatterns = ['operations days', 'operationsdays', 'dias operacion', 'dias', 'days'];

    expect(findMatch(headers, modelPatterns)).toBe('Model Name');
    expect(findMatch(headers, customerPatterns)).toBe('Customer');
    expect(findMatch(headers, volumePatterns)).toBe('Annual Volume');
    expect(findMatch(headers, daysPatterns)).toBe('Operations Days');
  });

  it('should auto-detect compatibility columns', () => {
    const headers = ['Line Name', 'Model Name', 'Cycle Time (sec)', 'Efficiency (%)', 'Priority'];

    const linePatterns = ['line name', 'linename', 'line', 'linea', 'nombre linea'];
    const modelPatterns = ['model name', 'modelname', 'model', 'modelo', 'nombre modelo'];
    const cyclePatterns = ['cycle time', 'cycletime', 'tiempo ciclo', 'cycle', 'ciclo'];
    const effPatterns = ['efficiency', 'eficiencia', 'oee', 'eff'];

    expect(findMatch(headers, linePatterns)).toBe('Line Name');
    expect(findMatch(headers, modelPatterns)).toBe('Model Name');
    expect(findMatch(headers, cyclePatterns)).toBe('Cycle Time (sec)');
    expect(findMatch(headers, effPatterns)).toBe('Efficiency (%)');
  });
});
