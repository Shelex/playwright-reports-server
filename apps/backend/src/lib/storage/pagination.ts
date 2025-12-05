export interface Pagination {
  limit: number;
  offset: number;
}

export const parseFromRequest = (searchParams: URLSearchParams): Pagination => {
  const limitQuery = searchParams.get('limit') ?? '';
  const offsetQuery = searchParams.get('offset') ?? '';

  const limit = limitQuery ? Number.parseInt(limitQuery, 10) : 20;
  const offset = offsetQuery ? Number.parseInt(offsetQuery, 10) : 0;

  return { limit, offset };
};
