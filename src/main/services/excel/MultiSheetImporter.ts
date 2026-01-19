// ============================================
// MULTI-SHEET EXCEL IMPORTER
// Parses Excel files with multiple sheets (Lines, Models, Compatibilities)
// ============================================

import * as XLSX from 'xlsx';
import fs from 'fs';
import {
  MultiSheetParsedData,
  ColumnMapping,
  ModelColumnMapping,
  CompatibilityColumnMapping,
  ExcelRow,
  DetectedSheets,
} from '@shared/types';

export class MultiSheetImporter {
  /**
   * Parse multi-sheet Excel file
   * Detects available sheets: Lines, Models, Compatibilities
   */
  static parseFile(filePath: string): MultiSheetParsedData {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (workbook.SheetNames.length === 0) {
      throw new Error('Workbook has no sheets');
    }

    const result: MultiSheetParsedData = {
      availableSheets: workbook.SheetNames,
    };

    // Detect and parse Lines sheet
    const linesSheetName = this.findSheet(workbook.SheetNames, ['line', 'lines', 'lineas', 'produccion']);
    if (linesSheetName) {
      const data = this.parseSheet(workbook, linesSheetName);
      const mapping = this.detectLineColumns(data.headers);
      if (mapping) {
        result.lines = {
          rows: data.rows,
          headers: data.headers,
          sheetName: linesSheetName,
          mapping,
          rowCount: data.rows.length,
        };
      }
    }

    // Detect and parse Models sheet
    const modelsSheetName = this.findSheet(workbook.SheetNames, ['model', 'models', 'modelos', 'productos']);
    if (modelsSheetName) {
      const data = this.parseSheet(workbook, modelsSheetName);
      const mapping = this.detectModelColumns(data.headers);
      if (mapping) {
        result.models = {
          rows: data.rows,
          headers: data.headers,
          sheetName: modelsSheetName,
          mapping,
          rowCount: data.rows.length,
        };
      }
    }

    // Detect and parse Compatibilities sheet
    const compatSheetName = this.findSheet(workbook.SheetNames, ['compat', 'compatibility', 'compatibilities', 'compatibilidad']);
    if (compatSheetName) {
      const data = this.parseSheet(workbook, compatSheetName);
      const mapping = this.detectCompatibilityColumns(data.headers);
      if (mapping) {
        result.compatibilities = {
          rows: data.rows,
          headers: data.headers,
          sheetName: compatSheetName,
          mapping,
          rowCount: data.rows.length,
        };
      }
    }

    return result;
  }

  /**
   * Detect which sheets are available in the file
   */
  static detectSheets(filePath: string): DetectedSheets {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const detected: DetectedSheets = {};

    // Detect Lines sheet
    const linesSheetName = this.findSheet(workbook.SheetNames, ['line', 'lines', 'lineas', 'produccion']);
    if (linesSheetName) {
      const data = this.parseSheet(workbook, linesSheetName);
      detected.lines = {
        sheetName: linesSheetName,
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }

    // Detect Models sheet
    const modelsSheetName = this.findSheet(workbook.SheetNames, ['model', 'models', 'modelos', 'productos']);
    if (modelsSheetName) {
      const data = this.parseSheet(workbook, modelsSheetName);
      detected.models = {
        sheetName: modelsSheetName,
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }

    // Detect Compatibilities sheet
    const compatSheetName = this.findSheet(workbook.SheetNames, ['compat', 'compatibility', 'compatibilities', 'compatibilidad']);
    if (compatSheetName) {
      const data = this.parseSheet(workbook, compatSheetName);
      detected.compatibilities = {
        sheetName: compatSheetName,
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }

    return detected;
  }

  /**
   * Find a sheet by name patterns (case-insensitive)
   */
  private static findSheet(sheetNames: string[], patterns: string[]): string | null {
    for (const sheetName of sheetNames) {
      const lowerName = sheetName.toLowerCase();
      for (const pattern of patterns) {
        if (lowerName.includes(pattern)) {
          return sheetName;
        }
      }
    }
    return null;
  }

  /**
   * Parse a single sheet from workbook
   */
  static parseSheet(workbook: XLSX.WorkBook, sheetName: string): { rows: ExcelRow[]; headers: string[] } {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rawData.length === 0) {
      return { rows: [], headers: [] };
    }

    const headers = (rawData[0] as (string | null)[])
      .map(h => (h ? String(h).trim() : ''))
      .filter(h => h !== '');

    const dataRows = rawData.slice(1);

    const rows: ExcelRow[] = dataRows.map((row, index) => {
      const rowData: ExcelRow = { __rowNum__: index + 2 };

      headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        rowData[header] = value;
      });

      return rowData;
    }).filter(row => {
      // Filter out completely empty rows
      const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '' && v !== '__rowNum__');
      return values.length > 0;
    });

