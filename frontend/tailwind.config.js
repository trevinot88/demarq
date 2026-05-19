/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          lightest: '#FFF4E4',
          light:    '#F8E0C9',
          DEFAULT:  '#e8c9a0',
          dark:     '#d4a97a',
        },
        brown: {
          DEFAULT: '#2B1A12',
          light:   '#4a2e1e',
          lighter: '#6b4226',
        },
        olive: {
          DEFAULT: '#B1AA81',
          dark:    '#8a8460',
          light:   '#d4d0b8',
        },
        // Keep accent for backward compat in export xlsx styles
        accent: {
          DEFAULT: '#B1AA81',
          dark:    '#8a8460',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
