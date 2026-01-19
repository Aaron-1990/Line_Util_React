// ============================================
// Script to generate multi-sheet test Excel file
// Run: npx ts-node scripts/generate-test-fixture.ts
// ============================================

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Ensure output directory exists
const outputDir = path.join(__dirname, '../tests/fixtures');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Lines data
const linesData = [
  ['Line Name', 'Area', 'Hours Available'],
  ['SMT-01', 'SMT', 23],
  ['SMT-02', 'SMT', 23],
  ['ICT-01', 'ICT', 23],
  ['ICT-02', 'ICT', 22],
  ['Assembly-01', 'ASSEMBLY', 21],
  ['Wave-01', 'WAVE', 23],
];

// Models data
const modelsData = [
  ['Model Name', 'Customer', 'Program', 'Family', 'Annual Volume', 'Operations Days', 'Active'],
  ['Model-A', 'Customer-1', 'Program-X', 'Family-1', 50000, 250, true],
  ['Model-B', 'Customer-1', 'Program-X', 'Family-1', 75000, 250, true],
  ['Model-C', 'Customer-2', 'Program-Y', 'Family-2', 100000, 260, true],
  ['Model-D', 'Customer-2', 'Program-Y', 'Family-2', 30000, 250, true],
  ['Model-E', 'Customer-3', 'Program-Z', 'Family-3', 45000, 240, true],
];

// Compatibilities data
const compatibilitiesData = [
  ['Line Name', 'Model Name', 'Cycle Time', 'Efficiency', 'Priority'],
  ['SMT-01', 'Model-A', 45, 85, 1],
  ['SMT-01', 'Model-B', 50, 82, 2],
  ['SMT-02', 'Model-A', 48, 83, 2],
  ['SMT-02', 'Model-C', 55, 80, 1],
  ['ICT-01', 'Model-A', 30, 90, 1],
  ['ICT-01', 'Model-B', 35, 88, 1],
  ['ICT-01', 'Model-C', 32, 87, 1],
  ['ICT-02', 'Model-D', 28, 92, 1],
  ['ICT-02', 'Model-E', 33, 85, 1],
  ['Assembly-01', 'Model-A', 120, 75, 1],
  ['Assembly-01', 'Model-B', 110, 78, 1],
  ['Assembly-01', 'Model-C', 130, 72, 1],
  ['Wave-01', 'Model-A', 25, 95, 1],
  ['Wave-01', 'Model-B', 28, 93, 1],
];

// Create workbook
const workbook = XLSX.utils.book_new();

// Add Lines sheet
const linesSheet = XLSX.utils.aoa_to_sheet(linesData);
XLSX.utils.book_append_sheet(workbook, linesSheet, 'Lines');

// Add Models sheet
const modelsSheet = XLSX.utils.aoa_to_sheet(modelsData);
XLSX.utils.book_append_sheet(workbook, modelsSheet, 'Models');

// Add Compatibilities sheet
const compatibilitiesSheet = XLSX.utils.aoa_to_sheet(compatibilitiesData);
XLSX.utils.book_append_sheet(workbook, compatibilitiesSheet, 'Compatibilities');

// Write to file
const outputPath = path.join(outputDir, 'multi-sheet-production-data.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Test fixture created at: ${outputPath}`);

// Also create a file with errors for testing validation
const errorLinesData = [
  ['Line Name', 'Area', 'Hours Available'],
  ['', 'SMT', 23], // Missing name
  ['SMT-Invalid', 'SMT', -5], // Negative hours
  ['SMT-Valid', 'SMT', 23],
];

const errorModelsData = [
  ['Model Name', 'Customer', 'Program', 'Family', 'Annual Volume', 'Operations Days', 'Active'],
  ['', 'Customer-1', 'Program-X', 'Family-1', 50000, 250, true], // Missing name
  ['Model-NegVol', 'Customer-1', 'Program-X', 'Family-1', -1000, 250, true], // Negative volume
  ['Model-BadDays', 'Customer-1', 'Program-X', 'Family-1', 50000, 400, true], // Days > 365
  ['Model-Valid', 'Customer-1', 'Program-X', 'Family-1', 50000, 250, true],
];

const errorCompatData = [
  ['Line Name', 'Model Name', 'Cycle Time', 'Efficiency', 'Priority'],
  ['NonExistent-Line', 'Model-Valid', 45, 85, 1], // Invalid line reference
  ['SMT-Valid', 'NonExistent-Model', 45, 85, 1], // Invalid model reference
  ['SMT-Valid', 'Model-Valid', -10, 85, 1], // Negative cycle time
  ['SMT-Valid', 'Model-Valid', 45, 150, 1], // Efficiency > 100
];

const errorWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(errorWorkbook, XLSX.utils.aoa_to_sheet(errorLinesData), 'Lines');
XLSX.utils.book_append_sheet(errorWorkbook, XLSX.utils.aoa_to_sheet(errorModelsData), 'Models');
XLSX.utils.book_append_sheet(errorWorkbook, XLSX.utils.aoa_to_sheet(errorCompatData), 'Compatibilities');

const errorOutputPath = path.join(outputDir, 'multi-sheet-with-errors.xlsx');
XLSX.writeFile(errorWorkbook, errorOutputPath);

console.log(`Error test fixture created at: ${errorOutputPath}`);

// Create single-sheet file for backward compatibility testing
const singleSheetWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(singleSheetWorkbook, XLSX.utils.aoa_to_sheet(linesData), 'Lines');

const singleSheetOutputPath = path.join(outputDir, 'single-sheet-lines.xlsx');
XLSX.writeFile(singleSheetWorkbook, singleSheetOutputPath);

console.log(`Single-sheet test fixture created at: ${singleSheetOutputPath}`);

console.log('\nAll test fixtures generated successfully!');
