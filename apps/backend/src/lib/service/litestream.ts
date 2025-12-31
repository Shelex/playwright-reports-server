import { type ChildProcess, exec, spawn } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { withError } from '../withError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const litestreamProcess = Symbol.for('playwright.reports.litestream');
const instance = globalThis as typeof globalThis & {
  [litestreamProcess]?: LitestreamService;
};

/**
 * Service to manage Litestream process for SQLite replication to S3.
 * @link https://litestream.io/
 */
export class LitestreamService {
  private process: ChildProcess | null = null;
  private readonly configPath: string;
  private readonly dbPath: string;

  private constructor() {
    this.configPath = this.resolveConfigPath();
    this.dbPath = path.join(process.cwd(), 'data', 'metadata.db');
  }

  private get usesS3() {
    return env.DATA_STORAGE === 's3';
  }

  private resolveConfigPath(): string {
    const dockerPath = '/app/litestream.yml';
    const localPath = path.join(__dirname, '..', '..', '..', '..', 'litestream.yml');

    try {
      fs.accessSync(dockerPath);
      return dockerPath;
    } catch {
      return localPath;
    }
  }

  public static getInstance(): LitestreamService {
    instance[litestreamProcess] ??= new LitestreamService();
    return instance[litestreamProcess];
  }

  public async restoreIfNeeded(): Promise<boolean> {
    if (!this.usesS3) {
      return false;
    }

    const dbExists = await this.databaseExists();

    if (!dbExists) {
      console.log('[litestream] No local sqlite found, attempting restore from S3...');
      const restored = await this.restoreFromS3();
      if (restored) {
        console.log('[litestream] Successfully restored sqlite from S3');
      } else {
        console.log('[litestream] No sqlite found on S3, will start fresh');
      }
      return restored;
    }

    console.log('[litestream] Local sqlite exists, checking if remote is newer...');
    const hasRemote = await this.hasRemoteBackup();

    if (!hasRemote) {
      console.log('[litestream] No remote backup found, using local copy');
      return false;
    }

    console.log('[litestream] Remote backup exists, syncing with remote...');
    const synced = await this.syncWithRemote();

    if (synced) {
      console.log('[litestream] Successfully synced with remote backup');
    } else {
      console.log('[litestream] Sync failed, continuing with local copy');
    }

    return synced;
  }

  private async databaseExists(): Promise<boolean> {
    try {
      await fsPromises.access(this.dbPath);
      return true;
    } catch {
      return false;
    }
  }

  private async hasRemoteBackup(): Promise<boolean> {
    const litestreamEnv = this.buildLitestreamEnv();

    return new Promise((resolve) => {
      exec(
        `litestream generations -config ${this.configPath}`,
        { env: litestreamEnv, timeout: 30000 },
        (error, stdout) => {
          if (error) {
            console.error('[litestream] Failed to check remote generations:', error.message);
            resolve(false);
          } else {
            const hasGenerations = stdout.trim().length > 0;
            resolve(hasGenerations);
          }
        }
      );
    });
  }

  private async syncWithRemote(): Promise<boolean> {
    const litestreamEnv = this.buildLitestreamEnv();

    return new Promise((resolve) => {
      exec(
        `litestream restore -config ${this.configPath} -o ${this.dbPath} --if-replica-exists`,
        { env: litestreamEnv, timeout: 60000 },
        (error) => {
          if (error) {
            console.error('[litestream] Sync with remote failed:', error.message);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  private async restoreFromS3(): Promise<boolean> {
    const litestreamEnv = this.buildLitestreamEnv();

    return new Promise((resolve) => {
      exec(
        `litestream restore -config ${this.configPath} -o ${this.dbPath}`,
        { env: litestreamEnv, timeout: 60000 },
        (error) => {
          if (error) {
            console.error('[litestream] Restore failed:', error.message);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  private buildLitestreamEnv() {
    return {
      ...process.env,
      S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: env.S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY,
      S3_BUCKET: env.S3_BUCKET || process.env.S3_BUCKET,
      S3_REGION: env.S3_REGION || process.env.S3_REGION,
      S3_ENDPOINT: env.S3_ENDPOINT || process.env.S3_ENDPOINT,
      S3_PATH: 'litestream',
      S3_FORCE_PATH_STYLE: 'true',
    };
  }

  public async start(): Promise<void> {
    if (!this.usesS3) {
      return;
    }

    if (this.process) {
      console.log('[litestream] Process already running');
      return;
    }

    const { error } = await withError(fsPromises.access(this.configPath));

    if (error) {
      console.warn('[litestream] Config file not found, skipping replication');
      return;
    }

    const dbExists = await this.databaseExists();
    if (!dbExists) {
      console.warn('[litestream] Database file not found, skipping replication');
      return;
    }

    exec('which litestream', (error) => {
      if (error) {
        console.warn('[litestream] Litestream binary not found, skipping replication');
        console.warn('[litestream] Install with: https://litestream.io/install/');
        return;
      }
    });

    console.log('[litestream] Starting replication process');
    console.log(`[litestream] Config: ${this.configPath}`);
    console.log(`[litestream] Database: ${this.dbPath}`);

    const litestreamEnv = this.buildLitestreamEnv();

    this.process = spawn('litestream', ['replicate', '-config', this.configPath], {
      stdio: 'pipe',
      env: litestreamEnv,
    });

    this.process.stdout?.on('data', (data) => {
      console.log(`[litestream] ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[litestream] ${data.toString().trim()}`);
    });

    this.process.on('error', (error) => {
      console.error('[litestream] Process error:', error);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[litestream] Process exited with code ${code} and signal ${signal}`);
      this.process = null;
    });

    console.log('[litestream] Replication starting...');
  }

  public async stop(): Promise<void> {
    if (!this.usesS3) {
      return;
    }

    if (!this.process) {
      console.log('[litestream] No process to stop');
      return;
    }

    console.log('[litestream] Stopping replication process');

    this.process.kill('SIGTERM');

    // wait for process to exit or timeout after 5 seconds
    await Promise.race([
      new Promise<void>((resolve) => {
        this.process?.on('exit', () => resolve());
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);

    if (this.process && !this.process.killed) {
      console.log('[litestream] Force killing process');
      this.process.kill('SIGKILL');
    }

    this.process = null;
    console.log('[litestream] Replication stopped');
  }

  public isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export const litestreamService = LitestreamService.getInstance();
