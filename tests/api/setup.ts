/**
 * Test Setup and Teardown Utilities
 *
 * This module provides utilities for managing test environment,
 * server health checks, cleanup operations, and debugging capabilities
 * for Playwright API tests.
 */

import { test as base } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Test configuration constants
export const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  HEALTH_CHECK_ENDPOINT: '/api/info',
  HEALTH_CHECK_TIMEOUT: 30000, // 30 seconds
  HEALTH_CHECK_INTERVAL: 1000,  // 1 second
  SERVER_STARTUP_TIMEOUT: 120000, // 2 minutes (matches playwright.config.ts)
  TEST_LOCK_FILE: '/tmp/playwright-reports-backend-test.lock',
  TEST_PID_FILE: '/tmp/playwright-reports-backend-test.pid',
  SERVER_LOG_FILE: '/tmp/test-server.log',
  CLEANUP_LOCK_FILE: '/tmp/playwright-test-cleanup.lock',
} as const;

/**
 * Error types for test environment management
 */
export class TestEnvironmentError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'TestEnvironmentError';
  }
}

export class ServerHealthError extends TestEnvironmentError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ServerHealthError';
  }
}

export class CleanupError extends TestEnvironmentError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'CleanupError';
  }
}

/**
 * Server health check utilities
 */
export class ServerHealthChecker {
  private readonly baseUrl: string;
  private readonly healthEndpoint: string;

  constructor(baseUrl: string = TEST_CONFIG.BASE_URL, healthEndpoint: string = TEST_CONFIG.HEALTH_CHECK_ENDPOINT) {
    this.baseUrl = baseUrl;
    this.healthEndpoint = healthEndpoint;
  }

  /**
   * Perform a single health check against the server
   */
  async checkHealth(): Promise<boolean> {
    try {
      const healthUrl = `${this.baseUrl}${this.healthEndpoint}`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Don't follow redirects - we want to check the actual server
        redirect: 'manual',
      });

      // Consider it healthy if we get any response (not a connection error)
      return response.status < 500;
    } catch (error) {
      // Connection errors (ECONNRESET, ECONNREFUSED) mean server is not healthy
      if (error instanceof Error && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      )) {
        return false;
      }
      // Other errors might be temporary, log but don't fail immediately
      console.warn(`[TestSetup] Health check warning: ${error.message}`);
      return true;
    }
  }

  /**
   * Wait for server to become healthy with timeout
   */
  async waitForHealthy(timeout: number = TEST_CONFIG.HEALTH_CHECK_TIMEOUT): Promise<void> {
    const startTime = Date.now();
    const maxAttempts = Math.floor(timeout / TEST_CONFIG.HEALTH_CHECK_INTERVAL);
    let attempts = 0;

    console.log(`[TestSetup] Waiting for server to become healthy...`);

    while (attempts < maxAttempts) {
      attempts++;

      if (await this.checkHealth()) {
        console.log(`[TestSetup] ✅ Server is healthy after ${attempts} attempts (${Date.now() - startTime}ms)`);
        return;
      }

      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.HEALTH_CHECK_INTERVAL));
      }
    }

    throw new ServerHealthError(
      `Server failed to become healthy after ${attempts} attempts and ${timeout}ms`
    );
  }

  /**
   * Check if server is responsive (more comprehensive than just health check)
   */
  async isResponsive(): Promise<boolean> {
    try {
      // Try both health check and a simple API call
      const [isHealthy, apiWorks] = await Promise.allSettled([
        this.checkHealth(),
        fetch(`${this.baseUrl}/api/info`).then(r => r.ok)
      ]);

      return apiWorks.status === 'fulfilled' && apiWorks.value === true;
    } catch {
      return false;
    }
  }
}

/**
 * Test environment cleanup utilities
 */
export class TestEnvironmentCleaner {
  private readonly config: typeof TEST_CONFIG;

  constructor(config: typeof TEST_CONFIG = TEST_CONFIG) {
    this.config = config;
  }

