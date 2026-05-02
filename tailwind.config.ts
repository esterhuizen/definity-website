import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // White-first surface stack — each step a touch greyer than the last.
        bg: {
          DEFAULT: '#ffffff',
          raised: '#fafbfd',
          muted: '#f3f4f8',
        },
        // Near-black ink for headings; medium grey for body; light grey for hints.
        ink: {
          DEFAULT: '#0d1014',
          muted: '#52566a',
          dim: '#8a8e9e',
        },
        // Card / divider borders. Slightly stronger than typical so cards "lift" on white.
        ring: {
          DEFAULT: '#dcdee8',
          muted: '#ecedf3',
        },
        // Solana magenta-purple — the logo's right end.
        solana: {
          50:  '#f6efff',
          100: '#ecdcff',
          200: '#d6b4ff',
          300: '#bd84ff',
          400: '#a85aff',
          500: '#9945ff',
          600: '#7e2bf0',
          700: '#6620c4',
          800: '#4f1a98',
          900: '#3b1473',
        },
        // Solana teal-green — the logo's left end. Keeping the `sunrise` key so
        // existing classes (`bg-sunrise-500/15`, `text-sunrise-400`, ...) keep
        // working without component churn — the values just shift to the cool side.
        sunrise: {
          50:  '#e8fff6',
          100: '#c8ffe7',
          200: '#8efbcf',
          300: '#4ff0b6',
          400: '#2de1a3',
          500: '#14c98c',
          600: '#0aa274',
          700: '#0a805d',
          800: '#0a6448',
          900: '#0a4a36',
        },
        // Bright magenta accent (logo's right-most edge) — used sparingly for highlights.
        magenta: {
          400: '#e94dff',
          500: '#dc1fff',
          600: '#b911dd',
        },
        success: '#0aa274',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        // Canonical Solana 3-stop gradient — matches the logo's teal → purple → magenta sweep.
        'sunrise-gradient':
          'linear-gradient(135deg, #14F195 0%, #9945FF 55%, #DC1FFF 100%)',
        // Soft, white-friendly hero wash — Solana colors at low alpha over white.
        'dawn-gradient':
          'radial-gradient(ellipse at 50% -10%, rgba(153, 69, 255, 0.10), transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(20, 241, 149, 0.08), transparent 55%), radial-gradient(ellipse at 15% 80%, rgba(220, 31, 255, 0.06), transparent 60%)',
      },
      boxShadow: {
        // Soft card lift on white.
        card: '0 1px 2px rgba(13, 16, 20, 0.04), 0 6px 24px rgba(13, 16, 20, 0.05)',
        cardHover: '0 1px 2px rgba(13, 16, 20, 0.05), 0 12px 36px rgba(13, 16, 20, 0.08)',
        // Coloured glow for primary CTAs — purple-leaning so it reads as Solana, not generic.
        glow: '0 0 36px -6px rgba(153, 69, 255, 0.45), 0 0 16px -4px rgba(20, 241, 149, 0.30)',
        'glow-sm': '0 0 20px -6px rgba(153, 69, 255, 0.35), 0 0 10px -4px rgba(20, 241, 149, 0.20)',
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
