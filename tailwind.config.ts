import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep night background — emotional, premium, room for warm accents
        bg: {
          DEFAULT: '#0a0a14',
          raised: '#13131f',
          muted: '#1c1c2a',
        },
        // Warm sunrise accent — represents dawn/growth in emerging regions
        sunrise: {
          50: '#fff4ed',
          100: '#ffe6d4',
          200: '#ffc8a8',
          300: '#ffa372',
          400: '#ff8a4c',
          500: '#ff7a59',
          600: '#ed5a2e',
          700: '#c44523',
          800: '#9a3a23',
          900: '#7c3220',
        },
        // Solana purple as secondary — keeps brand connection
        solana: {
          400: '#b07aff',
          500: '#9945ff',
          600: '#7e2bf0',
        },
        ink: {
          DEFAULT: '#f5f5f7',
          muted: '#9a9aa8',
          dim: '#6b6b7a',
        },
        ring: {
          DEFAULT: '#26263a',
          muted: '#1f1f30',
        },
        success: '#10b981',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'dawn-gradient':
          'radial-gradient(ellipse at 50% -10%, rgba(255, 138, 76, 0.18), transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(153, 69, 255, 0.12), transparent 55%)',
        'sunrise-gradient': 'linear-gradient(135deg, #ff8a4c 0%, #ff7a59 50%, #b07aff 100%)',
      },
      boxShadow: {
        glow: '0 0 60px -10px rgba(255, 138, 76, 0.45)',
        'glow-sm': '0 0 30px -8px rgba(255, 138, 76, 0.35)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out both',
        'pulse-slow': 'pulseSlow 4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