    return { rows, headers };
  }

  /**
   * Auto-detect column mapping for Lines sheet
   */
  static detectLineColumns(headers: string[]): ColumnMapping | null {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '');

    const namePatterns = ['name', 'linename', 'line', 'nombre', 'nombrelinea'];
    const areaPatterns = ['area', 'zone', 'zona', 'productionarea'];
    const timePatterns = ['time', 'hours', 'hoursavailable', 'timeavailable', 'horas', 'tiempo'];

    const findMatch = (patterns: string[]) => {
      return headers.find(h => {
        const normalized = normalize(h);
        return patterns.some(p => normalized.includes(p));
      }) || null;
    };

    const name = findMatch(namePatterns);
    const area = findMatch(areaPatterns);
    const timeAvailableHours = findMatch(timePatterns);

    if (!name || !area || !timeAvailableHours) {
      return null;
    }

    return { name, area, timeAvailableHours };
  }

  /**
   * Auto-detect column mapping for Models sheet
   */
  static detectModelColumns(headers: string[]): ModelColumnMapping | null {
    const lowerHeaders = headers.map(h => h.toLowerCase());

    const findColumn = (patterns: string[]): string => {
      const index = lowerHeaders.findIndex(h =>
        patterns.some(p => h.includes(p))
      );
      return index >= 0 ? (headers[index] ?? '') : '';
    };

    const modelName = findColumn(['model name', 'modelname', 'model', 'nombre modelo', 'nombre']);
    const customer = findColumn(['customer', 'cliente', 'client']);
    const program = findColumn(['program', 'programa', 'project', 'proyecto']);
    const family = findColumn(['family', 'familia', 'product family']);
    const annualVolume = findColumn(['annual volume', 'annualvolume', 'volumen anual', 'volume', 'volumen']);
    const operationsDays = findColumn(['operations days', 'operationsdays', 'dias operacion', 'dias', 'days']);
    const active = findColumn(['active', 'activo', 'status', 'estado']);

    // Minimum required fields
    if (!modelName || !annualVolume || !operationsDays) {
      return null;
    }

    return {
      modelName,
      customer,
      program,
      family,
      annualVolume,
      operationsDays,
      active,
    };
  }

  /**
   * Auto-detect column mapping for Compatibilities sheet
   */
  static detectCompatibilityColumns(headers: string[]): CompatibilityColumnMapping | null {
    const lowerHeaders = headers.map(h => h.toLowerCase());

    const findColumn = (patterns: string[]): string => {
      const index = lowerHeaders.findIndex(h =>
        patterns.some(p => h.includes(p))
      );
      return index >= 0 ? (headers[index] ?? '') : '';
    };

    const lineName = findColumn(['line name', 'linename', 'line', 'linea', 'nombre linea']);
    const modelName = findColumn(['model name', 'modelname', 'model', 'modelo', 'nombre modelo']);
    const cycleTime = findColumn(['cycle time', 'cycletime', 'tiempo ciclo', 'cycle', 'ciclo']);
    const efficiency = findColumn(['efficiency', 'eficiencia', 'oee', 'eff']);
    const priority = findColumn(['priority', 'prioridad', 'prio', 'orden']);

    // Minimum required fields
    if (!lineName || !modelName || !cycleTime || !efficiency) {
      return null;
    }

    return {
      lineName,
      modelName,
      cycleTime,
      efficiency,
      priority,
    };
  }

  /**
   * Check if file is multi-sheet (has more than one detectable sheet)
   */
  static isMultiSheet(filePath: string): boolean {
    const detected = this.detectSheets(filePath);
    let count = 0;
    if (detected.lines) count++;
    if (detected.models) count++;
    if (detected.compatibilities) count++;
    return count > 1;
  }

  /**
   * Get sheet names from file
   */
  static getSheetNames(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  }
}
