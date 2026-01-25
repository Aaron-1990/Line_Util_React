#!/usr/bin/env node
// ============================================
// DATABASE RESET SCRIPT
// Deletes the SQLite database file to start fresh
// Usage: npm run db:reset
// ============================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// Database location (matches Electron's app.getPath('userData'))
const APP_NAME = 'Line Optimizer';
const DB_NAME = 'line-optimizer.db';

// Get user data path based on platform
function getUserDataPath() {
  switch (process.platform) {
    case 'darwin': // macOS
      return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
    case 'win32': // Windows
      return path.join(process.env.APPDATA || '', APP_NAME);
    case 'linux':
      return path.join(os.homedir(), '.config', APP_NAME);
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function resetDatabase() {
  const userDataPath = getUserDataPath();
  const dbPath = path.join(userDataPath, DB_NAME);
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';

  console.log('Database reset script');
  console.log('=====================');
  console.log(`Platform: ${process.platform}`);
  console.log(`Database path: ${dbPath}`);
  console.log('');

  let deleted = false;

  // Delete main database file
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`Deleted: ${DB_NAME}`);
    deleted = true;
  }

  // Delete WAL file (Write-Ahead Log)
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
    console.log(`Deleted: ${DB_NAME}-wal`);
    deleted = true;
  }

  // Delete SHM file (Shared Memory)
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
    console.log(`Deleted: ${DB_NAME}-shm`);
    deleted = true;
  }

  if (deleted) {
    console.log('');
    console.log('Database reset complete. Run "npm start" to create a fresh database.');
  } else {
    console.log('No database files found. Nothing to delete.');
  }
}

// Run
try {
  resetDatabase();
} catch (error) {
  console.error('Error resetting database:', error.message);
  process.exit(1);
}
