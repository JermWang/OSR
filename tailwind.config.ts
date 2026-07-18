import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070a10',
          900: '#0b0e14',
          800: '#121722',
          700: '#1a2130',
          600: '#232c3f',
        },
        steel: {
          200: '#d5dbe6',
          300: '#aeb7c7',
          400: '#8791a5',
          500: '#5f6a80',
          600: '#454e61',
        },
        rarity: {
          common: '#b0b0b0',
          uncommon: '#4dd94d',
          rare: '#4d80ff',
          epic: '#b34dff',
          legendary: '#ffd900',
          mythic: '#ff3333',
          divine: '#ffffff',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
