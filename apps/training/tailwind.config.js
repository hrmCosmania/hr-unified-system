/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 700: '#123a75', 800: '#0d2d5e', 900: '#0a2248' },
        brand: { 50: '#eef4ff', 100: '#dbe7ff', 500: '#2f6fe4', 600: '#1f5fd6', 700: '#1a4fb4' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,40,80,.04), 0 4px 16px rgba(16,40,80,.06)' },
    },
  },
  plugins: [],
}
