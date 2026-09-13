'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ease } from '@/lib/motion';

/* Una manito que toca el botón, al lado del botón.
   El colegio la pidió para que se entienda de una que ahí se compra: el cursor
   ya cambia a manito al pasar por encima, pero eso solo lo ve quien YA está
   encima. Esto se ve sin acercarse.

   SEGUNDA VERSIÓN (11 de septiembre de 2026), por pedido del colegio:
   - Va en BLANCO, no en dorado. Al lado de un botón dorado se confundía con
     él; en blanco se separa y se ve.
   - TOCA EL BOTÓN DE VERDAD. Antes estaba a un lado, con el dedo apuntando
     hacia arriba, al aire. Ahora va girada hacia el botón, montada sobre su
     borde, y el toque es un empujoncito HACIA el botón, no hacia abajo.

   Los rayitos salen de la yema del dedo, no del borde: es lo que hace que se
   lea como "clic" y no como una mano saludando.

   El dibujo es el `Pointer` de lucide-react, la misma familia de íconos que
   usa el resto del sitio, redibujado aquí para poder meterle los rayos dentro
   del mismo lienzo. El viewBox arranca en negativo justamente para dejarles
   aire arriba. */

type Props = {
  /* Alto en píxeles. 34 es el tamaño al lado de un botón grande. */
  tamano?: number;
  /* Cuánto se mete sobre el botón (px, hacia la izquierda) y cuánto baja.
     Van como número y no como clase de Tailwind porque dos clases de margen
     en el mismo elemento se pisan según el orden del CSS, no del código. */
  entrada?: number;
  bajada?: number;
  /* 'blanco' es lo normal. 'azul' es para Historia: ahí el botón queda sobre
     la foto y la manito blanca se perdía con el fondo (13 de septiembre de
     2026). */
  color?: 'blanco' | 'azul';
  className?: string;
};

export default function ManitoClic({
  tamano = 34, entrada = 36, bajada = 12, color = 'blanco', className = '',
}: Props) {
  const sinMovimiento = useReducedMotion();

  /* El toque: un empujón corto hacia el botón (arriba y a la izquierda, que
     es hacia donde apunta el dedo una vez girada), se encoge un pelo como si
     apretara, y vuelve. La pausa larga al final es a propósito -- una manito
     golpeando sin parar cansa y termina leyéndose como un banner. */
  const toque = sinMovimiento
    ? {}
    : {
        x: [0, -7, 0, 0],
        y: [0, -5, 0, 0],
        scale: [1, 0.92, 1, 1],
        transition: { duration: 1.6, times: [0, 0.22, 0.4, 1], repeat: Infinity, ease: ease.out },
      };

  /* Los rayos aparecen en el golpe, no antes. */
  const destello = sinMovimiento
    ? { opacity: 0.9 }
    : {
        opacity: [0, 0, 1, 0, 0],
        scale: [0.6, 0.6, 1, 1.2, 1.2],
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
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      /* `entrada`: se mete bien ADENTRO del botón, no en el borde, para que se
         lea que lo está tocando (el colegio la pidió más a la izquierda). El
         z-10 es para que quede por encima del botón y no detrás. `bajada`:
         baja un poco, porque la yema está arriba del dibujo y así queda a la
         altura del centro del botón.
         La rotación apunta el dedo hacia el botón, que está a la izquierda.
         El drop-shadow la despega del fondo cuando la sección es clara. */
      className={`relative z-10 shrink-0 ${
        color === 'azul'
          ? 'text-brand drop-shadow-[0_2px_6px_rgba(255,255,255,0.7)]'
          : 'text-bone drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]'
      } ${className}`}
      style={{ marginLeft: -entrada, marginTop: bajada, rotate: -28, transformOrigin: '41% 29%' }}
      animate={toque}
    >
      {/* Los rayos del clic, alrededor de la yema (que cae en 8,2). */}
      <motion.g animate={destello} style={{ originX: '8px', originY: '2px' }} strokeWidth={2.4}>
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
