/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080f1a',
          900: '#0f1d30',
          800: '#142a45',
          700: '#1e3a5f',
          600: '#2a5080',
          500: '#3d6baf',
          400: '#5a82bc',
          300: '#8badd4',
        },
        gold: {
          DEFAULT: '#f5a623',
          light: '#ffd074',
          dark: '#c4841c',
        },
        score: {
          green: '#22c55e',
          red: '#ef4444',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        body: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
