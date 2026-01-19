// ============================================
// EXCEL IMPORTER SERVICE
// Soporta formatos: .xlsx, .xls, .csv
// ============================================
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import fs from 'fs';

export interface ExcelRow {
  rowNumber: number;
  [key: string]: unknown;
}

export interface ParseResult {
  rows: ExcelRow[];
  headers: string[];
  sheetName: string;
}

export class ExcelImporter {
  /**
   * Parse archivo Excel (.xlsx, .xls) o CSV (.csv)
   * Detecta formato automaticamente por extension
   */
  static parseFile(filePath: string, sheetIndex: number = 0): ParseResult {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = filePath.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      return this.parseCsv(filePath);
    } else if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcel(filePath, sheetIndex);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Parse archivo Excel (.xlsx, .xls)
   */
  private static parseExcel(filePath: string, sheetIndex: number = 0): ParseResult {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (workbook.SheetNames.length === 0) {
      throw new Error('Workbook has no sheets');
    }

    const sheetName = workbook.SheetNames[sheetIndex];
    if (!sheetName) {
      throw new Error(`Sheet index ${sheetIndex} not found`);
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Worksheet ${sheetName} not found`);
    }

    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rawData.length === 0) {
      throw new Error('Sheet is empty');
    }

    const headers = rawData[0] as string[];
    const dataRows = rawData.slice(1);

    const rows: ExcelRow[] = dataRows.map((row, index) => {
      const rowData: ExcelRow = { rowNumber: index + 2 };
      
      headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        rowData[header] = value;
      });

      return rowData;
    });

    return {
      rows,
      headers,
      sheetName,
    };
  }

  /**
   * Parse archivo CSV (.csv)
   */
  private static parseCsv(filePath: string): ParseResult {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      const firstError = parseResult.errors[0];
      if (firstError) {
        throw new Error(`CSV parse error: ${firstError.message} at row ${firstError.row || 'unknown'}`);
      }
      throw new Error('CSV parse error: Unknown error');
    }

    if (!parseResult.meta.fields || parseResult.meta.fields.length === 0) {
      throw new Error('CSV file has no headers');
    }

    if (parseResult.data.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = parseResult.meta.fields;
    const rows: ExcelRow[] = (parseResult.data as Record<string, unknown>[]).map((row, index) => {
      return {
        rowNumber: index + 2,
        ...row,
      };
    });

    return {
      rows,
      headers,
      sheetName: 'CSV Data',
    };
  }

  static detectColumns(headers: string[]): {
    name: string | null;
    area: string | null;
    timeAvailableHours: string | null;
  } {
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

    return {
      name: findMatch(namePatterns),
      area: findMatch(areaPatterns),
      timeAvailableHours: findMatch(timePatterns),
    };
  }

  static validateColumns(mapping: {
    name: string | null;
    area: string | null;
    timeAvailableHours: string | null;
  }): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!mapping.name) missing.push('Name');
    if (!mapping.area) missing.push('Area');
    if (!mapping.timeAvailableHours) missing.push('Time Available (hours)');

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  static getSheetNames(filePath: string): string[] {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  }
}
