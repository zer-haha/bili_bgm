/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,tsx,ts,jsx,js}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bili: {
          pink: '#FB7299',
          'pink-dark': '#E84D7A',
          'pink-light': '#FF9AB2',
          blue: '#00A1D6',
          bg: '#F4F5F7',
          'bg-dark': '#1A1A2E',
          'card-dark': '#16213E',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
