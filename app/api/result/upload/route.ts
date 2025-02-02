import { handleResultFileStream } from '@/app/lib/storage/stream';
import { withError } from '@/app/lib/withError';

export const dynamic = 'force-dynamic'; // defaults to auto

export async function PUT(request: Request) {
  if (!request.body) {
    return Response.json({ error: 'request body is required' }, { status: 400 });
  }

  const { result: savedResult, error } = await withError(handleResultFileStream(request));

  if (error) {
    return Response.json({ error: `failed to save results: ${error.message}` }, { status: 500 });
  }

  return Response.json({
    message: 'Success',
    data: savedResult,
    status: 201,
  });
}
