/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0B',
        surface: '#121214',
        elevated: '#18181B',
        border: '#1F1F23',
        borderStrong: '#2A2A30',
        text: '#F4F4F5',
        muted: '#8A8A93',
        dim: '#5A5A63',
        accent: '#10B981',
        accentDim: '#064E3B',
        danger: '#F87171',
        dangerDim: '#450A0A',
        info: '#60A5FA',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.02) inset',
      },
    },
  },
  plugins: [],
};
