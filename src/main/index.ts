// ============================================
// MAIN PROCESS ENTRY POINT
// Electron Main Process
// ============================================

import { app, BrowserWindow } from 'electron';
import path from 'path';
import DatabaseConnection from './database/connection';
import { registerAllHandlers } from './ipc/handlers';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Line Optimizer',
    backgroundColor: '#f9fafb',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeApp(): void {
  try {
    DatabaseConnection.getInstance();
    console.log('Database initialized successfully');

    registerAllHandlers();
    console.log('IPC handlers registered successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}

app.on('ready', () => {
  initializeApp();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    DatabaseConnection.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  DatabaseConnection.close();
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled rejection:', error);
});
