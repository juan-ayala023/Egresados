import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0F',
        surface: '#12121A',
        surfaceAlt: '#1A1A24',
        gold: '#D4AF37',
        goldSoft: '#E8CE7A',
        bone: '#F2EDE4',
        muted: '#8C8A93',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      letterSpacing: {
        eyebrow: '0.32em',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 6s linear infinite',
        floatSlow: 'floatSlow 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
