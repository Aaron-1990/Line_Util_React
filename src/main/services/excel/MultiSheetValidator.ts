// ============================================
// MULTI-SHEET VALIDATOR
// Validates data from multiple sheets with cross-sheet validation
// ============================================

import {
  MultiSheetParsedData,
  MultiSheetValidationResult,
  ModelValidationResult,
  CompatibilityValidationResult,
  ValidatedModel,
  ValidatedCompatibility,
  ValidationError,
  ExcelRow,
  ModelColumnMapping,
  CompatibilityColumnMapping,
} from '@shared/types';
import { ExcelValidator } from './ExcelValidator';

export class MultiSheetValidator {
  /**
   * Validate multi-sheet data with cross-sheet validation
   * @param data Parsed multi-sheet data
   * @param existingLines Line names that already exist in the database
   * @param existingModels Model names that already exist in the database
   */
  static async validateMultiSheet(
    data: MultiSheetParsedData,
    existingLines: string[],
    existingModels: string[] = []
  ): Promise<MultiSheetValidationResult> {
    const result: MultiSheetValidationResult = {
      crossSheetErrors: [],
      isValid: true,
    };

    // 1. Validate Lines sheet (if present)
    if (data.lines) {
      result.lines = ExcelValidator.validateBatch(data.lines.rows, data.lines.mapping);
    }

    // 2. Validate Models sheet (if present)
    if (data.models) {
      result.models = this.validateModels(data.models.rows, data.models.mapping);
    }

    // 3. Validate Compatibilities sheet (if present)
    if (data.compatibilities) {
      result.compatibilities = this.validateCompatibilities(
        data.compatibilities.rows,
        data.compatibilities.mapping
      );
    }

    // 4. Cross-sheet validation

    // Build set of all valid lines (existing + from current import)
    const allValidLineNames = new Set<string>([
      ...existingLines,
      ...(result.lines?.validLines.map(l => l.name) || []),
    ]);

    // Build set of all valid models (existing + from current import)
    const allValidModelNames = new Set<string>([
      ...existingModels,
      ...(result.models?.validModels.map(m => m.name) || []),
    ]);

    // Validate compatibility references
    if (result.compatibilities && result.compatibilities.validCompatibilities.length > 0) {
      // Check line references
      for (const compat of result.compatibilities.validCompatibilities) {
        if (!allValidLineNames.has(compat.lineName)) {
          result.crossSheetErrors.push(
            `Row ${compat.row}: Compatibility references line "${compat.lineName}" which doesn't exist in Lines sheet or database`
          );
        }

        if (!allValidModelNames.has(compat.modelName)) {
          result.crossSheetErrors.push(
            `Row ${compat.row}: Compatibility references model "${compat.modelName}" which doesn't exist in Models sheet or database`
          );
        }
      }
    }

    // Check if trying to import compatibilities without models
    if (data.compatibilities && !data.models && existingModels.length === 0) {
      result.crossSheetErrors.push(
        'Cannot import Compatibilities without Models. Please include a Models sheet or import models first.'
      );
    }

    // Determine overall validity
    result.isValid =
      result.crossSheetErrors.length === 0 &&
      (result.lines?.stats.invalid || 0) === 0 &&
      (result.models?.stats.invalid || 0) === 0 &&
      (result.compatibilities?.stats.invalid || 0) === 0;

    return result;
  }

