import type Database from 'better-sqlite3';
import { storage } from '../../storage/index.js';
import type { ReadResultsInput, ReadResultsOutput, Result } from '../../storage/types.js';
import { withError } from '../../withError';
import { getDatabase } from './db';

const initiatedResultsDb = Symbol.for('playwright.reports.db.results');
const instance = globalThis as typeof globalThis & {
  [initiatedResultsDb]?: ResultDatabase;
};

export class ResultDatabase {
  public initialized = false;
  private readonly db = getDatabase();

  private readonly insertStmt: Database.Statement<
    [string, string, string | null, string, string | null, number, string]
  >;
  private readonly updateStmt: Database.Statement<
    [string, string | null, string | null, number, string, string]
  >;
  private readonly deleteStmt: Database.Statement<[string]>;
  private readonly getByIDStmt: Database.Statement<[string]>;
  private readonly getAllStmt: Database.Statement<[]>;
  private readonly getByProjectStmt: Database.Statement<[string]>;
  private readonly searchStmt: Database.Statement<[string, string, string, string]>;

  private constructor() {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO results (resultID, project, title, createdAt, size, sizeBytes, metadata, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.updateStmt = this.db.prepare(`
      UPDATE results
      SET project = ?, title = ?, size = ?, sizeBytes = ?, metadata = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE resultID = ?
    `);

    this.deleteStmt = this.db.prepare('DELETE FROM results WHERE resultID = ?');

    this.getByIDStmt = this.db.prepare('SELECT * FROM results WHERE resultID = ?');

    this.getAllStmt = this.db.prepare('SELECT * FROM results ORDER BY createdAt DESC');

    this.getByProjectStmt = this.db.prepare(
      'SELECT * FROM results WHERE project = ? ORDER BY createdAt DESC'
    );

    this.searchStmt = this.db.prepare(`
      SELECT * FROM results
      WHERE title LIKE ? OR resultID LIKE ? OR project LIKE ? OR metadata LIKE ?
      ORDER BY createdAt DESC
    `);
  }

  public static getInstance(): ResultDatabase {
    instance[initiatedResultsDb] ??= new ResultDatabase();

    return instance[initiatedResultsDb];
  }

  public async init() {
    if (this.initialized) {
      return;
    }

    console.log('[result db] initializing SQLite for results');
    const { result: resultsResponse, error } = await withError(storage.readResults());

    if (error) {
      console.error('[result db] failed to read results:', error);

      return;
    }

    if (!resultsResponse?.results?.length) {
      console.log('[result db] no results to store');
      this.initialized = true;

      return;
    }

    console.log(`[result db] caching ${resultsResponse.results.length} results`);

    const insertMany = this.db.transaction((results: Result[]) => {
      for (const result of results) {
        this.insertResult(result);
      }
    });

    insertMany(resultsResponse.results);

    this.initialized = true;
    console.log('[result db] initialization complete');
  }

  private insertResult(result: Result): void {
    const { resultID, project, title, createdAt, size, sizeBytes, ...metadata } = result;

    this.insertStmt.run(
      resultID,
      project || '',
      title || null,
      createdAt,
      size || null,
      sizeBytes || 0,
      JSON.stringify(metadata)
    );
  }

  public onDeleted(resultIds: string[]) {
    console.log(`[result db] deleting ${resultIds.length} results`);

    const deleteMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        this.deleteStmt.run(id);
      }
    });

    deleteMany(resultIds);
  }

  public onCreated(result: Result) {
    console.log(`[result db] adding result ${result.resultID}`);
    this.insertResult(result);
  }

  public onUpdated(result: Result) {
    console.log(`[result db] updating result ${result.resultID}`);
    const { resultID, project, title, size, sizeBytes, ...metadata } = result;

    this.updateStmt.run(
      project || '',
      title || null,
      size || null,
      sizeBytes || 0,
      JSON.stringify(metadata),
      resultID
    );
  }

  public getAll(): Result[] {
    const rows = this.getAllStmt.all() as Array<{
      resultID: string;
      project: string;
      title: string | null;
      createdAt: string;
      size: string | null;
      sizeBytes: number;
      metadata: string;
    }>;

    return rows.map(this.rowToResult);
  }

  public getByID(resultID: string): Result | undefined {
    const row = this.getByIDStmt.get(resultID) as
      | {
          resultID: string;
          project: string;
          title: string | null;
          createdAt: string;
          size: string | null;
          sizeBytes: number;
          metadata: string;
        }
      | undefined;

    return row ? this.rowToResult(row) : undefined;
  }

  public getByProject(project: string): Result[] {
    const rows = this.getByProjectStmt.all(project) as Array<{
      resultID: string;
      project: string;
      title: string | null;
      createdAt: string;
      size: string | null;
      sizeBytes: number;
      metadata: string;
    }>;

    return rows.map(this.rowToResult);
  }

  public search(query: string): Result[] {
    const searchPattern = `%${query}%`;
    const rows = this.searchStmt.all(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    ) as Array<{
      resultID: string;
      project: string;
      title: string | null;
      createdAt: string;
      size: string | null;
      sizeBytes: number;
      metadata: string;
    }>;

    return rows.map(this.rowToResult);
  }

  public getCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM results').get() as {
      count: number;
    };

    return result.count;
  }

  public clear(): void {
    console.log('[result db] clearing all results');
    this.db.prepare('DELETE FROM results').run();
  }

  public query(input?: ReadResultsInput): ReadResultsOutput {
    let query = 'SELECT * FROM results';
    const params: string[] = [];
    const conditions: string[] = [];

    if (input?.project) {
      conditions.push('project = ?');
      params.push(input.project);
    }

    if (input?.testRun) {
      conditions.push('metadata LIKE ?');
      params.push(`%"testRun":"${input.testRun}"%`);
    }

    if (input?.tags && input.tags.length > 0) {
      console.log('Filtering by tags:', input.tags);

      for (const tag of input.tags) {
        const [key, value] = tag.split(':').map((part) => part.trim());

        conditions.push('metadata LIKE ?');
        params.push(`%"${key}":"${value}"%`);
      }
    }

    if (input?.search?.trim()) {
      const searchTerm = `%${input.search.toLowerCase().trim()}%`;

      conditions.push(
        '(LOWER(title) LIKE ? OR LOWER(resultID) LIKE ? OR LOWER(project) LIKE ? OR LOWER(metadata) LIKE ?)'
      );
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY createdAt DESC';

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = this.db.prepare(countQuery).get(...params) as {
      count: number;
    };
    const total = countResult.count;

    if (input?.pagination) {
      query += ' LIMIT ? OFFSET ?';
      params.push(input.pagination.limit.toString(), input.pagination.offset.toString());
    }

    console.log('Executing query:', query, 'with params:', params);

    const rows = this.db.prepare(query).all(...params) as Array<{
      resultID: string;
      project: string;
      title: string | null;
      createdAt: string;
      size: string | null;
      sizeBytes: number;
      metadata: string;
    }>;

    return {
      results: rows.map((row) => this.rowToResult(row)),
      total,
    };
  }

  public async refresh(): Promise<void> {
    console.log('[result db] refreshing cache');
    this.clear();
    this.initialized = false;
    // Re-initialize immediately by reading from filesystem
    await this.init();
  }

  private rowToResult(row: {
    resultID: string;
    project: string;
    title: string | null;
    createdAt: string;
    size: string | null;
    sizeBytes: number;
    metadata: string;
  }): Result {
    const metadata = JSON.parse(row.metadata || '{}');

    return {
      resultID: row.resultID,
      project: row.project,
      title: row.title || undefined,
      createdAt: row.createdAt,
      size: row.size || undefined,
      sizeBytes: row.sizeBytes,
      ...metadata,
    };
  }
}

export const resultDb = ResultDatabase.getInstance();
