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
        // Robinhood's palette is rooted in black, white and neutrals with
        // pops of its signature green. The previous ink/steel ramps carried a
        // blue cast, which was the main thing reading as off-brand — these are
        // the same lightness steps with the blue removed.
        ink: {
          950: '#060606',
          900: '#0b0b0b',
          850: '#101010',
          800: '#171717',
          750: '#1d1d1d',
          700: '#242424',
          600: '#333333',
        },
        steel: {
          100: '#f4f4f4',
          200: '#dedede',
          300: '#b5b5b5',
          400: '#8e8e8e',
          500: '#6b6b6b',
          600: '#4a4a4a',
        },
        // Robinhood Green (#00C805). Overriding Tailwind's emerald scale so
        // every existing emerald-* utility picks it up without touching call
        // sites; 400 is the brand value.
        emerald: {
          300: '#4dff52',
          400: '#00c805',
          500: '#00b004',
          600: '#009103',
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
