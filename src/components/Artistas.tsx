'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Aurora from './Aurora';
import { dur, ease, enVista, subir } from '@/lib/motion';
import { artistas } from '@/data';

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

        <motion.span
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enVista}
          transition={{ duration: dur.base, ease: ease.out, delay: 0.6 + i * 0.1 }}
          className="absolute right-4 top-4 rounded-full bg-ink/70 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.14em] text-gold backdrop-blur-sm"
        >
          {a.horario}
        </motion.span>
      </Reveal>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={enVista}
        transition={{ duration: dur.base, ease: ease.out, delay: 0.35 + i * 0.1 }}
        className="mt-6"
      >
        <p className="font-body text-[10px] uppercase tracking-eyebrow text-gold/70">{a.genero}</p>
        <h3 className="mt-3 font-display font-bold text-2xl leading-tight text-bone transition-colors duration-500 group-hover:text-gold">
          {a.nombre}
        </h3>
        <p className="mt-3 font-body text-[14px] leading-relaxed text-bone/55">{a.descripcion}</p>
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
              En tarima
            </motion.p>
            <RevealText
              texto="Ocho horas de música en vivo"
              as="h2"
              className="mt-6 max-w-lg font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
              acento={[3]}
            />
          </div>
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="max-w-xs font-body text-sm leading-relaxed text-muted"
          >
            El orden de la noche, de la primera copa al último tema.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {artistas.map((a, i) => (
            <Tarjeta key={a.nombre} a={a} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