  /**
   * Clean up test-specific files and processes
   */
  async cleanup(): Promise<void> {
    console.log('[TestSetup] 🧹 Cleaning up test environment...');

    const cleanupTasks = [
      this.cleanupTestLockFiles(),
      this.cleanupTempFiles(),
      this.cleanupOrphanedProcesses(),
      this.cleanupServerLogs(),
    ];

    const results = await Promise.allSettled(cleanupTasks);
    const failures = results.filter(result => result.status === 'rejected');

    if (failures.length > 0) {
      const errorMessages = failures.map(f =>
        f.status === 'rejected' ? f.reason?.message || 'Unknown error' : ''
      ).filter(Boolean);

      console.warn(`[TestSetup] ⚠️  Some cleanup tasks failed: ${errorMessages.join(', ')}`);
    } else {
      console.log('[TestSetup] ✅ Test environment cleaned up successfully');
    }
  }

  /**
   * Clean up test-specific lock files
   */
  private async cleanupTestLockFiles(): Promise<void> {
    const lockFiles = [
      this.config.TEST_LOCK_FILE,
      this.config.TEST_PID_FILE,
      this.config.CLEANUP_LOCK_FILE,
    ];

    await Promise.all(
      lockFiles.map(async (lockFile) => {
        try {
          await fs.unlink(lockFile);
        } catch (error) {
          // Ignore file not found errors
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      })
    );
  }

  /**
   * Clean up temporary test files
   */
  private async cleanupTempFiles(): Promise<void> {
    const tempPatterns = [
      '/tmp/playwright-test-*',
      '/tmp/test-results-*',
      this.config.SERVER_LOG_FILE,
    ];

    // This is a simplified cleanup - in a real scenario you might want more sophisticated temp file management
    for (const pattern of tempPatterns) {
      try {
        await execAsync(`rm -f ${pattern} 2>/dev/null || true`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Clean up orphaned processes related to testing
   */
  private async cleanupOrphanedProcesses(): Promise<void> {
    try {
      // Kill any processes that might be related to test servers
      const { stdout } = await execAsync(`lsof -ti :3001 2>/dev/null || true`);
      if (stdout.trim()) {
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          try {
            await execAsync(`kill -TERM ${pid} 2>/dev/null || true`);
          } catch {
            // Process might already be dead
          }
        }

        // Wait a bit and force kill if still running
        await new Promise(resolve => setTimeout(resolve, 1000));
        for (const pid of pids) {
          try {
            await execAsync(`kill -0 ${pid} 2>/dev/null && kill -KILL ${pid} 2>/dev/null || true`);
          } catch {
            // Process is dead
          }
        }
      }
    } catch {
      // Ignore process cleanup errors
    }
  }

  /**
   * Clean up server logs
   */
  private async cleanupServerLogs(): Promise<void> {
    try {
      await fs.unlink(this.config.SERVER_LOG_FILE);
    } catch (error) {
      // Ignore file not found errors
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Create cleanup lock to prevent concurrent cleanups
   */
  async acquireCleanupLock(): Promise<boolean> {
    try {
      await fs.writeFile(this.config.CLEANUP_LOCK_FILE, process.pid.toString(), { flag: 'wx' });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return false; // Lock already exists
      }
      throw error;
    }
  }

  /**
   * Release cleanup lock
   */
  async releaseCleanupLock(): Promise<void> {
    try {
      await fs.unlink(this.config.CLEANUP_LOCK_FILE);
    } catch (error) {
      // Ignore file not found errors
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

/**
 * Test debugging and monitoring utilities
 */
export class TestDebugger {
  private readonly config: typeof TEST_CONFIG;

  constructor(config: typeof TEST_CONFIG = TEST_CONFIG) {
    this.config = config;
  }

  /**
   * Get recent server logs for debugging
   */
  async getServerLogs(lines: number = 50): Promise<string> {
    try {
      const { stdout } = await execAsync(`tail -${lines} ${this.config.SERVER_LOG_FILE} 2>/dev/null || echo "No server log file found"`);
      return stdout;
    } catch {
      return 'No server logs available';
    }
  }

  /**
   * Check if test server process is running
   */
  async isTestServerRunning(): Promise<boolean> {
    try {
      if (!await this.fileExists(this.config.TEST_PID_FILE)) {
        return false;
      }

      const pidContent = await fs.readFile(this.config.TEST_PID_FILE, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);

      if (isNaN(pid)) {
        return false;
      }

      // Check if process is still running
      await execAsync(`kill -0 ${pid}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get system information for debugging
   */
  async getSystemInfo(): Promise<Record<string, string>> {
    try {
      const commands = {
        'processes_on_3001': 'lsof -ti :3001 2>/dev/null | wc -l || echo "0"',
        'node_processes': 'pgrep -c node 2>/dev/null || echo "0"',
        'memory_usage': 'free -m 2>/dev/null || vm_stat 2>/dev/null || echo "N/A"',
        'disk_space': 'df -h /tmp 2>/dev/null || echo "N/A"',
      };

      const results: Record<string, string> = {};

      for (const [key, command] of Object.entries(commands)) {
        try {
          const { stdout } = await execAsync(command);
          results[key] = stdout.trim();
        } catch {
          results[key] = 'N/A';
        }
      }

      return results;
    } catch {
      return {};
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Enhanced test fixture with setup and teardown utilities
 */
export const test = base.extend<{
  healthChecker: ServerHealthChecker;
  cleaner: TestEnvironmentCleaner;
  debugger: TestDebugger;
}>({
  healthChecker: async ({}, use) => {
    const checker = new ServerHealthChecker();
    await use(checker);
  },
  cleaner: async ({}, use) => {
    const cleaner = new TestEnvironmentCleaner();
    await use(cleaner);
  },
  debugger: async ({}, use) => {
    const debugger_ = new TestDebugger();
    await use(debugger_);
  },
});

/**
 * Global test setup and teardown hooks
 */
export const setupTestEnvironment = async () => {
  console.log('[TestSetup] 🚀 Setting up test environment...');

  const cleaner = new TestEnvironmentCleaner();
  const healthChecker = new ServerHealthChecker();

  try {
    // Acquire cleanup lock to prevent concurrent cleanup operations
    const lockAcquired = await cleaner.acquireCleanupLock();
    if (lockAcquired) {
      try {
        // Clean up any previous test runs
        await cleaner.cleanup();
      } finally {
        await cleaner.releaseCleanupLock();
      }
    }

    // Wait for server to be healthy
    await healthChecker.waitForHealthy();

    console.log('[TestSetup] ✅ Test environment is ready');
  } catch (error) {
    console.error('[TestSetup] ❌ Test setup failed:', error);
    throw error;
  }
};

export const teardownTestEnvironment = async () => {
  console.log('[TestSetup] 🧹 Tearing down test environment...');

  const cleaner = new TestEnvironmentCleaner();

  try {
    const lockAcquired = await cleaner.acquireCleanupLock();
    if (lockAcquired) {
      try {
        await cleaner.cleanup();
      } finally {
        await cleaner.releaseCleanupLock();
      }
    }

    console.log('[TestSetup] ✅ Test teardown completed');
  } catch (error) {
    console.error('[TestSetup] ❌ Test teardown failed:', error);
    // Don't throw - teardown failures shouldn't fail the test run
  }
};

/**
 * Utility function to run tests with proper setup/teardown
 */
export const runTestsWithSetup = async (testFunction: () => Promise<void>) => {
  await setupTestEnvironment();

  try {
    await testFunction();
  } finally {
    await teardownTestEnvironment();
  }
};

// Export all utilities for use in test files
export {
  ServerHealthChecker as HealthChecker,
  TestEnvironmentCleaner as Cleaner,
  TestDebugger as Debugger,
};