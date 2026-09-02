'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import Aurora from './Aurora';
import { Martini, UtensilsCrossed, Music4, Sparkles } from 'lucide-react';
import { enVista, subir, escalonar } from '@/lib/motion';
import { artistas, noche } from '@/data';

/* Traduce la llave que viene de data.ts al icono real. Todos de lucide,
   que son de línea sin relleno: lo único que autoriza el manual. */
const ICONOS = {
  bar: Martini,
  gastronomia: UtensilsCrossed,
  musica: Music4,
  sorpresas: Sparkles,
};

/* Los cuatro cuadros van en tarjeta CLARA sobre el navy y alternan azul y
   dorado en tablero de ajedrez: en una rejilla de dos columnas, alternar por
   índice pinta filas enteras del mismo color y se pierde el juego. La fórmula
   es (fila + columna) par. El título se queda azul en los cuatro: el dorado
   profundo en un titular de 18px sobre claro se lee sucio. */
const acentoDe = (i: number) =>
  (Math.floor(i / 2) + (i % 2)) % 2 === 0
    ? {
        borde: 'border-brand/25 border-t-brand',
        icono: 'text-brand',
        chip: 'bg-brand/10 text-brand',
      }
    : {
        borde: 'border-goldDeep/30 border-t-goldDeep',
        icono: 'text-goldDeep',
        chip: 'bg-goldDeep/12 text-goldDeep',
      };

function Tarjeta({ a, i }: { a: (typeof artistas)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const sinMovimiento = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  /* Cada tarjeta se desplaza a distinta velocidad: rompe la retícula rígida */
  const y = useTransform(scrollYProgress, [0, 1], [0, [-40, -80, -20][i] ?? -40]);

  return (
    <motion.article ref={ref} style={sinMovimiento ? undefined : { y }} className="group">
      {/* El nombre se metió DENTRO de la tarjeta, en una barra oscura al pie.
          Suelto debajo de la foto quedaba flotando sobre el fondo de la
          sección y las tres tarjetas no se leían como una sola pieza. */}
      <Reveal
        delay={i * 0.12}
        className="relative aspect-[4/5] overflow-hidden rounded-lg border border-white/10"
      >
        <Photo src={a.imagen} alt={a.nombre} sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
        <div className="absolute inset-0 bg-gold/[0.14] mix-blend-overlay" />
        <div className="absolute inset-0 bg-ink/25" />
        <div className="absolute inset-0 rounded-lg border border-transparent transition-colors duration-700 group-hover:border-gold/45" />

        {/* Barrido de luz al pasar el cursor */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -inset-x-full top-0 h-full -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-gold/15 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full" />
        </div>

        <span className="absolute left-4 top-4 rounded-sm bg-bone/90 px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          {a.etiqueta}
        </span>

        <div className="absolute inset-x-0 bottom-0 bg-ink/90 px-5 py-4 backdrop-blur-sm">
          {/* Solo el nombre: el colegio pidió liberar el espacio que ocupaban
              el género y la descripción. */}
          <h3 className="text-center font-display font-bold text-lg leading-tight text-bone transition-colors duration-500 group-hover:text-gold sm:text-xl">
            {a.nombre}
          </h3>
        </div>
      </Reveal>
    </motion.article>
  );
}

export default function Artistas() {
  return (
    <section
      id="artistas"
      className="relative overflow-hidden border-y border-white/[0.06] bg-surface/40 py-24 md:py-32"
    >
      <Aurora variante="agua" intensidad={0.6} />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start md:gap-14">
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
              className="mt-5 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
              /* Toda la segunda mitad de la frase en amarillo, no solo los
                 verbos sueltos: es la parte que promete la noche. */
              acento={[3, 4, 5, 6]}
            />
          </div>
          {/* El filo dorado ata la entradilla al titular; suelta a la derecha
              se leía como un texto de otra sección. */}
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="max-w-sm border-l-2 border-gold/50 pl-5 font-body text-sm leading-relaxed text-muted md:mt-3"
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
          className="mt-14 grid gap-5 sm:grid-cols-2"
        >
          {noche.bloques.map((b, i) => {
            const Icono = ICONOS[b.icono];
            const c = acentoDe(i);
            return (
              <motion.article
                key={b.titulo}
                variants={subir}
                className={`group rounded-lg border border-t-[3px] bg-bone p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)] sm:p-7 ${c.borde}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Icono
                      size={22}
                      strokeWidth={1.5}
                      className={`shrink-0 transition-transform duration-500 group-hover:scale-110 ${c.icono}`}
                      aria-hidden
                    />
                    <h3 className="font-display text-lg font-bold leading-snug text-brand">
                      {b.titulo}
                    </h3>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.14em] ${c.chip}`}
                  >
                    {b.etiqueta}
                  </span>
                </div>
                <p className="mt-3.5 font-body text-[14px] leading-relaxed text-grayBrand">
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
          className="eyebrow mt-20 border-t border-white/[0.08] pt-10"
        >
          {noche.eyebrowTarima}
        </motion.p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {artistas.map((a, i) => (
            <Tarjeta key={a.nombre} a={a} i={i} />
          ))}
        </div>

        {/* Cierre de la sección: describe la noche entera y hasta ahora no
            ofrecía ninguna salida hacia la compra. */}
        <motion.div
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="mt-16 rounded-lg border border-dashed border-gold/40 bg-ink/30 px-6 py-8 text-center"
        >
          <p className="font-display text-lg font-bold text-bone">{noche.ctaPregunta}</p>
          <div className="mt-5 flex justify-center">
            <Magnetic href="#boletas" className="btn-gold" fuerza={0.2}>
              {noche.cta}
            </Magnetic>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
