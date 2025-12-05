export * from './types.js';

import { env } from '../../config/env.js';
import { FS } from './fs.js';
import { S3 } from './s3.js';

export const storage = env.DATA_STORAGE === 's3' ? S3.getInstance() : FS;
