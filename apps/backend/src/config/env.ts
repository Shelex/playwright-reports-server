import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { cleanEnv, num, str } from 'envalid';
import type { LLMProviderType } from '../lib/llm/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const envPaths = [
  join(__dirname, '../../../../.env'), //backend dist folder
  join(process.cwd(), '.env'), // working directory
  '/app/.env', // app root in Docker
];

for (const envPath of envPaths) {
  try {
    config({ path: envPath });
    break;
  } catch {
    // Continue to next path if this one doesn't exist
  }
}

export const env = cleanEnv(process.env, {
  PORT: num({ desc: 'Port to run the server on', default: 3001 }),
  HOST: str({ desc: 'Host to run the server on', default: '0.0.0.0' }),
  API_BASE_PATH: str({ desc: 'Base path for the API', default: '' }),
  API_TOKEN: str({ desc: 'API token for authorization', default: undefined }),
  UI_AUTH_EXPIRE_HOURS: str({
    desc: 'How much hours are allowed to keep auth session valid',
    default: '2',
  }),
  AUTH_SECRET: str({ desc: 'Secret for JWT', default: undefined }),
  DATA_STORAGE: str({ desc: 'Where to store data', default: 'fs' }),
  // s3
  S3_ENDPOINT: str({ desc: 'S3 endpoint', default: undefined }),
  S3_ACCESS_KEY: str({ desc: 'S3 access key', default: undefined }),
  S3_SECRET_KEY: str({ desc: 'S3 secret key', default: undefined }),
  S3_PORT: num({ desc: 'S3 port', default: undefined }),
  S3_REGION: str({ desc: 'S3 region', default: undefined }),
  S3_BUCKET: str({ desc: 'S3 bucket', default: 'playwright-reports-server' }),
  S3_BATCH_SIZE: num({ desc: 'S3 batch size', default: 10 }),
  S3_MULTIPART_CHUNK_SIZE_MB: num({
    desc: 'S3 multipart upload chunk size in MB',
    default: 25,
  }),
  // cleanup task
  RESULT_EXPIRE_DAYS: num({
    desc: 'How much days to keep results',
    default: undefined,
  }),
  RESULT_EXPIRE_CRON_SCHEDULE: str({
    desc: 'Cron schedule for results cleanup',
    default: '33 3 * * *',
  }),
  REPORT_EXPIRE_DAYS: num({
    desc: 'How much days to keep reports',
    default: undefined,
  }),
  REPORT_EXPIRE_CRON_SCHEDULE: str({
    desc: 'Cron schedule for reports cleanup',
    default: '44 4 * * *',
  }),
  // jira
  JIRA_BASE_URL: str({
    desc: 'Jira base URL (e.g., https://your-domain.atlassian.net)',
    default: undefined,
  }),
  JIRA_EMAIL: str({ desc: 'Jira user email', default: undefined }),
  JIRA_API_TOKEN: str({ desc: 'Jira API token', default: undefined }),
  JIRA_PROJECT_KEY: str({
    desc: 'Default Jira project key (optional)',
    default: undefined,
  }),
  // LLM
  LLM_ENABLED: str({ desc: 'Enable LLM features', default: 'false' }),
  LLM_PROVIDER: str<LLMProviderType>({
    desc: 'LLM provider (openai, anthropic)',
    default: 'openai',
    choices: ['openai', 'anthropic'],
  }),
  LLM_BASE_URL: str({ desc: 'LLM base URL', default: undefined }),
  LLM_API_KEY: str({ desc: 'LLM API key', default: undefined }),
  LLM_MODEL: str({
    desc: 'LLM model name, by default will take some model from /models endpoint',
    default: undefined,
  }),
  LLM_TEMPERATURE: num({ desc: 'LLM temperature (0-2)', default: undefined }),
});
