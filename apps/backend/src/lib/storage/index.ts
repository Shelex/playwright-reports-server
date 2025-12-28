export * from './types.js';
export type { Storage } from './types.js';

import { env } from '../../config/env.js';
import { FS } from './fs.js';
import { S3 } from './s3.js';
import type { Storage } from './types.js';

export const storage: Storage = env.DATA_STORAGE === 's3' ? S3.getInstance() : FS;
