import { withError } from '../../withError.js';
import { reportDb, resultDb, testDb } from './index.js';

export const forceInitDatabase = async () => {
  const { error: cleanupError } = await withError(
    Promise.all([reportDb.clear(), resultDb.clear(), testDb.clear()])
  );

  if (cleanupError) {
    throw new Error(`failed to clear db: ${cleanupError.message}`);
  }

  reportDb.initialized = false;
  resultDb.initialized = false;

  const { error } = await withError(Promise.all([reportDb.init(), resultDb.init()]));

  if (error) {
    throw new Error(`failed to initialize db: ${error.message}`);
  }

  const { error: testRunsError } = await withError(reportDb.populateTestRuns());

  if (testRunsError) {
    throw new Error(`failed to populate test runs: ${testRunsError.message}`);
  }
};
