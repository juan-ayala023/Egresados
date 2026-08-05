'use client';

import { motion, useInView, animate, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import { dur, ease, enVista, subir, escalonar } from '@/lib/motion';
import { historia, evento, imagenes } from '@/data';

function Contador({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visto = useInView(ref, { once: true, margin: '-80px' });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!visto) return;
    const control = animate(0, valor, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => control.stop();
  }, [visto, valor]);

  return <span ref={ref}>{n}</span>;
}

/* Cinta infinita de promociones. El movimiento continuo hace que 62 años
   se lean como un flujo y no como una lista. */
function CintaPromociones() {
  const sinMovimiento = useReducedMotion();
  const anos = Array.from({ length: evento.aniversario - 18 }, (_, i) => evento.fundacion + 18 + i);
  const [pausa, setPausa] = useState(false);

  const Fila = ({ dir }: { dir: 1 | -1 }) => (
    <div className="flex overflow-hidden">
      <motion.div
        animate={sinMovimiento || pausa ? {} : { x: dir === 1 ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
        className="flex shrink-0 gap-8 pr-8"
      >
        {[...anos, ...anos].map((a, i) => (
          <span
            key={`${a}-${i}`}
            className="shrink-0 cursor-default font-display text-2xl tabular-nums text-bone/[0.16] transition-colors duration-200 hover:text-gold sm:text-3xl"
          >
            {a}
          </span>
        ))}
      </motion.div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={enVista}
      transition={{ duration: dur.slow }}
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      className="relative mt-24 space-y-4 py-6"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-40 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-40 bg-gradient-to-l from-ink to-transparent" />
      <Fila dir={1} />
      <Fila dir={-1} />
      <p className="pt-6 text-center font-body text-[11px] uppercase tracking-eyebrow text-muted">
        Cada promoción que salió por esa puerta
      </p>
    </motion.div>
  );
}

export default function Historia() {
  const ref = useRef<HTMLDivElement>(null);
  const sinMovimiento = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const fotoY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <section id="evento" className="relative mx-auto max-w-7xl px-6 py-28 md:py-40">
      <div ref={ref} className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div>
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="eyebrow"
          >
            {historia.eyebrow}
          </motion.p>

          <RevealText
            texto={historia.titulo}
            as="h2"
            className="mt-6 font-display text-[clamp(2.2rem,5vw,4rem)] font-medium leading-[1.03] tracking-[-0.015em]"
            acento={[0]}
          />

          <motion.div
            variants={escalonar(0.25, 0.12)}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="mt-8 space-y-5"
          >
            {historia.parrafos.map((p, i) => (
              <motion.p
                key={i}
                variants={subir}
                className="max-w-xl font-body text-[15px] leading-[1.85] text-bone/65"
              >
                {p}
              </motion.p>
            ))}
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={enVista}
            transition={{ duration: dur.reveal, ease: ease.out }}
            className="mt-14 h-px w-full origin-left bg-white/[0.12]"
          />

          <motion.div
            variants={escalonar(0.2, 0.14)}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="grid grid-cols-3 gap-6 pt-10"
          >
            {historia.stats.map((s) => (
              <motion.div key={s.label} variants={subir}>
                <div className="font-display text-4xl leading-none text-gold sm:text-5xl">
                  <Contador valor={s.valor} />
                  {s.sufijo}
                </div>
                <div className="mt-3 font-body text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <Reveal className="group relative aspect-[4/5] overflow-hidden rounded-sm">
          <motion.div
            style={sinMovimiento ? undefined : { y: fotoY }}
            className="absolute inset-[-8%] will-change-transform"
          >
            <Photo
              src={imagenes.historia}
              alt="El colegio a lo largo de los años"
              sizes="(max-width: 1024px) 100vw, 45vw"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/25" />
          <div className="absolute inset-0 bg-gold/[0.16] mix-blend-overlay" />
          <div className="absolute bottom-7 left-7 right-7">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={enVista}
              transition={{ duration: dur.reveal, ease: ease.out, delay: 0.5 }}
              className="gold-rule mb-5 origin-left"
            />
            <p className="font-display text-xl text-bone">
              {evento.fundacion} — {evento.fundacion + evento.aniversario}
            </p>
            <p className="mt-1.5 font-body text-xs uppercase tracking-[0.14em] text-muted">
              {evento.colegio}
            </p>
          </div>
        </Reveal>
      </div>

      <CintaPromociones />
    </section>
  );
}
