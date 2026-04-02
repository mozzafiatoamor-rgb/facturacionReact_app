/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0e1726',
        surface: '#162030',
        surface2:'#1e2d42',
        border:  'rgba(255,255,255,0.08)',
        accent:  '#3b82f6',
        'accent-dark': '#2563eb',
        muted:   '#64748b',
        success: '#34d399',
        danger:  '#f87171',
        warning: '#fbbf24',
        info:    '#60a5fa',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
      },
      animation: {
        spin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
}
