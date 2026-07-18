import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        amber: {
          100: '#ffe0a3',
          200: '#ffd37d',
          300: '#ffc656',
          400: '#f5a623',
          500: '#f5a623',
          600: '#c9761a',
          700: '#9b5513',
        },
        ink: {
          950: '#06080d',
          900: '#0a0d15',
          850: '#0e131e',
          800: '#121a29',
          750: '#172033',
          700: '#1d2739',
          600: '#2a3548',
        },
        steel: {
          100: '#eef1f7',
          200: '#d5dbe6',
          300: '#aeb7c7',
          400: '#8791a5',
          500: '#5f6a80',
          600: '#414b5e',
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
