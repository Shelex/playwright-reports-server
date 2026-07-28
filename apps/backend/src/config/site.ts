import type { HeaderLink } from '@playwright-reports/shared';

export const defaultLinks: HeaderLink[] = [
  {
    id: 'default-docs',
    label: 'Docs',
    url: 'https://shelex.github.io/playwright-reports-server/',
    icon: 'github',
    showLabel: true,
  },
  {
    id: 'default-github',
    label: 'GitHub',
    url: 'https://github.com/Shelex/playwright-reports-server',
    icon: 'github',
  },
];
