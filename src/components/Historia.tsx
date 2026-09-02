'use client';

import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import { dur, enVista, subir, escalonar } from '@/lib/motion';
import { historia, evento, imagenes } from '@/data';

/* ESTA SECCIÓN VA EN CLARO, a propósito.
   Es la única franja clara entre el hero y el resto del sitio, que es navy.
   Funciona como respiro: el texto largo de la sección es lo que más se lee
   del sitio y en oscuro cansa. Sobre --bone el dorado 139C no contrasta
   (2.7:1), así que aquí el acento es --gold-deep y los cuerpos van en el
   gris de marca, que es justo para lo que el manual lo autoriza. */

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
        {/* Alternan azul y dorado, como en la referencia. Sobre claro la
            cinta ya no es una textura al 16%: se lee como una fila de años. */}
        {[...anos, ...anos].map((a, i) => (
          <span
            key={`${a}-${i}`}
            className={`shrink-0 cursor-default font-display font-bold text-2xl tabular-nums transition-colors duration-200 hover:text-goldDeep sm:text-3xl ${
              a % 2 === 0 ? 'text-brand/55' : 'text-goldDeep/60'
            }`}
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
      className="relative mt-20 space-y-4 border-t border-brand/10 pt-10"
    >
      {/* Los veladores de los bordes tiñen del color de ESTA sección, no del
          --ink del resto del sitio: en claro un degradado a navy dejaría dos
          manchas oscuras en las puntas. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bone to-transparent sm:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bone to-transparent sm:w-40" />
      <Fila dir={1} />
      <Fila dir={-1} />
      <p className="pt-6 text-center font-body text-[11px] uppercase tracking-eyebrow text-grayBrand">
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
    <section id="evento" className="relative overflow-hidden bg-bone">
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div ref={ref} className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <motion.p
              variants={subir}
              initial="oculto"
              whileInView="visible"
              viewport={enVista}
              className="eyebrow-claro"
            >
              {historia.eyebrow}
            </motion.p>

            {/* El acento pasó de la primera palabra a las dos últimas: lo que
                se destaca es "comunidad TCS.", que es el sujeto de la frase,
                no "Ocho". */}
            <RevealText
              texto={historia.titulo}
              as="h2"
              className="mt-5 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em] text-brand"
              acento={[4, 5]}
              claseAcento="text-goldDeep"
            />

            <motion.div
              variants={escalonar(0.25, 0.12)}
              initial="oculto"
              whileInView="visible"
              viewport={enVista}
              className="mt-7 space-y-5"
            >
              <motion.p
                variants={subir}
                className="max-w-xl font-body text-[17px] font-semibold leading-relaxed text-brand"
              >
                {historia.entrada}
              </motion.p>

              {historia.parrafos.map((p, i) => (
                <motion.p
                  key={i}
                  variants={subir}
                  className="max-w-xl font-body text-[15px] leading-[1.85] text-grayBrand"
                >
                  {p}
                </motion.p>
              ))}

              {/* El cierre dejó de ser un renglón dorado más y pasó a caja con
                  filo: es la frase que empuja a comprar y tenía que separarse
                  del cuerpo. */}
              <motion.div
                variants={subir}
                className="max-w-xl border-y border-r border-brand/10 border-l-[3px] border-l-gold bg-white px-6 py-5"
              >
                <p className="font-body text-[15px] font-semibold leading-relaxed text-brand">
                  {historia.cierre}
                </p>
              </motion.div>

              <motion.div variants={subir} className="pt-3">
                <Magnetic href="#boletas" className="btn-gold">
                  {historia.cta}
                </Magnetic>
              </motion.div>
            </motion.div>
          </div>

          <Reveal className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-brand/15">
            <motion.div
              style={sinMovimiento ? undefined : { y: fotoY }}
              className="absolute inset-[-8%] will-change-transform"
            >
              <Photo
                src={imagenes.historia}
                alt="El público del Homecoming con los brazos arriba"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            </motion.div>
            {/* Duotono de marca, más suave que el del hero: aquí la foto es
                pequeña y un teñido fuerte le borra el detalle. Ya no lleva el
                velo oscuro encima: el pie de foto salió de la imagen y se
                fue a la barra azul, así que nada necesita fondo oscuro. */}
            <div className="absolute inset-0 bg-brand/35 mix-blend-color" />

            <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-4 bg-brand px-6 py-4">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-bone">
                {evento.colegio}
              </p>
              <p className="shrink-0 font-display font-bold text-sm tabular-nums text-gold">
                {evento.fundacion} — {evento.fundacion + evento.aniversario}
              </p>
            </div>
          </Reveal>
        </div>

        <CintaPromociones />
      </div>
    </section>
  );
}
