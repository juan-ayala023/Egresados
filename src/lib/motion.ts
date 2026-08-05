import type { Variants } from 'framer-motion';

/* ============================================================================
   SISTEMA DE MOVIMIENTO
   Una sola fuente de curvas y tiempos. Si todo el sitio comparte la misma
   física, el movimiento se lee como intencional en vez de decorativo.
   ========================================================================== */

export const ease = {
  /* Salida suave, entrada firme. La curva base de todo el sitio. */
  out: [0.16, 1, 0.3, 1] as const,
  /* Para elementos que entran y salen (modales, telones). */
  inOut: [0.76, 0, 0.24, 1] as const,
  /* Movimiento con peso, para el telón de carga. */
  drape: [0.83, 0, 0.17, 1] as const,
};

export const dur = {
  fast: 0.4,
  base: 0.7,
  slow: 1.1,
  reveal: 1.4,
};

export const spring = {
  suave: { type: 'spring', stiffness: 120, damping: 20, mass: 0.6 },
  magnetico: { type: 'spring', stiffness: 220, damping: 18, mass: 0.5 },
} as const;

/* Entrada estándar por scroll */
export const subir: Variants = {
  oculto: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
};

/* Contenedor que escalona a sus hijos */
export const escalonar = (delay = 0, gap = 0.08): Variants => ({
  oculto: {},
  visible: { transition: { delayChildren: delay, staggerChildren: gap } },
});

/* Palabra que sube desde una máscara */
export const palabra: Variants = {
  oculto: { y: '110%' },
  visible: { y: '0%', transition: { duration: dur.slow, ease: ease.out } },
};

/* Viewport por defecto: dispara una sola vez, un poco antes de entrar */
export const enVista = { once: true, margin: '-12% 0px -12% 0px' } as const;
