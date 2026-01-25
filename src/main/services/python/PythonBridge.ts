// ============================================
// PYTHON BRIDGE SERVICE
// Executes Python optimization script and handles results
// ============================================

import { spawn, ChildProcess } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { OptimizationResult } from '@shared/types';

export class PythonBridge {
  private process: ChildProcess | null = null;
  private cancelled = false;

  /**
   * Get the path to the Python optimizer script
   */
  private getOptimizerPath(): string {
    // In development, use the Optimizer directory
    // In production, it would be bundled with the app
    const isDev = !app.isPackaged;

    if (isDev) {
      // Development: use the Optimizer directory in the project
      return join(app.getAppPath(), 'Optimizer', 'optimizer.py');
    } else {
      // Production: use bundled script in resources
      return join(process.resourcesPath, 'python', 'optimizer.py');
    }
  }

  /**
   * Find Python executable
   */
  private async findPython(): Promise<string> {
    // Try common Python paths
    const pythonPaths = ['python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3'];

    for (const pythonPath of pythonPaths) {
      try {
        const result = await this.execCommand(pythonPath, ['--version']);
        if (result.includes('Python')) {
          console.log(`[PythonBridge] Found Python: ${pythonPath}`);
          return pythonPath;
        }
      } catch {
        // Continue to next path
      }
    }

    throw new Error('Python 3 not found. Please install Python 3 and ensure it is in your PATH.');
  }

  /**
   * Execute a command and return stdout
   */
  private execCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Run the optimization algorithm
   * @param inputPath - Path to JSON input file
   * @param outputPath - Path where JSON output will be written
   * @returns OptimizationResult
   */
  async runOptimization(inputPath: string, outputPath: string): Promise<OptimizationResult> {
    this.cancelled = false;

    // Find Python
    const pythonPath = await this.findPython();

    // Get optimizer script path
    const optimizerPath = this.getOptimizerPath();

    // Check if optimizer exists
    if (!existsSync(optimizerPath)) {
      throw new Error(`Optimizer script not found at: ${optimizerPath}`);
    }

    console.log('[PythonBridge] Running optimization...');
    console.log('[PythonBridge] Python:', pythonPath);
    console.log('[PythonBridge] Script:', optimizerPath);
    console.log('[PythonBridge] Input:', inputPath);
    console.log('[PythonBridge] Output:', outputPath);

    return new Promise((resolve, reject) => {
      const args = [optimizerPath, '--input', inputPath, '--output', outputPath];

      this.process = spawn(pythonPath, args, {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let stdout = '';
      let stderr = '';

      this.process.stdout?.on('data', (data) => {
        const message = data.toString();
        stdout += message;
        console.log('[Python]', message.trim());
      });

      this.process.stderr?.on('data', (data) => {
        const message = data.toString();
        stderr += message;
        console.error('[Python Error]', message.trim());
      });

      this.process.on('close', async (code) => {
        this.process = null;

        if (this.cancelled) {
          reject(new Error('Optimization cancelled by user'));
          return;
        }

        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Read output file
          if (!existsSync(outputPath)) {
            reject(new Error('Optimization output file not found'));
            return;
          }

          const outputContent = await readFile(outputPath, 'utf-8');
          const result = JSON.parse(outputContent) as OptimizationResult;
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse optimization results: ${error}`));
        }
      });

      this.process.on('error', (error) => {
        this.process = null;
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Cancel running optimization
   */
  cancel(): void {
    this.cancelled = true;
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
