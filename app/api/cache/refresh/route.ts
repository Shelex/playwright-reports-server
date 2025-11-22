import { revalidatePath } from 'next/cache';

import { withError } from '@/app/lib/withError';
import { forceInitDatabase } from '@/app/lib/service/db';
import { configCache } from '@/app/lib/service/cache/config';
import { lifecycle } from '@/app/lib/service/lifecycle';

export const dynamic = 'force-dynamic'; // defaults to auto

export async function POST(_: Request) {
  if (!lifecycle.isInitialized()) {
    return Response.json({ error: 'service is not initialized' }, { status: 500 });
  }

  configCache.initialized = false;
  const { error } = await withError(Promise.all([configCache.init(), forceInitDatabase()]));

  revalidatePath('/');

  if (error) {
    return Response.json({ error: error?.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
