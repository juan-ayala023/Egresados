'use client';

import { motion } from 'framer-motion';
import { ease } from '@/lib/motion';

/* Línea de agua.
   El escudo del colegio es una caravela sobre olas dibujadas a trazo. Este
   separador repite ese mismo gesto entre secciones: tres trazos de distinta
   longitud y opacidad, como los del logo.

   Es el hilo que hace que el sitio se sienta de ESTE colegio y no de
   cualquiera. Se dibuja solo al entrar en pantalla. */

type Props = { className?: string; invertida?: boolean };

const TRAZOS = [
  { d: 'M0 22 C 120 6, 260 38, 400 20 S 680 4, 800 24', o: 0.5, w: 1.5 },
  { d: 'M0 32 C 150 18, 300 46, 460 28 S 700 16, 800 34', o: 0.3, w: 1.2 },
  { d: 'M0 42 C 100 32, 280 52, 420 40 S 690 30, 800 44', o: 0.16, w: 1 },
];

export default function LineaAgua({ className = '', invertida = false }: Props) {
  return (
    <div aria-hidden className={`pointer-events-none w-full ${className}`}>
      <svg
        viewBox="0 0 800 56"
        preserveAspectRatio="none"
        className={`h-10 w-full md:h-14 ${invertida ? 'rotate-180' : ''}`}
        fill="none"
      >
        {TRAZOS.map((t, i) => (
          <motion.path
            key={i}
            d={t.d}
            stroke="rgb(var(--gold))"
            strokeOpacity={t.o}
            strokeWidth={t.w}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.6, ease: ease.out, delay: i * 0.14 }}
          />
        ))}
      </svg>
    </div>
  );
}
