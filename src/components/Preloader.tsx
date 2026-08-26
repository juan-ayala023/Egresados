'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ease } from '@/lib/motion';
import { evento } from '@/data';

/* Cuenta de 00 al aniversario y descubre la página con un telón vertical.
   Es el único momento maximalista del sitio: todo lo demás es contenido. */

export default function Preloader({ onDone }: { onDone: () => void }) {
  const sinMovimiento = useReducedMotion();
  const [n, setN] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [fuera, setFuera] = useState(false);

  useEffect(() => {
    if (sinMovimiento) {
      setFuera(true);
      onDone();
      return;
    }

    const meta = evento.aniversario;
    const total = 1500;
    const t0 = performance.now();
    let raf = 0;

    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / total);
      /* easeOutExpo: arranca rápido y frena, se siente mecánico y caro */
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setN(Math.round(e * meta));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setSaliendo(true), 320);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sinMovimiento, onDone]);

  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => {
      setFuera(true);
      onDone();
    }, 1050);
    return () => clearTimeout(t);
  }, [saliendo, onDone]);

  useEffect(() => {
    document.body.style.overflow = fuera ? '' : 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [fuera]);

  if (sinMovimiento) return null;

  return (
    <AnimatePresence>
      {!fuera && (
        <div className="fixed inset-0 z-[100]">
          {/* Telón en dos hojas: se abren hacia arriba y abajo */}
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              initial={{ y: 0 }}
              animate={saliendo ? { y: i === 0 ? '-100%' : '100%' } : { y: 0 }}
              transition={{ duration: 1, ease: ease.drape, delay: i * 0.04 }}
              className="absolute inset-x-0 h-1/2 bg-ink"
              style={{ top: i === 0 ? 0 : '50%' }}
            />
          ))}

          {/* Hilo dorado que se abre con el telón */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={saliendo ? { scaleX: 1, opacity: 0 } : { scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: ease.out }}
            className="absolute inset-x-0 top-1/2 z-10 h-px origin-center bg-gradient-to-r from-transparent via-gold to-transparent"
          />

          <motion.div
            animate={saliendo ? { opacity: 0, scale: 0.96 } : { opacity: 1 }}
            transition={{ duration: 0.45, ease: ease.out }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          >
            <span className="lining font-display font-bold text-[clamp(5rem,20vw,13rem)] leading-none tabular-nums text-bone">
              {String(n).padStart(2, '0')}
            </span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: n >= evento.aniversario ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              className="mt-6 font-body text-[11px] uppercase tracking-eyebrow text-gold"
            >
              Años de historia
            </motion.span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
