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
  AreaColumnMapping,
  ChangeoverColumnMapping,
  ExcelRow,
  DetectedSheets,
  YearColumnConfig,
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

    // Detect and parse Areas sheet (process flow order)
    const areasSheetName = this.findSheet(workbook.SheetNames, ['area', 'areas', 'procesos', 'processes']);
    console.log('[MultiSheetImporter] Areas sheet detection:', {
      searchPatterns: ['area', 'areas', 'procesos', 'processes'],
      foundSheet: areasSheetName,
      allSheets: workbook.SheetNames,
    });
    if (areasSheetName) {
      const data = this.parseSheet(workbook, areasSheetName);
      console.log('[MultiSheetImporter] Areas sheet parsed:', {
        headers: data.headers,
        rowCount: data.rows.length,
        firstRow: data.rows[0],
      });
      const mapping = this.detectAreaColumns(data.headers);
      console.log('[MultiSheetImporter] Areas column mapping:', mapping);
      if (mapping) {
        result.areas = {
          rows: data.rows,
          headers: data.headers,
          sheetName: areasSheetName,
          mapping,
          rowCount: data.rows.length,
        };
        console.log('[MultiSheetImporter] Areas added to result:', result.areas.rowCount, 'rows');
      } else {
        console.log('[MultiSheetImporter] Areas column mapping FAILED - required columns not found');
      }
    }

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
      const detectedYears = this.detectYearColumns(data.headers);
      if (mapping) {
        result.models = {
          rows: data.rows,
          headers: data.headers,
          sheetName: modelsSheetName,
          mapping,
          rowCount: data.rows.length,
          detectedYears,
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

    // Detect and parse Changeover sheet (family-to-family defaults)
    const changeoverSheetName = this.findSheet(workbook.SheetNames, ['changeover', 'changeovers', 'cambio', 'cambios', 'setup', 'setups']);
    if (changeoverSheetName) {
      const data = this.parseSheet(workbook, changeoverSheetName);
      const mapping = this.detectChangeoverColumns(data.headers);
      if (mapping) {
        result.changeover = {
          rows: data.rows,
          headers: data.headers,
          sheetName: changeoverSheetName,
          mapping,
          rowCount: data.rows.length,
        };
        console.log('[MultiSheetImporter] Changeover sheet parsed:', data.rows.length, 'rows');
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

    // Detect Areas sheet
    const areasSheetName = this.findSheet(workbook.SheetNames, ['area', 'areas', 'procesos', 'processes']);
    if (areasSheetName) {
      const data = this.parseSheet(workbook, areasSheetName);
      detected.areas = {
        sheetName: areasSheetName,
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }

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

    // Detect Changeover sheet
    const changeoverSheetName = this.findSheet(workbook.SheetNames, ['changeover', 'changeovers', 'cambio', 'cambios', 'setup', 'setups']);
    if (changeoverSheetName) {
      const data = this.parseSheet(workbook, changeoverSheetName);
      detected.changeover = {
        sheetName: changeoverSheetName,
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
   * Auto-detect column mapping for Areas sheet
   * Phase 7: Added plant column detection
   */
  static detectAreaColumns(headers: string[]): AreaColumnMapping | null {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '');

    const codePatterns = ['code', 'codigo', 'areacode', 'area'];
    const namePatterns = ['name', 'nombre', 'areaname', 'description'];
    const sequencePatterns = ['sequence', 'secuencia', 'order', 'orden', 'seq', 'flow'];
    const colorPatterns = ['color', 'colour'];
    const plantPatterns = ['plant', 'planta', 'site', 'facility', 'location'];  // Phase 7

    console.log('[detectAreaColumns] Input headers:', headers);
    console.log('[detectAreaColumns] Normalized headers:', headers.map(h => normalize(h)));

    const findMatch = (patterns: string[], fieldName: string) => {
      const match = headers.find(h => {
        const normalized = normalize(h);
        const matchedPattern = patterns.find(p => normalized.includes(p));
        if (matchedPattern) {
          console.log(`[detectAreaColumns] ${fieldName}: "${h}" matches pattern "${matchedPattern}"`);
        }
        return patterns.some(p => normalized.includes(p));
      }) || null;
      if (!match) {
        console.log(`[detectAreaColumns] ${fieldName}: NO MATCH found in patterns:`, patterns);
      }
      return match;
    };

    const code = findMatch(codePatterns, 'code');
    const sequence = findMatch(sequencePatterns, 'sequence');

    // Code and Sequence are required
    if (!code || !sequence) {
      console.log('[detectAreaColumns] FAILED - missing required fields:', { code, sequence });
      return null;
    }

    const name = findMatch(namePatterns, 'name');
    const color = findMatch(colorPatterns, 'color');
    const plant = findMatch(plantPatterns, 'plant');  // Phase 7

    const result = {
      code,
      name: name || undefined,
      sequence,
      color: color || undefined,
      plant: plant || undefined,  // Phase 7
    };
    console.log('[detectAreaColumns] SUCCESS:', result);
    return result;
  }

  /**
   * Auto-detect column mapping for Lines sheet
   * Phase 7: Added plant column detection
   */
  static detectLineColumns(headers: string[]): ColumnMapping | null {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '');

    const namePatterns = ['name', 'linename', 'line', 'nombre', 'nombrelinea'];
    const areaPatterns = ['area', 'zone', 'zona', 'productionarea'];
    const timePatterns = ['time', 'hours', 'hoursavailable', 'timeavailable', 'horas', 'tiempo'];
    const lineTypePatterns = ['linetype', 'type', 'tipo', 'tipolinea'];
    const plantPatterns = ['plant', 'planta', 'site', 'facility', 'location'];  // Phase 7

    const findMatch = (patterns: string[]) => {
      return headers.find(h => {
        const normalized = normalize(h);
        return patterns.some(p => normalized.includes(p));
      }) || null;
    };

    const name = findMatch(namePatterns);
    const area = findMatch(areaPatterns);
    const timeAvailableHours = findMatch(timePatterns);
    const lineType = findMatch(lineTypePatterns);
    const plant = findMatch(plantPatterns);  // Phase 7

    if (!name || !area || !timeAvailableHours) {
      return null;
    }

    console.log('[MultiSheetImporter] Lines column mapping:', { name, area, timeAvailableHours, lineType, plant });

    return { name, area, timeAvailableHours, lineType: lineType || undefined, plant: plant || undefined };
  }

  /**
   * Auto-detect column mapping for Models sheet
   * Now supports dynamic year columns - annualVolume/operationsDays are optional (legacy)
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
    const active = findColumn(['active', 'activo', 'status', 'estado']);

    // Legacy single-year columns (optional)
    const annualVolume = findColumn(['annual volume', 'annualvolume', 'volumen anual']);
    const operationsDays = findColumn(['operations days', 'operationsdays']);

    // Minimum required: model name
    // Year columns OR legacy volume/operations required - checked by validator
    if (!modelName) {
      return null;
    }

    return {
      modelName,
      customer,
      program,
      family,
      active,
      annualVolume: annualVolume || undefined,
      operationsDays: operationsDays || undefined,
    };
  }

  /**
   * Detect dynamic year columns from Models sheet headers
   * Looks for patterns like: 2024, 2025, 2026, etc.
   * And their corresponding operations days: "Dias Operacion 2024", "Op Days 2024", etc.
   */
  static detectYearColumns(headers: string[]): YearColumnConfig[] {
    const yearConfigs: YearColumnConfig[] = [];
    const yearPattern = /^(19|20|21)\d{2}$/;  // Matches years 1900-2199

    headers.forEach((header, index) => {
      const trimmed = header.trim();

      // Check if this is a year column
      if (yearPattern.test(trimmed)) {
        const year = parseInt(trimmed, 10);

        // Look for corresponding operations days column
        // Could be at index+1 or anywhere with the year in the name
        const opsDaysIndex = this.findOpsDaysColumnForYear(headers, year, index);

        if (opsDaysIndex !== -1) {
          yearConfigs.push({
            year,
            volumeColumnIndex: index,
            volumeColumnHeader: header,
            opsDaysColumnIndex: opsDaysIndex,
            opsDaysColumnHeader: headers[opsDaysIndex] || '',
          });
        } else {
          // No ops days column found - use default (240)
          // Still track the year column
          yearConfigs.push({
            year,
            volumeColumnIndex: index,
            volumeColumnHeader: header,
            opsDaysColumnIndex: -1,
            opsDaysColumnHeader: '',
          });
        }
      }
    });

    // Sort by year
    return yearConfigs.sort((a, b) => a.year - b.year);
  }

  /**
   * Find the operations days column for a specific year
   * Patterns: "Dias Operacion 2024", "Dias Operacion Annual 2024", "Op Days 2024"
   */
  private static findOpsDaysColumnForYear(headers: string[], year: number, volumeIndex: number): number {
    const yearStr = String(year);
    const opsDaysPatterns = ['dias', 'operacion', 'op', 'days', 'operation'];

    // First check the next column (most common pattern)
    if (volumeIndex + 1 < headers.length) {
      const nextHeader = headers[volumeIndex + 1]?.toLowerCase() || '';
      const containsYear = nextHeader.includes(yearStr);
      const containsOpsPattern = opsDaysPatterns.some(p => nextHeader.includes(p));

      if (containsYear && containsOpsPattern) {
        return volumeIndex + 1;
      }
    }

    // Search all headers for one containing both the year and an ops pattern
    for (let i = 0; i < headers.length; i++) {
      if (i === volumeIndex) continue;

      const header = headers[i]?.toLowerCase() || '';
      const containsYear = header.includes(yearStr);
      const containsOpsPattern = opsDaysPatterns.some(p => header.includes(p));

      if (containsYear && containsOpsPattern) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Auto-detect column mapping for Compatibilities sheet
   * Phase 7: Added plant column detection
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
    const plant = findColumn(['plant', 'planta', 'site', 'facility']);  // Phase 7

    // Minimum required fields
    if (!lineName || !modelName || !cycleTime || !efficiency) {
      return null;
    }

    console.log('[MultiSheetImporter] Compatibilities column mapping:', { lineName, modelName, cycleTime, efficiency, priority, plant });

    return {
      lineName,
      modelName,
      cycleTime,
      efficiency,
      priority,
      plant: plant || undefined,  // Phase 7
    };
  }

  /**
   * Auto-detect column mapping for Changeover sheet (family-to-family defaults)
   * Expected columns: From Family, To Family, Changeover Time (minutes)
   * Phase 7: Added plant column detection
   */
  static detectChangeoverColumns(headers: string[]): ChangeoverColumnMapping | null {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '');

    const fromFamilyPatterns = ['fromfamily', 'from', 'defamilia', 'origen', 'source', 'familyorigen'];
    const toFamilyPatterns = ['tofamily', 'to', 'afamilia', 'destino', 'target', 'familydestino'];
    const changeoverPatterns = ['changeover', 'cambio', 'setup', 'time', 'tiempo', 'minutes', 'minutos', 'min'];
    const plantPatterns = ['plant', 'planta', 'site', 'facility'];  // Phase 7

    const findMatch = (patterns: string[]) => {
      return headers.find(h => {
        const normalized = normalize(h);
        return patterns.some(p => normalized.includes(p));
      }) || null;
    };

    const fromFamily = findMatch(fromFamilyPatterns);
    const toFamily = findMatch(toFamilyPatterns);
    const changeoverMinutes = findMatch(changeoverPatterns);
    const plant = findMatch(plantPatterns);  // Phase 7

    // All fields are required (except plant)
    if (!fromFamily || !toFamily || !changeoverMinutes) {
      console.log('[MultiSheetImporter] Changeover column detection failed:', {
        fromFamily,
        toFamily,
        changeoverMinutes,
        headers,
      });
      return null;
    }

    console.log('[MultiSheetImporter] Changeover columns detected:', {
      fromFamily,
      toFamily,
      changeoverMinutes,
      plant,  // Phase 7
    });

    return {
      fromFamily,
      toFamily,
      changeoverMinutes,
      plant: plant || undefined,  // Phase 7
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
    if (detected.changeover) count++;
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
