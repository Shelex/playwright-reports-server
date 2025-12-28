import { configCache } from './cache/config.js';
import { cronService } from './cron.js';
import { reportDb, resultDb } from './db/index.js';
import { litestreamService } from './litestream.js';

const createdLifecycle = Symbol.for('playwright.reports.lifecycle');
const instance = globalThis as typeof globalThis & {
  [createdLifecycle]?: Lifecycle;
};

export class Lifecycle {
  private initialized = false;
  private initPromise?: Promise<void>;

  public static getInstance(): Lifecycle {
    instance[createdLifecycle] ??= new Lifecycle();

    return instance[createdLifecycle];
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    this.initPromise ??= this._performInitialization();

    return this.initPromise;
  }

  private async _performInitialization(): Promise<void> {
    console.log('[lifecycle] Starting application initialization');

    try {
      const restored = await litestreamService.restoreIfNeeded();

      if (!restored) {
        await Promise.all([configCache.init(), reportDb.init(), resultDb.init()]);
        await reportDb.populateTestRuns();
        console.log('[lifecycle] Databases initialized successfully');
      }

      await litestreamService.start();

      if (!cronService.initialized) {
        await cronService.init();
        console.log('[lifecycle] Cron service initialized successfully');
      }

      this.initialized = true;
      console.log('[lifecycle] Application initialization complete');
    } catch (error) {
      console.error('[lifecycle] Initialization failed:', error);
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async cleanup(): Promise<void> {
    if (!this.initialized) return;

    console.log('[lifecycle] Starting application cleanup');

    try {
      if (cronService.initialized) {
        await cronService.restart();
        console.log('[lifecycle] Cron service stopped');
      }

      await litestreamService.stop();

      console.log('[lifecycle] Application cleanup complete');
    } catch (error) {
      console.error('[lifecycle] Cleanup failed:', error);
    }
  }
}

export const lifecycle = Lifecycle.getInstance();
