import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const initiatedDb = Symbol.for('playwright.reports.db');
const instance = globalThis as typeof globalThis & {
  [initiatedDb]?: Database.Database;
};

export function createDatabase(): Database.Database {
  if (instance[initiatedDb]) {
    return instance[initiatedDb];
  }

  const dbDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'metadata.db');

  console.log(`[db] creating database at ${dbPath}`);

  const db = new Database(dbPath, {
    verbose: undefined, // for debugging: console.log
  });

  db.pragma('journal_mode = WAL'); // better concurrency
  db.pragma('synchronous = NORMAL'); // faster writes, still safe with WAL
  db.pragma('cache_size = -8000'); // 8MB page cache (balance of speed and memory)
  db.pragma('mmap_size = 134217728'); // 128MB memory-mapped I/O
  db.pragma('temp_store = MEMORY'); // store temporary tables in RAM
  db.pragma('foreign_keys = ON'); // enforce referential integrity
  db.pragma('auto_vacuum = INCREMENTAL'); // manage file size

  console.log('[db] database is configured');

  initializeSchema(db);
  instance[initiatedDb] = db;

  return db;
}

function initializeSchema(db: Database.Database): void {
  console.log('[db] initializing schema');

  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      resultID TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      title TEXT,
      createdAt TEXT NOT NULL,
      size TEXT,
      sizeBytes INTEGER,
      metadata TEXT, -- JSON string for additional metadata
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_results_ids ON results(resultID);
    CREATE INDEX IF NOT EXISTS idx_results_project ON results(project);
    CREATE INDEX IF NOT EXISTS idx_results_createdAt ON results(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_results_updatedAt ON results(updatedAt DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      reportID TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      title TEXT,
      displayNumber INTEGER,
      createdAt TEXT NOT NULL,
      reportUrl TEXT NOT NULL,
      size TEXT,
      sizeBytes INTEGER,
      stats TEXT, -- JSON string for report stats
      metadata TEXT, -- JSON string for additional metadata
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_reports_ids ON reports(reportID);
    CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project);
    CREATE INDEX IF NOT EXISTS idx_reports_createdAt ON reports(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_updatedAt ON reports(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_displayNumber ON reports(displayNumber);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cache_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS failure_analyses (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      test_id TEXT NOT NULL,
      test_title TEXT,
      failed_step_index INTEGER,
      root_cause TEXT,
      confidence TEXT,
      debugging_steps TEXT,
      code_fix TEXT,
      prevention_strategy TEXT,
      model TEXT,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_failure_analyses_report ON failure_analyses(report_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_failure_analyses_test ON failure_analyses(test_id);
  `);

  console.log('[db] schema initialized');
}

export function getDatabase(): Database.Database {
  if (!instance[initiatedDb]) {
    return createDatabase();
  }

  return instance[initiatedDb];
}

export function closeDatabase(): void {
  if (instance[initiatedDb]) {
    console.log('[db] closing database connection');
    const db = getDatabase();

    db.close();
    instance[initiatedDb] = undefined;
  }
}

export function getDatabaseStats(): {
  results: number;
  reports: number;
  sizeOnDisk: string;
  estimatedRAM: string;
} {
  const db = getDatabase();

  const resultsCount = db.prepare('SELECT COUNT(*) as count FROM results').get() as {
    count: number;
  };
  const reportsCount = db.prepare('SELECT COUNT(*) as count FROM reports').get() as {
    count: number;
  };

  const stats = {
    pageCount: db.pragma('page_count', { simple: true }) as number,
    pageSize: db.pragma('page_size', { simple: true }) as number,
    cacheSize: db.pragma('cache_size', { simple: true }) as number,
  };

  const dbSizeBytes = stats.pageCount * stats.pageSize;
  const cacheSizeBytes = Math.abs(stats.cacheSize) * (stats.cacheSize < 0 ? 1024 : stats.pageSize);

  return {
    results: resultsCount.count,
    reports: reportsCount.count,
    sizeOnDisk: `${(dbSizeBytes / 1024 / 1024).toFixed(2)} MB`,
    estimatedRAM: `~${(cacheSizeBytes / 1024 / 1024).toFixed(2)} MB`,
  };
}

export function clearAll(): void {
  const db = getDatabase();

  console.log('[db] clearing all data');

  db.exec(`
    DELETE FROM results;
    DELETE FROM reports;
    DELETE FROM cache_metadata;
  `);

  db.exec('VACUUM;');

  console.log('[db] cleared');
}

export function optimizeDB(): void {
  const db = getDatabase();

  console.log('[db] optimizing database');

  db.exec('ANALYZE;');
  db.exec('PRAGMA incremental_vacuum;');

  console.log('[db] optimization complete');
}
