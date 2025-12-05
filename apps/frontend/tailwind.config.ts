import type { Config } from 'tailwindcss';

import { heroui } from '@heroui/theme';

const config = {
  content: ['./src/**/*.{js,ts,tsx,mdx}', './index.html', './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      layout: {
        borderWidth: {
          small: '1px',
          medium: '1px',
          large: '2px',
        },
        radius: {
          small: '4px',
          medium: '6px',
          large: '8px',
        },
      },
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: '#2C5677',
            },
          },
        },
      },
    }),
  ],
} satisfies Config;

export default config;
