'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ease } from '@/lib/motion';
import { evento, imagenes } from '@/data';
import { useBloquearScroll } from '@/lib/bloquearScroll';

/* Cuenta de 00 al aniversario y descubre la página con un telón vertical.
   Es el único momento maximalista del sitio: todo lo demás es contenido. */

export default function Preloader({ onDone }: { onDone: () => void }) {
  const sinMovimiento = useReducedMotion();
  const [n, setN] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [fuera, setFuera] = useState(false);

  /* La cuenta llego a su tope: es el momento del relevo -- el numero se apaga
     y el logo ocupa su lugar. Se nombra aparte porque de esto dependen las dos
     piezas y tenian que cambiar a la vez. */
  const llego = n >= evento.aniversario;

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

  /* Mientras el telón de carga está puesto, la página no se mueve. */
  useBloquearScroll(!fuera);

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

          {/* SIN hilo dorado. Cruzaba la pantalla justo por la mitad y, ahora
              que el logo ocupa ese centro, le pasaba una línea por encima. */}

          <motion.div
            animate={saliendo ? { opacity: 0, scale: 0.96 } : { opacity: 1 }}
            transition={{ duration: 0.45, ease: ease.out }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          >
            {/* LA CUENTA SE VE, y al llegar a 80 el numero NO se pinta: en su
                lugar aparece el logo. Es el remate -- el visitante ve subir los
                años y lo que cierra la cuenta es la marca del colegio, no un
                número más.

                Los dos van SUPERPUESTOS en la misma caja (grid + place-items),
                no uno debajo del otro: así el cambio ocurre en el mismo sitio
                de la pantalla y nada se mueve al hacer el relevo. La caja
                reserva el alto del logo desde el primer frame, que es el más
                alto de los dos. */}
            <div className="grid w-[min(78vw,720px)] place-items-center">
              {/* La cuenta. Se apaga justo cuando el logo entra. */}
              <motion.span
                animate={{ opacity: llego ? 0 : 1, scale: llego ? 0.9 : 1 }}
                transition={{ duration: 0.45, ease: ease.out }}
                className="lining col-start-1 row-start-1 font-display font-bold text-[clamp(5rem,20vw,13rem)] leading-none tabular-nums text-bone"
              >
                {String(n).padStart(2, '0')}
              </motion.span>

              {/* El logo, que ocupa el lugar del "80" que nunca se dibuja. */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: llego ? 1 : 0, scale: llego ? 1 : 0.92 }}
                transition={{ duration: 0.9, ease: ease.out, delay: 0.15 }}
                className="col-start-1 row-start-1 w-full"
              >
                <Image
                  src={imagenes.logoHorizontal}
                  alt="The Columbus School"
                  width={1880}
                  height={659}
                  priority
                  className="h-auto w-full"
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
