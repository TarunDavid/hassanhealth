/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Kannada"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        gov: {
          red: '#c51e28',
          darkRed: '#9e151d',
          amber: '#d97706',
          vetBrown: '#78350f',
          green: '#059669',
          blue: '#1d4ed8',
        },
      },
      boxShadow: {
        'soft-glow-red': '0 0 60px 15px rgba(220, 38, 38, 0.25)',
        'soft-glow-amber': '0 0 60px 15px rgba(217, 119, 6, 0.25)',
      },
    },
  },
  plugins: [],
}
