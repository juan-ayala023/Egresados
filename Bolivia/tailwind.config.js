/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Núcleo de marca — inspirado en madera, bosque y luz de vela
        ink: {
          DEFAULT: '#0B0B09', // Negro profundo
          soft: '#14140F',
          muted: '#1E1D18',
        },
        ivory: {
          DEFAULT: '#F6F1E7', // Marfil
          soft: '#FBF8F1',
        },
        sand: {
          DEFAULT: '#D8C4A2', // Arena
          deep: '#C4AC84',
          soft: '#E7DCC7',
        },
        forest: {
          DEFAULT: '#2C3A31', // Verde bosque
          deep: '#1C261F',
          soft: '#3C4E41',
        },
        wood: {
          DEFAULT: '#6B4F37', // Madera
          soft: '#8A6A4A',
        },
        bronze: {
          DEFAULT: '#B08D57', // Bronce
          soft: '#C7A46B',
          deep: '#8F7043',
        },
        stone: {
          DEFAULT: '#8C857A', // Gris cálido
          soft: '#B7AFA2',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Jost"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-sm': ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.02', letterSpacing: '-0.01em' }],
        display: ['clamp(3.2rem, 9vw, 8rem)', { lineHeight: '0.98', letterSpacing: '-0.02em' }],
      },
      letterSpacing: {
        luxe: '0.32em',
      },
      boxShadow: {
        float: '0 30px 80px -30px rgba(11, 11, 9, 0.45)',
        'float-soft': '0 20px 60px -25px rgba(11, 11, 9, 0.30)',
        glass: '0 8px 40px -12px rgba(11, 11, 9, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        luxe: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'scroll-hint': {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '30%': { opacity: '1' },
          '60%': { opacity: '1' },
          '100%': { transform: 'translateY(14px)', opacity: '0' },
        },
        'kenburns': {
          '0%': { transform: 'scale(1) translate(0, 0)' },
          '100%': { transform: 'scale(1.12) translate(-1.5%, -1.5%)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'scroll-hint': 'scroll-hint 2s ease-in-out infinite',
        'kenburns': 'kenburns 18s ease-out forwards',
      },
    },
  },
  plugins: [],
}
