import type { SiteWhiteLabelConfig } from '@playwright-reports/shared';
import { defaultConfig } from '../../config.js';
import { storage } from '../../storage/index.js';

const initiatedConfigDb = Symbol.for('playwright.reports.db.config');
const instance = globalThis as typeof globalThis & {
  [initiatedConfigDb]?: ConfigCache;
};

export class ConfigCache {
  public initialized = false;
  public config: SiteWhiteLabelConfig | undefined;

  private constructor() {}

  public static getInstance() {
    instance[initiatedConfigDb] ??= new ConfigCache();

    return instance[initiatedConfigDb];
  }

  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[config cache] initializing cache');
    const { result, error } = await storage.readConfigFile();

    if (error) {
      if (error.message.includes('Error: no config')) {
        console.warn('[config cache] using default config');
      }
      console.error('[config cache] failed to read config file');
      return;
    }

    const cache = ConfigCache.getInstance();

    cache.config = result ?? defaultConfig;
    console.log('[config cache] initialized with config:', cache.config);

    this.initialized = true;
  }

  public onChanged(config: SiteWhiteLabelConfig) {
    this.config = config;
  }

  public refresh(): void {
    console.log('[config cache] refreshing cache');
    this.initialized = false;
    this.config = undefined;
  }
}

export const configCache = ConfigCache.getInstance();
