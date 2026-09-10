'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ease } from '@/lib/motion';

/* Una manito que toca el botón, al lado del botón.
   El colegio la pidió para que se entienda de una que ahí se compra: el cursor
   ya cambia a manito al pasar por encima, pero eso solo lo ve quien YA está
   encima. Esto se ve sin acercarse.

   Los rayitos salen de la yema del dedo, no del borde: es lo que hace que se
   lea como "clic" y no como una mano saludando.

   El dibujo es el `Pointer` de lucide-react, la misma familia de íconos que
   usa el resto del sitio, redibujado aquí para poder meterle los rayos dentro
   del mismo lienzo. El viewBox arranca en negativo justamente para dejarles
   aire arriba. */

type Props = {
  /* Alto en píxeles. 30 es el tamaño al lado de un botón grande. */
  tamano?: number;
  className?: string;
};

export default function ManitoClic({ tamano = 30, className = '' }: Props) {
  const sinMovimiento = useReducedMotion();

  /* El toque: baja, se detiene y vuelve. La pausa larga al final es a
     propósito -- una manito golpeando sin parar cansa y termina leyéndose
     como un banner de publicidad. */
  const toque = sinMovimiento
    ? {}
    : {
        y: [0, 5, 0, 0],
        transition: { duration: 1.6, times: [0, 0.22, 0.4, 1], repeat: Infinity, ease: ease.out },
      };

  /* Los rayos aparecen en el golpe, no antes. */
  const destello = sinMovimiento
    ? { opacity: 0.9 }
    : {
        opacity: [0, 0, 1, 0, 0],
        scale: [0.6, 0.6, 1, 1.15, 1.15],
        transition: { duration: 1.6, times: [0, 0.2, 0.3, 0.45, 1], repeat: Infinity, ease: ease.out },
      };

  return (
    <motion.svg
      aria-hidden="true"
      width={tamano}
      height={tamano}
      viewBox="-6 -8 34 34"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-gold ${className}`}
      animate={toque}
    >
      {/* Los rayos del clic, alrededor de la yema (que cae en 8,2). */}
      <motion.g animate={destello} style={{ originX: '8px', originY: '2px' }} strokeWidth={2.2}>
        <path d="M8 -2.5V-5.5" />
        <path d="M3.7 -0.8L1.6 -2.9" />
        <path d="M12.3 -0.8L14.4 -2.9" />
      </motion.g>

      {/* La mano. */}
      <path d="M22 14a8 8 0 0 1-8 8" />
      <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
      <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
      <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </motion.svg>
  );
}
