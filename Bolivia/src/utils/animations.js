// Variantes reutilizables de Framer Motion — el lenguaje de movimiento de la marca.
// Suaves, cinematográficas, nunca exageradas.

export const EASE = [0.16, 1, 0.3, 1]

export const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: EASE },
  },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 1.2, ease: EASE },
  },
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 1.08 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.4, ease: EASE },
  },
}

export const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  show: { opacity: 1, x: 0, transition: { duration: 1, ease: EASE } },
}

export const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  show: { opacity: 1, x: 0, transition: { duration: 1, ease: EASE } },
}

// Contenedor con revelado escalonado de hijos
export const stagger = (staggerChildren = 0.12, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
})

// Máscara de texto tipo cortina (revela de abajo hacia arriba)
export const textReveal = {
  hidden: { y: '110%' },
  show: {
    y: '0%',
    transition: { duration: 1.1, ease: EASE },
  },
}

export const viewportOnce = { once: true, amount: 0.25 }
