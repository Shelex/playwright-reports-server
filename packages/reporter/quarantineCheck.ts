import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base } from '@playwright/test';
import { DEFAULT_OPTIONS } from './config';
import type { PublicReporterOptions } from './types';

interface QuarantinedTest {
  id: string;
  reason: string;
}

export const test = base.extend<{ checkQuarantine: void }>({
  checkQuarantine: [
    // biome-ignore lint/correctness/noEmptyPattern: need an object
    async ({}, use, testInfo) => {
      console.log(`[skipQuarantinedTests] Checking quarantine for ${testInfo.testId}...`);
      const reporter = testInfo.config.reporter.find((reporter) => {
        const reporterOptions = reporter?.at(1) as PublicReporterOptions;
        if (!reporterOptions) {
          return false;
        }

        // just a most stupid assumption that this is our reporter
        return reporterOptions.enabled && reporterOptions.skipQuarantinedTests;
      });

      if (!reporter) {
        return await use();
      }

      const reporterOptions = reporter?.at(1) as PublicReporterOptions;

      if (!reporterOptions) {
        return await use();
      }

      const quarantineFilePath =
        reporterOptions.quarantineFilePath ?? DEFAULT_OPTIONS.quarantineFilePath;
      const absolutePath = resolve(quarantineFilePath);

      if (!existsSync(absolutePath)) {
        console.warn(
          `[skipQuarantinedTests] Quarantine file not found at ${absolutePath}, proceeding without skipping tests.`
        );
        return await use();
      }

      let quarantined: QuarantinedTest[] = [];
      try {
        const fileContent = readFileSync(absolutePath, 'utf-8');
        quarantined = JSON.parse(fileContent) as QuarantinedTest[];
      } catch (error) {
        console.error(`[skipQuarantinedTests] Failed to read or parse quarantine file:`, error);
        return await use();
      }

      console.log(`[skipQuarantinedTests] Loaded ${quarantined.length} quarantined tests`);
      const quarantineRecord = quarantined.find((record) => record.id === testInfo.testId);

      if (quarantineRecord) {
        console.log(`[skipQuarantinedTests] Test ${testInfo.testId} is quarantined, skipping...`);
        testInfo.skip(true, quarantineRecord.reason);
      }

      return await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
