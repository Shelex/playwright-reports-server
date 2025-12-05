export const withBase = (p = '') => {
  const base = (import.meta.env.VITE_API_BASE_PATH || '').replace(/\/+$/, '');
  const path = p.startsWith('/') ? p : `/${p}`;

  return `${base}${path}`;
};
