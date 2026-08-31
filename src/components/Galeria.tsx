'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import { dur, ease, enVista, subir } from '@/lib/motion';
import { galeria, imagenes } from '@/data';

export default function Galeria() {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [sentido, setSentido] = useState(1);
  const total = galeria.fotos.length;

  const cerrar = useCallback(() => setAbierta(null), []);
  const mover = useCallback(
    (paso: number) => {
      setSentido(paso);
      setAbierta((i) => (i === null ? null : (i + paso + total) % total));
    },
    [total]
  );

  useEffect(() => {
    if (abierta === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [abierta, cerrar, mover]);

  return (
    <section id="galeria" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="eyebrow"
          >
            {galeria.eyebrow}
          </motion.p>
          <RevealText
            texto={galeria.titulo}
            as="h2"
            className="mt-6 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
            acento={[4, 5]}
          />
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="mt-6 max-w-xl font-body text-[15px] leading-relaxed text-bone/65"
          >
            {galeria.subtitulo}
          </motion.p>
        </div>

        {/* Sello del lema, en la esquina superior. El lettering es azul 280C:
            sobre el navy del sitio da 2.0:1 y desaparece, así que va dentro de
            una pastilla clara. La inclinación es lo que lo hace leer como
            sello estampado y no como un logo más. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, rotate: -10 }}
          whileInView={{ opacity: 1, scale: 1, rotate: -4 }}
          viewport={enVista}
          transition={{ duration: dur.slow, ease: ease.out }}
          className="shrink-0 self-start rounded-lg bg-bone px-5 py-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] md:self-end"
        >
          <Image
            src={imagenes.fraseTiger}
            alt="Once a Tiger, Always a Tiger"
            width={650}
            height={361}
            className="h-auto w-[150px] sm:w-[170px]"
          />
        </motion.div>
      </div>

      {/* Distribución pedida por el colegio: una foto principal que ocupa dos
          columnas por dos filas y el resto alrededor. La altura de las filas la
          fijan las fotos pequeñas (3:2), así que la destacada queda cerca de
          esa misma proporción y ninguna se recorta de más.

          Se dejó de usar `columns` (mampostería) porque ahí no existen los
          spans: una celda no puede ocupar dos columnas. */}
      <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-3">
        {galeria.fotos.map((f, i) => (
          <div
            key={f.src}
            className={i === 0 ? 'col-span-2 md:row-span-2' : ''}
          >
            <Reveal delay={(i % 3) * 0.1} className="h-full">
              <button
                onClick={() => setAbierta(i)}
                aria-label={`Ampliar: ${f.alt}`}
                className={`group relative block h-full w-full overflow-hidden rounded-sm ${
                  i === 0 ? 'aspect-[3/2] md:aspect-auto' : 'aspect-[3/2]'
                }
                            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`}
              >
                <Photo
                  src={f.src}
                  alt={f.alt}
                  sizes={i === 0 ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 50vw, 33vw'}
                />
                <div className="absolute inset-0 bg-ink/30 transition-opacity duration-700 group-hover:opacity-0" />
                <div className="absolute inset-0 bg-gold/[0.12] mix-blend-overlay" />
                <div className="absolute inset-0 border border-transparent transition-colors duration-500 group-hover:border-gold/30" />

                {/* Pie que sube al pasar el cursor */}
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink/90 to-transparent px-4 pb-4 pt-10 text-left transition-transform duration-500 ease-out group-hover:translate-y-0 [@media(hover:none)]:translate-y-0">
                  <span className="block font-body text-[11px] uppercase tracking-[0.14em] text-bone/85">
                    {f.alt}
                  </span>
                </span>

                <span className="absolute right-3 top-3 flex h-8 w-8 scale-75 items-center justify-center rounded-full bg-ink/70 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:scale-100 group-hover:opacity-100">
                  <Expand size={14} className="text-gold" strokeWidth={1.5} />
                </span>
              </button>
            </Reveal>
          </div>
        ))}
      </div>

      <motion.div
        variants={subir}
        initial="oculto"
        whileInView="visible"
        viewport={enVista}
        className="mt-12 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-7"
      >
        <p className="font-display text-xl font-bold text-bone sm:text-2xl">
          {galeria.ctaPregunta}
        </p>
        <a href="#boletas" className="btn-gold">
          {galeria.cta}
        </a>
      </motion.div>

      <AnimatePresence>
        {abierta !== null && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: ease.out }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/95"
            onClick={cerrar}
            role="dialog"
            aria-modal="true"
          >
            {[
              { pos: 'right-5 top-5', icon: X, accion: cerrar, label: 'Cerrar' },
              { pos: 'left-4 md:left-8', icon: ChevronLeft, accion: () => mover(-1), label: 'Anterior' },
              { pos: 'right-4 md:right-8', icon: ChevronRight, accion: () => mover(1), label: 'Siguiente' },
            ].map(({ pos, icon: Icon, accion, label }, k) => (
              <motion.button
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + k * 0.06, duration: 0.4, ease: ease.out }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.94 }}
                onClick={(e) => {
                  e.stopPropagation();
                  accion();
                }}
                aria-label={label}
                className={`absolute z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-bone transition-colors hover:border-gold hover:text-gold ${pos}`}
              >
                <Icon size={label === 'Cerrar' ? 18 : 20} strokeWidth={1.5} />
              </motion.button>
            ))}

            {/* En móvil nadie busca las flechas: desliza. El umbral de 60px
                evita que un scroll vertical torpe cambie de foto. */}
            <motion.div
              onClick={(e) => e.stopPropagation()}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) mover(1);
                else if (info.offset.x > 60) mover(-1);
              }}
              className="relative mx-auto w-[min(92vw,1000px)] touch-pan-y"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm">
                <AnimatePresence initial={false} mode="wait" custom={sentido}>
                  <motion.div
                    key={abierta}
                    custom={sentido}
                    initial={{ opacity: 0, x: sentido * 60, scale: 1.04 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: sentido * -60, scale: 0.98 }}
                    transition={{ duration: 0.5, ease: ease.out }}
                    className="absolute inset-0"
                  >
                    <Photo
                      src={galeria.fotos[abierta].src}
                      alt={galeria.fotos[abierta].alt}
                      sizes="90vw"
                      treat={false}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.figcaption
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: dur.base, ease: ease.out }}
                className="mt-4 flex items-center justify-between font-body text-xs uppercase tracking-[0.14em] text-muted"
              >
                <span>{galeria.fotos[abierta].alt}</span>
                <span className="tabular-nums text-gold">
                  {String(abierta + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </span>
              </motion.figcaption>

              {/* Barra de posición dentro de la galería */}
              <div className="mt-3 h-px w-full bg-white/10">
                <motion.div
                  animate={{ width: `${((abierta + 1) / total) * 100}%` }}
                  transition={{ duration: 0.5, ease: ease.out }}
                  className="h-full bg-gold"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
