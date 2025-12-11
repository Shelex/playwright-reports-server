import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import type { ParsedTestUrl } from './url-parser.js';

export async function injectTestAnalysis(html: string, testUrl: ParsedTestUrl): Promise<string> {
  if (!testUrl.testId || !testUrl.reportId) {
    return html;
  }

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    await injectClientSideScript(document, testUrl);
    console.log(
      `[html-injector] Successfully injected client-side script for testId: ${testUrl.testId}`
    );
    return dom.serialize();
  } catch (error) {
    console.error('[html-injector] Error injecting HTML:', error);
    return html;
  }
}

async function injectClientSideScript(document: any, testUrl: ParsedTestUrl): Promise<void> {
  const style = document.createElement('style');
  style.textContent = `
    .playwright-llm-analysis {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 8px 0;
      padding: 12px;
      border: 1px solid #e1e5e9;
      border-radius: 6px;
      background-color: #f8f9fa;
    }

    .llm-analysis-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .llm-copy-prompt-btn, .llm-analyze-btn {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      border: 1px solid;
    }

    .llm-copy-prompt-btn {
      background-color: #ffffff;
      border-color: #d1d5db;
      color: #374151;
    }

    .llm-analyze-btn {
      background-color: #3b82f6;
      border-color: #3b82f6;
      color: #ffffff;
    }

    .llm-copy-prompt-btn:hover,
    .llm-analyze-btn:hover {
      opacity: 0.8;
    }

    .llm-analyze-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .llm-analysis-result {
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
      display: none;
    }

    .llm-analysis-result.loading {
      background-color: #f9fafb;
      color: #666;
      text-align: center;
    }

    .llm-analysis-result.error {
      border-color: #ef4444;
      background-color: #fef2f2;
      color: #dc2626;
    }

    .llm-analysis-result.success {
      border-color: #10b981;
      background-color: #f0fdf4;
    }
  `;
  document.head.appendChild(style);

  const script = document.createElement('script');
  script.textContent = `
  const reportId = '${testUrl.reportId}';
  ${await fs.readFile('./src/lib/utils/llmButton.js', 'utf-8')}`;
  document.body.appendChild(script);
}
