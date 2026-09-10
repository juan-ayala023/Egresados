'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import Aurora from './Aurora';
import { Martini, UtensilsCrossed, Music4, Sparkles, Play } from 'lucide-react';
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
  /* Las tres se desplazan LO MISMO. Antes cada una iba a su velocidad
     (-40, -80, -20) para romper la retícula, pero el efecto era que quedaban
     a distinta altura y el colegio lo leyó como tarjetas descuadradas: el
     tamaño siempre fue idéntico, lo que bailaba era la posición.
     Con el mismo valor se conserva el parallax contra el fondo y las tres
     quedan alineadas entre sí. */
  const y = useTransform(scrollYProgress, [0, 1], [0, -40]);

  /* El video no existe hasta que alguien lo pide. Pesan 8,7 y 16,7 MB: con la
     etiqueta <video> puesta desde el principio, el navegador se trae al menos
     los metadatos de los dos, y quien entra desde el celular a comprar una
     boleta paga ese costo sin haber pedido ver nada. */
  const [reproduciendo, setReproduciendo] = useState(false);
  const tieneVideo = 'video' in a && Boolean(a.video);

  return (
    <motion.article ref={ref} style={sinMovimiento ? undefined : { y }} className="group">
      {/* El nombre se metió DENTRO de la tarjeta, en una barra oscura al pie.
          Suelto debajo de la foto quedaba flotando sobre el fondo de la
          sección y las tres tarjetas no se leían como una sola pieza. */}
      <Reveal
        delay={i * 0.12}
        className="relative aspect-[4/5] overflow-hidden rounded-lg border border-white/10"
      >
        {reproduciendo && tieneVideo ? (
          /* Fondo oscuro y object-contain: los videos no vienen recortados al
             4:5 de la tarjeta, y con object-cover se le cortaría la cabeza al
             artista. Mejor una franja oscura arriba y abajo que un encuadre
             mutilado. */
          <video
            src={a.video}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full bg-ink object-contain"
            onEnded={() => setReproduciendo(false)}
          />
        ) : (
          <>
            <Photo src={a.imagen} alt={a.nombre} sizes="(max-width: 768px) 100vw, 33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
            <div className="absolute inset-0 bg-gold/[0.14] mix-blend-overlay" />
            <div className="absolute inset-0 bg-ink/25" />
            <div className="absolute inset-0 rounded-lg border border-transparent transition-colors duration-700 group-hover:border-gold/45" />

            {/* Barrido de luz al pasar el cursor */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -inset-x-full top-0 h-full -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-gold/15 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full" />
            </div>

            <span className="absolute left-4 top-4 rounded-sm bg-bone/90 px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.14em] text-brand">
              {a.etiqueta}
            </span>

            {/* Botón de reproducir. Solo en las tarjetas que tienen video, y
                por encima de la barra del nombre para que no se solapen. */}
            {tieneVideo && (
              <button
                type="button"
                onClick={() => setReproduciendo(true)}
                aria-label={`Ver el video de ${a.nombre}`}
                className="group/play absolute inset-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/90 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] transition-all duration-300 group-hover/play:scale-110 group-hover/play:bg-gold sm:h-[72px] sm:w-[72px]">
                  <Play size={26} strokeWidth={2.5} className="ml-1 text-ink" fill="currentColor" />
                </span>
              </button>
            )}
          </>
        )}

        {/* La barra del nombre desaparece mientras corre el video: va justo
            donde el navegador pinta los controles, y dejarla puesta significa
            que nadie puede pausar ni mover la barra de tiempo. */}
        {!reproduciendo && (
          <div className="absolute inset-x-0 bottom-0 bg-ink/90 px-5 py-4 backdrop-blur-sm">
            {/* Solo el nombre: el colegio pidió liberar el espacio que ocupaban
                el género y la descripción. */}
            {/* Sin el dorado al pasar el cursor: los tres nombres van en blanco
                siempre. Con el hover, el que estuviera bajo el mouse se veía
                dorado y parecía que uno de los artistas estaba destacado a
                propósito. */}
            <h3 className="text-center font-display font-bold text-lg leading-tight text-bone sm:text-xl">
              {a.nombre}
            </h3>
          </div>
        )}
      </Reveal>
    </motion.article>
  );
}

export default function Artistas() {
  return (
    <section
      id="artistas"
      className="relative overflow-hidden border-y border-white/[0.06] bg-surface/40 pt-14 md:pt-16 pb-8 md:pb-10"
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
              se leía como un texto de otra sección.

              `md:mt-10` la baja hasta la altura del TITULAR, no la del eyebrow:
              arranca donde arranca "Una noche para volver", que es con lo que
              tiene que emparejarse. Y `max-w-lg` en vez de md la estira hacia
              la izquierda -- como la fila va con justify-between, el bloque se
              pega a la derecha y ensancharlo es lo que corre su borde
              izquierdo. */}
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="max-w-md border-l-4 border-gold pl-6 font-body text-[17px] leading-relaxed text-bone/90 md:mt-10 md:max-w-lg md:text-lg"
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
                  {/* Donde hay logo del aliado, va el logo en lugar del
                      distintivo de texto.

                      El PNG es cuadrado y el logotipo ocupa solo la franja
                      central, así que se recorta: el contenedor es ancho y
                      bajo, y `object-cover` escala la imagen al ancho y corta
                      el aire de arriba y abajo. Puesto entero se vería como
                      una estampilla diminuta en medio de un cuadro vacío. */}
                  {'logo' in b && b.logo ? (
                    <span className="relative block h-7 w-[104px] shrink-0">
                      <Image
                        src={b.logo}
                        alt={b.etiqueta}
                        fill
                        sizes="104px"
                        className="object-cover"
                      />
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-sm px-2 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em] ${c.chip}`}
                    >
                      {b.etiqueta}
                    </span>
                  )}
                </div>
                <p className="mt-3.5 font-body text-[14px] leading-relaxed text-grayBrand">
                  {b.texto}
                </p>

                {/* Solo la llevan el bar y la gastronomía: avisa que ese
                    consumo se paga aparte y no viene con la boleta. Es mejor
                    que alguien lo sepa aquí y no en la fila del bar. */}
                {'nota' in b && b.nota && (
                  <p className="mt-3 font-body text-[12px] font-bold italic text-goldDeep">
                    * {b.nota}
                  </p>
                )}
              </motion.article>
            );
          })}
        </motion.div>

        <motion.p
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="eyebrow mt-14 border-t border-white/[0.08] pt-8"
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
          /* Pegado a las tarjetas y apretado por dentro: con la separacion de
             antes el boton caia fuera de pantalla y habia que bajar para
             encontrarlo, justo en el momento en que la seccion acaba de
             convencer. */
          className="mt-4 rounded-lg border border-dashed border-gold/40 bg-ink/30 px-6 py-4 text-center"
        >
          <p className="font-display text-lg font-bold text-bone">{noche.ctaPregunta}</p>
          <div className="mt-3 flex justify-center">
            <Magnetic href="#boletas" className="btn-gold" fuerza={0.2}>
              {noche.cta}
            </Magnetic>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
