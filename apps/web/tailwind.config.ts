import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand-rgb) / <alpha-value>)',
          foreground: '#FFFFFF',
        },
        status: {
          green: '#1D9E75',
          amber: '#EF9F27',
          red: '#E24B4A',
        },
      },
      borderRadius: {
        chip: '8px',
        card: '12px',
        shell: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
