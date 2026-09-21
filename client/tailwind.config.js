/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        bg: { 1: '#080810', 2: '#0e0e1a', 3: '#141424', 4: '#1a1a2e' },
        accent: { DEFAULT: '#7c6ff7', dim: 'rgba(124,111,247,0.15)', glow: 'rgba(124,111,247,0.4)' },
        green: { voice: '#00e5a0' },
        red: { stop: '#ff4d6d' },
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
        ripple: { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(2.5)', opacity: '0' } },
        waveBar: { '0%,100%': { transform: 'scaleY(0.3)' }, '50%': { transform: 'scaleY(1)' } },
        orbFloat: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(20px,-15px) scale(1.05)' } },
        scoreReveal: { from: { opacity: '0', transform: 'scale(0.9) translateY(24px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        thinking: { '0%,100%': { opacity: '0.3', transform: 'scale(0.8)' }, '50%': { opacity: '1', transform: 'scale(1.2)' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.6s ease both',
        pulse2: 'pulse2 2s ease infinite',
        ripple: 'ripple 1.5s ease-out infinite',
        waveBar: 'waveBar 0.8s ease infinite',
        orbFloat: 'orbFloat 6s ease infinite',
        scoreReveal: 'scoreReveal 0.5s ease both',
        spin: 'spin 0.8s linear infinite',
        thinking: 'thinking 1s ease infinite',
      },
    },
  },
  plugins: [],
};
