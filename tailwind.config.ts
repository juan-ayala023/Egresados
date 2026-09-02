import type { Config } from 'tailwindcss';

/* Los colores NO se declaran aquí. Viven en src/app/globals.css como canales RGB
   y este archivo solo los referencia. El placeholder <alpha-value> es lo que
   permite que sigan funcionando los modificadores tipo bg-gold/40. */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surfaceAlt: 'rgb(var(--surface-alt) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        /* 'gold' conserva el nombre a propósito: ahora contiene el Amarillo
           Pantone 139C, que sigue siendo un dorado. Cambiar el nombre habría
           tocado 86 usos en los componentes sin ganar claridad. */
        gold: 'rgb(var(--gold) / <alpha-value>)',
        goldSoft: 'rgb(var(--gold-soft) / <alpha-value>)',
        goldDeep: 'rgb(var(--gold-deep) / <alpha-value>)',
        bone: 'rgb(var(--bone) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        grayBrand: 'rgb(var(--gray-brand) / <alpha-value>)',
        magenta: 'rgb(var(--magenta) / <alpha-value>)',
        cyan: 'rgb(var(--cyan) / <alpha-value>)',
        green: 'rgb(var(--green) / <alpha-value>)',
        orange: 'rgb(var(--orange) / <alpha-value>)',
        purple: 'rgb(var(--purple) / <alpha-value>)',
      },
      /* El manual solo autoriza Roboto: Bold para títulos y subtítulos,
         Regular para cuerpos. 'display' y 'body' apuntan a la misma familia
         y se diferencian por peso, no por fuente. */
      fontFamily: {
        display: ['var(--font-roboto)', 'system-ui', 'sans-serif'],
        body: ['var(--font-roboto)', 'system-ui', 'sans-serif'],
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
