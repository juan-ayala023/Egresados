'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { dur, ease } from '@/lib/motion';

/* Descubre un bloque con una cortina que barre de abajo hacia arriba mientras
   el contenido baja de escala.

   Usa useInView con un ref propio en vez de whileInView: dentro de columnas CSS
   (la galería masonry) la detección implícita de framer no dispara de forma
   confiable, porque el navegador fragmenta el contenido entre columnas. */

export default function Reveal({
  children,
  className = '',
  delay = 0,
  direccion = 'abajo',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direccion?: 'abajo' | 'izquierda';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sinMovimiento = useReducedMotion();
  const visto = useInView(ref, { once: true, amount: 0.05 });

  if (sinMovimiento) return <div className={className}>{children}</div>;

  const cerrado = direccion === 'abajo' ? 'inset(100% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)';

  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={{ clipPath: cerrado }}
        animate={visto ? { clipPath: 'inset(0% 0% 0% 0%)' } : { clipPath: cerrado }}
        transition={{ duration: dur.reveal, ease: ease.out, delay }}
        className="h-full w-full"
      >
        <motion.div
          initial={{ scale: 1.16 }}
          animate={visto ? { scale: 1 } : { scale: 1.16 }}
          transition={{ duration: dur.reveal + 0.3, ease: ease.out, delay }}
          className="h-full w-full"
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
