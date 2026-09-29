import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#22c55e',
          600: '#16a34a',
          900: '#052e16'
        },
        ink: {
          950: '#050b08',
          900: '#0b120f',
          800: '#111b18'
        }
      },
      boxShadow: {
        soft: '0 0 0 1px rgba(34,197,94,0.2)'
      }
    }
  },
  plugins: []
};

export default config;
