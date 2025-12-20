import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base } from '@playwright/test';
import { DEFAULT_OPTIONS } from './config';
import type { PublicReporterOptions } from './types';

interface QuarantinedTest {
  testId: string;
  reason: string;
}

export const test = base.extend<{ checkQuarantine: void }>({
  checkQuarantine: [
    // biome-ignore lint/correctness/noEmptyPattern: need an object
    async ({}, use, testInfo) => {
      console.log(`[skipQuarantinedTests] Checking quarantine for ${testInfo.testId}...`);
      console.log(JSON.stringify(testInfo.config.reporter, null, 2));
      const reporter = testInfo.config.reporter.find((reporter) => {
        const reporterOptions = reporter?.at(1) as PublicReporterOptions;
        if (!reporterOptions) {
          return false;
        }

        // just a most stupid assumption that this is our reporter
        return reporterOptions.enabled && reporterOptions.skipQuarantinedTests;
      });

      if (!reporter) {
        await use();
        return;
      }

      const reporterOptions = reporter?.at(1) as PublicReporterOptions;

      if (!reporterOptions) {
        await use();
        return;
      }

      const quarantineFilePath =
        reporterOptions.quarantineFilePath ?? DEFAULT_OPTIONS.quarantineFilePath;
      const absolutePath = resolve(quarantineFilePath);

      if (!existsSync(absolutePath)) {
        console.warn(
          `[skipQuarantinedTests] Quarantine file not found at ${absolutePath}, skipping...`
        );
        await use();
        return;
      }

      try {
        const fileContent = readFileSync(absolutePath, 'utf-8');
        const quarantined = JSON.parse(fileContent) as QuarantinedTest[];
        console.log(`[skipQuarantinedTests] Loaded ${quarantined.length} quarantined tests`);

        const quarantineRecord = quarantined.find((record) => record.testId === testInfo.testId);
        if (quarantineRecord) {
          console.log(`[skipQuarantinedTests] Test ${testInfo.testId} is quarantined, skipping...`);
          testInfo.skip(true, quarantineRecord.reason);
        }
      } catch (error) {
        console.error(
          `[skipQuarantinedTests] Failed to read quarantine file:`,
          error instanceof Error ? error.message : String(error)
        );
      }

      console.log(`[skipQuarantinedTests] Test ${testInfo.testId} is not quarantined.`);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
