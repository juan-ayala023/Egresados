'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ease } from '@/lib/motion';
import { evento, imagenes } from '@/data';

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
      /* La pausa al llegar a 80 es lo que le da tiempo al logo del colegio de
         aparecer y leerse. Con los 320ms de antes el telon se abria encima de
         la animacion del logo y no se alcanzaba a ver. */
      else setTimeout(() => setSaliendo(true), 900);
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
            {/* Logo del colegio, que entra cuando la cuenta llega a 80.
                El alto se reserva desde el primer frame aunque este invisible:
                si apareciera de golpe empujaria el numero hacia abajo y el
                salto se nota justo en el momento que se quiere lucir. */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: n >= evento.aniversario ? 1 : 0,
                y: n >= evento.aniversario ? 0 : 10,
              }}
              transition={{ duration: 0.7, ease: ease.out }}
              className="mb-7 h-[clamp(2rem,5.5vw,3.5rem)]"
            >
              <Image
                src={imagenes.logoHorizontal}
                alt="The Columbus School"
                width={1880}
                height={659}
                priority
                className="h-full w-auto"
              />
            </motion.div>

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