  /**
   * Validate Models sheet data
   */
  static validateModels(
    rows: ExcelRow[],
    mapping: ModelColumnMapping
  ): ModelValidationResult {
    const validModels: ValidatedModel[] = [];
    const errors: ValidationError[] = [];
    const seenNames = new Set<string>();
    const duplicates: string[] = [];

    rows.forEach((row, index) => {
      const rowNum = (row.__rowNum__ as number) || index + 2;

      try {
        // Extract values
        const name = this.extractString(row[mapping.modelName]);
        const customer = this.extractString(row[mapping.customer]) || '';
        const program = this.extractString(row[mapping.program]) || '';
        const family = this.extractString(row[mapping.family]) || '';
        const annualVolume = this.extractNumber(row[mapping.annualVolume]);
        const operationsDays = this.extractNumber(row[mapping.operationsDays]);
        const active = mapping.active
          ? this.extractBoolean(row[mapping.active])
          : true;

        // Validate required fields
        if (!name) {
          errors.push({
            row: rowNum,
            field: mapping.modelName,
            message: 'Model name is required',
            value: row[mapping.modelName],
          });
          return;
        }

        // Check for duplicates within the sheet
        if (seenNames.has(name.toLowerCase())) {
          errors.push({
            row: rowNum,
            field: mapping.modelName,
            message: `Duplicate model name "${name}"`,
            value: name,
          });
          duplicates.push(name);
          return;
        }
        seenNames.add(name.toLowerCase());

        // Validate annual volume
        if (annualVolume === null || annualVolume < 0) {
          errors.push({
            row: rowNum,
            field: mapping.annualVolume,
            message: 'Annual volume must be a number >= 0',
            value: row[mapping.annualVolume],
          });
          return;
        }

        // Validate operations days
        if (operationsDays === null || operationsDays < 1 || operationsDays > 365) {
          errors.push({
            row: rowNum,
            field: mapping.operationsDays,
            message: 'Operations days must be between 1-365',
            value: row[mapping.operationsDays],
          });
          return;
        }

        validModels.push({
          name,
          customer,
          program,
          family,
          annualVolume,
          operationsDays,
          active,
          row: rowNum,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        errors.push({
          row: rowNum,
          field: 'Multiple',
          message: errorMessage,
          value: null,
        });
      }
    });

    return {
      validModels,
      errors,
      stats: {
        total: rows.length,
        valid: validModels.length,
        invalid: errors.length,
        duplicates: duplicates.length,
      },
      duplicates,
    };
  }

  /**
   * Validate Compatibilities sheet data
   */
  static validateCompatibilities(
    rows: ExcelRow[],
    mapping: CompatibilityColumnMapping
  ): CompatibilityValidationResult {
    const validCompatibilities: ValidatedCompatibility[] = [];
    const errors: ValidationError[] = [];
    const seenPairs = new Set<string>();
    const duplicates: string[] = [];

    rows.forEach((row, index) => {
      const rowNum = (row.__rowNum__ as number) || index + 2;

      try {
        // Extract values
        const lineName = this.extractString(row[mapping.lineName]);
        const modelName = this.extractString(row[mapping.modelName]);
        const cycleTime = this.extractNumber(row[mapping.cycleTime]);
        const efficiency = this.extractNumber(row[mapping.efficiency]);
        const priority = mapping.priority
          ? this.extractNumber(row[mapping.priority]) || 1
          : 1;

        // Validate required fields
        if (!lineName) {
          errors.push({
            row: rowNum,
            field: mapping.lineName,
            message: 'Line name is required',
            value: row[mapping.lineName],
          });
          return;
        }

        if (!modelName) {
          errors.push({
            row: rowNum,
            field: mapping.modelName,
            message: 'Model name is required',
            value: row[mapping.modelName],
          });
          return;
        }

        // Check for duplicate line-model pairs
        const pairKey = `${lineName.toLowerCase()}|${modelName.toLowerCase()}`;
        if (seenPairs.has(pairKey)) {
          errors.push({
            row: rowNum,
            field: 'Line-Model Pair',
            message: `Duplicate compatibility for line "${lineName}" and model "${modelName}"`,
            value: `${lineName} - ${modelName}`,
          });
          duplicates.push(pairKey);
          return;
        }
        seenPairs.add(pairKey);

        // Validate cycle time
        if (cycleTime === null || cycleTime <= 0) {
          errors.push({
            row: rowNum,
            field: mapping.cycleTime,
            message: 'Cycle time must be > 0',
            value: row[mapping.cycleTime],
          });
          return;
        }

        // Validate efficiency
        if (efficiency === null || efficiency <= 0 || efficiency > 100) {
          errors.push({
            row: rowNum,
            field: mapping.efficiency,
            message: 'Efficiency must be between 0-100',
            value: row[mapping.efficiency],
          });
          return;
        }

        // Validate priority
        if (priority < 1) {
          errors.push({
            row: rowNum,
            field: mapping.priority || 'Priority',
            message: 'Priority must be >= 1',
            value: row[mapping.priority],
          });
          return;
        }

        validCompatibilities.push({
          lineName,
          modelName,
          cycleTime,
          efficiency,
          priority,
          row: rowNum,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        errors.push({
          row: rowNum,
          field: 'Multiple',
          message: errorMessage,
          value: null,
        });
      }
    });

    return {
      validCompatibilities,
      errors,
      stats: {
        total: rows.length,
        valid: validCompatibilities.length,
        invalid: errors.length,
        duplicates: duplicates.length,
      },
      duplicates,
    };
  }

  // ===== Helper Methods =====

  private static extractString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str === '' ? null : str;
  }

  private static extractNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;

      // Handle percentage format (e.g., "85%")
      if (trimmed.endsWith('%')) {
        const num = parseFloat(trimmed.slice(0, -1));
        return isNaN(num) ? null : num;
      }

      const parsed = parseFloat(trimmed);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private static extractBoolean(value: unknown): boolean {
    if (value === null || value === undefined) return true;

    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') return value !== 0;

    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'si';
    }

    return true;
  }
}
