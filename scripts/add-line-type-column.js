#!/usr/bin/env node
// ============================================
// Script to add line_type column to Excel file
// Usage: node scripts/add-line-type-column.js [input-file] [output-file]
// ============================================

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Default file paths
const DEFAULT_INPUT = path.join(__dirname, '../tests/fixtures/Copia de multi-year-production-data(Rev2).xlsx');
const DEFAULT_OUTPUT = path.join(__dirname, '../tests/fixtures/Copia de multi-year-production-data(Rev3).xlsx');

const inputFile = process.argv[2] || DEFAULT_INPUT;
const outputFile = process.argv[3] || DEFAULT_OUTPUT;

console.log('📄 Adding line_type column to Excel file');
console.log(`   Input:  ${inputFile}`);
console.log(`   Output: ${outputFile}`);

// Read the workbook
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

const workbook = XLSX.read(fs.readFileSync(inputFile), { type: 'buffer' });

// Find the Lines sheet
const linesSheetNames = ['Lines', 'lines', 'Lineas', 'lineas'];
let linesSheet = null;
let linesSheetName = null;

for (const name of workbook.SheetNames) {
  if (linesSheetNames.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
    linesSheet = workbook.Sheets[name];
    linesSheetName = name;
    break;
  }
}

if (!linesSheet) {
  console.error('❌ Lines sheet not found in workbook');
  console.log('   Available sheets:', workbook.SheetNames.join(', '));
  process.exit(1);
}

console.log(`✅ Found Lines sheet: "${linesSheetName}"`);

// Convert sheet to JSON to analyze structure
const data = XLSX.utils.sheet_to_json(linesSheet, { header: 1 });

if (data.length === 0) {
  console.error('❌ Lines sheet is empty');
  process.exit(1);
}

// Get headers (first row)
const headers = data[0];
console.log('   Current headers:', headers.join(', '));

// Check if line_type column already exists
const hasLineType = headers.some(h =>
  h && h.toLowerCase().includes('type') || h.toLowerCase().includes('tipo')
);

if (hasLineType) {
  console.log('⚠️  Line type column already exists, skipping modification');
  console.log('   Copying file without changes...');
  fs.copyFileSync(inputFile, outputFile);
  console.log(`✅ File copied to: ${outputFile}`);
  process.exit(0);
}

// Add Line Type column header after Area column
const areaIndex = headers.findIndex(h => h && h.toLowerCase().includes('area'));
const insertIndex = areaIndex >= 0 ? areaIndex + 1 : headers.length;

// Insert "Line Type" header
headers.splice(insertIndex, 0, 'Line Type');

// For data rows, add "shared" as default value
// User can manually change specific lines to "dedicated"
for (let i = 1; i < data.length; i++) {
  if (data[i] && data[i].length > 0) {
    data[i].splice(insertIndex, 0, 'shared');
  }
}

console.log('   New headers:', headers.join(', '));
console.log(`   Added "Line Type" column at position ${insertIndex + 1}`);
console.log(`   Default value: "shared" for all ${data.length - 1} lines`);

// Convert back to worksheet
const newSheet = XLSX.utils.aoa_to_sheet(data);

// Replace the sheet in workbook
workbook.Sheets[linesSheetName] = newSheet;

// Write the workbook
XLSX.writeFile(workbook, outputFile);

console.log(`\n✅ Excel file updated successfully!`);
console.log(`   Output file: ${outputFile}`);
console.log('\n📝 Next steps:');
console.log('   1. Open the Excel file and review the Lines sheet');
console.log('   2. Change "shared" to "dedicated" for unique/dedicated lines');
console.log('      (e.g., Final Assembly lines like GPEC5, GPEC5 LATAM)');
console.log('   3. Save and re-import the data');
