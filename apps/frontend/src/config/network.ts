export const withQueryParams = (url: string, params: Record<string, string>): string => {
  const searchParams = new URLSearchParams(params);
  const stringified = searchParams.toString();

  return `${url}?${stringified}`;
};
