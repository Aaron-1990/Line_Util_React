// ============================================
// EXCEL VALIDATOR
// Valida datos de Excel antes de importar
// ============================================

import {
  ExcelRow,
  ValidationError,
  ValidatedLine,
  ValidationResult,
  ColumnMapping,
} from '@shared/types';

export class ExcelValidator {
  static validateRow(
    row: ExcelRow,
    columnMapping: ColumnMapping
  ): {
    line: ValidatedLine | null;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    const rowIndex = (row.__rowNum__ as number) || 0;

    const name = row[columnMapping.name];
    if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push({
        row: rowIndex,
        field: columnMapping.name,
        message: 'Name is required',
        value: name,
      });
    }

    const area = row[columnMapping.area];
    if (!area || typeof area !== 'string' || area.trim() === '') {
      errors.push({
        row: rowIndex,
        field: columnMapping.area,
        message: 'Area is required',
        value: area,
      });
    }

    const timeHours = this.parseNumber(row[columnMapping.timeAvailableHours]);
    if (timeHours === null || timeHours <= 0 || timeHours > 24) {
      errors.push({
        row: rowIndex,
        field: columnMapping.timeAvailableHours,
        message: 'Time must be between 0 and 24 hours',
        value: row[columnMapping.timeAvailableHours],
      });
    }

    if (errors.length > 0) {
      return { line: null, errors };
    }

    const timeAvailableDaily = timeHours! * 3600;

    return {
      line: {
        name: (name as string).trim(),
        area: (area as string).trim(),
        timeAvailableDaily,
        row: rowIndex,
      },
      errors: [],
    };
  }

  static validateBatch(
    rows: ExcelRow[],
    columnMapping: ColumnMapping
  ): ValidationResult {
    const validLines: ValidatedLine[] = [];
    const allErrors: ValidationError[] = [];

    rows.forEach(row => {
      const { line, errors } = this.validateRow(row, columnMapping);
      if (line) {
        validLines.push(line);
      }
      if (errors.length > 0) {
        allErrors.push(...errors);
      }
    });

    const duplicateNames = this.findDuplicates(validLines);

    return {
      stats: {
        total: rows.length,
        valid: validLines.length,
        invalid: allErrors.length,
        duplicates: duplicateNames.length,
      },
      validLines,
      errors: allErrors,
      duplicates: duplicateNames,
    };
  }

  static findDuplicates(lines: ValidatedLine[]): string[] {
    const names = lines.map(l => l.name.toLowerCase());
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    names.forEach(name => {
      if (seen.has(name)) {
        duplicates.add(name);
      }
      seen.add(name);
    });

    return Array.from(duplicates);
  }

  private static parseNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;

      const parsed = parseFloat(trimmed);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }
}
