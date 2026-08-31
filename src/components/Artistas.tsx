'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Aurora from './Aurora';
import { Martini, UtensilsCrossed, Music4, Sparkles } from 'lucide-react';
import { dur, ease, enVista, subir, escalonar } from '@/lib/motion';
import { artistas, noche } from '@/data';

/* Traduce la llave que viene de data.ts al icono real. Todos de lucide,
   que son de línea sin relleno: lo único que autoriza el manual. */
const ICONOS = {
  bar: Martini,
  gastronomia: UtensilsCrossed,
  musica: Music4,
  sorpresas: Sparkles,
};

function Tarjeta({ a, i }: { a: (typeof artistas)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const sinMovimiento = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  /* Cada tarjeta se desplaza a distinta velocidad: rompe la retícula rígida */
  const y = useTransform(scrollYProgress, [0, 1], [0, [-40, -80, -20][i] ?? -40]);

  return (
    <motion.article
      ref={ref}
      style={sinMovimiento ? undefined : { y }}
      className="group"
    >
      <Reveal delay={i * 0.12} className="relative aspect-[4/5] overflow-hidden rounded-sm">
        <Photo src={a.imagen} alt={a.nombre} sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
        <div className="absolute inset-0 bg-gold/[0.14] mix-blend-overlay" />
        <div className="absolute inset-0 bg-ink/25" />
        <div className="absolute inset-0 border border-transparent transition-colors duration-700 group-hover:border-gold/45" />

        {/* Barrido de luz al pasar el cursor */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -inset-x-full top-0 h-full -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-gold/15 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full" />
        </div>

      </Reveal>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={enVista}
        transition={{ duration: dur.base, ease: ease.out, delay: 0.35 + i * 0.1 }}
        className="mt-6"
      >
        {/* Solo el nombre: el colegio pidió liberar el espacio que ocupaban el
            género y la descripción. */}
        <h3 className="font-display font-bold text-2xl leading-tight text-bone transition-colors duration-500 group-hover:text-gold">
          {a.nombre}
        </h3>
      </motion.div>
    </motion.article>
  );
}

export default function Artistas() {
  return (
    <section
      id="artistas"
      className="relative overflow-hidden border-y border-white/[0.06] bg-surface/40 py-28 md:py-36"
    >
      <Aurora variante="agua" intensidad={0.6} />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <motion.p
              variants={subir}
              initial="oculto"
              whileInView="visible"
              viewport={enVista}
              className="eyebrow"
            >
              {noche.eyebrow}
            </motion.p>
            <RevealText
              texto={noche.titulo}
              as="h2"
              className="mt-6 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
              /* Los tres verbos en amarillo: volver, reencontrarnos, celebrar */
              acento={[3, 4, 6]}
            />
          </div>
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="max-w-sm font-body text-sm leading-relaxed text-muted"
          >
            {noche.intro}
          </motion.p>
        </div>

        {/* Los cuatro cuadros de la experiencia. Dos por fila: los textos son
            de largo muy distinto y en cuatro columnas el más largo estiraba
            la fila entera. */}
        <motion.div
          variants={escalonar(0.1, 0.1)}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="mt-16 grid gap-5 sm:grid-cols-2"
        >
          {noche.bloques.map((b) => {
            const Icono = ICONOS[b.icono];
            return (
              <motion.article
                key={b.titulo}
                variants={subir}
                className="group rounded-sm border border-white/[0.09] bg-surfaceAlt/40 p-7 transition-colors duration-500 hover:border-gold/40 sm:p-8"
              >
                <Icono
                  size={26}
                  strokeWidth={1.25}
                  className="text-gold transition-transform duration-500 group-hover:scale-110"
                  aria-hidden
                />
                <h3 className="mt-5 font-display text-lg font-bold leading-snug text-bone">
                  {b.titulo}
                </h3>
                <p className="mt-3 font-body text-[14px] leading-relaxed text-bone/60">
                  {b.texto}
                </p>
              </motion.article>
            );
          })}
        </motion.div>

        <motion.p
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="eyebrow mt-24"
        >
          En tarima
        </motion.p>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {artistas.map((a, i) => (
            <Tarjeta key={a.nombre} a={a} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
