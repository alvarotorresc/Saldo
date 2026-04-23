/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Terminal / Technical palette (v0.2). Names align with design/tokens.jsx
      // at ~/Downloads/design_handoff_saldo/design/tokens.jsx. Legacy keys that
      // the v0.1 pages still reference are preserved until F9 polish.
      colors: {
        bg: '#08090a',
        surface: '#0e0f11',
        surface2: '#14161a',
        surface3: '#1a1d22',
        elevated: '#14161a', // legacy alias → surface2
        border: '#1e2126',
        borderStrong: '#2a2e35',
        text: '#e8e8ea',
        textDim: '#b9bac0',
        muted: '#7a8089',
        dim: '#4a4f57',
        accent: '#8fc088',
        accentDim: '#1a2e1c',
        danger: '#c97c7c',
        dangerDim: '#2a1616',
        warning: '#c9a86a',
        info: '#7ea6c9',
        altAccent: '#c01c28',
        altAccentDim: '#2a0a0e',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        // Mono scale — for UI
        mono8: ['8px', '11px'],
        mono9: ['9px', '12px'],
        mono10: ['10px', '14px'],
        mono11: ['11px', '15px'],
        mono12: ['12px', '17px'],
        // Sans scale — secondary prose
        sans10: ['10px', '14px'],
        sans11: ['11px', '15px'],
        sans12: ['12px', '17px'],
        sans13: ['13px', '18px'],
        sans14: ['14px', '20px'],
        sans16: ['16px', '22px'],
        sans20: ['20px', '26px'],
        // Display scale — big balances
        d24: ['24px', '28px'],
        d32: ['32px', '36px'],
        d40: ['40px', '44px'],
        d52: ['52px', '56px'],
        // Legacy keys
        '2xs': ['10px', '14px'],
      },
      letterSpacing: {
        tight: '-.02em',
        normal: '0',
        wide: '.04em',
        wider: '.08em',
        widest: '.12em',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '3px',
        md: '4px',
        lg: '6px',
        full: '999px',
        // Legacy keys (to be removed in F9)
        xl: '14px',
        '2xl': '18px',
      },
      transitionTimingFunction: {
        term: 'cubic-bezier(.4, 0, .2, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '400ms',
        counter: '700ms',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.02) inset',
      },
    },
  },
  plugins: [],
};
