/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        // Warm sunlight yellows
        sun: {
          50: '#FFFEF5',
          100: '#FFF9DB',
          200: '#FFF3B8',
          300: '#FFE066',
          400: '#F5D547',
          500: '#E6C229',
          600: '#C9A820',
          700: '#A68A1B',
        },
        // Natural organic greens
        flora: {
          50: '#F4F9F4',
          100: '#E8F5E8',
          200: '#C8E6C9',
          300: '#A5D6A7',
          400: '#6B8E23',
          500: '#4A7C59',
          600: '#3D6B4F',
          700: '#2E5339',
          800: '#1F3D26',
        },
        // Earthy warm tones
        earth: {
          50: '#FAF6F1',
          100: '#F5EDE3',
          200: '#E6D5C3',
          300: '#D4B896',
          400: '#B8956E',
          500: '#8B7355',
          600: '#5D4037',
          700: '#3D2914',
        },
        // Cream/parchment background
        parchment: {
          50: '#FFFEFB',
          100: '#FDFCF7',
          200: '#FAF8F0',
        },
        // Terracotta accent
        terra: {
          50: '#FDF5F2',
          100: '#FAEBE5',
          200: '#F5D4C8',
          300: '#E5A88F',
          400: '#CD7F5C',
          500: '#B86B4A',
          600: '#9E5A3C',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
