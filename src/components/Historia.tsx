'use client';

import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import ManitoClic from './ManitoClic';
import { dur, enVista, subir, escalonar } from '@/lib/motion';
import { historia, evento, imagenes } from '@/data';

/* ESTA SECCIÓN VA EN CLARO, a propósito.
   Es la única franja clara entre el hero y el resto del sitio, que es navy.
   Funciona como respiro: el texto largo de la sección es lo que más se lee
   del sitio y en oscuro cansa. Sobre --bone el dorado 139C no contrasta
   (2.7:1), así que aquí el acento es --gold-deep y los cuerpos van en el
   gris de marca, que es justo para lo que el manual lo autoriza. */

/* La CINTA DE PROMOCIONES (los anios de 1965 en adelante desfilando, con su
   linea divisoria y el pie "Cada promocion que salio por esa puerta") se quito
   el 8 de septiembre de 2026 por pedido del colegio: alargaba la seccion y
   obligaba a bajar para ver el resto. Si se quiere devolver, esta en el
   historial de git. */

/* Cinta de años: una fila corre hacia la izquierda y la otra hacia la derecha.
   El colegio pidió CONSERVARLA -- se había borrado por error al recortar los
   espacios de la sección, y lo que se pedía era recortar, no quitar.

   Se pausa con el cursor encima para poder buscar tu año, y con
   `prefers-reduced-motion` no se mueve. Los márgenes van recortados respecto
   al diseño original para que la sección entre completa sin hacer scroll. */
function CintaPromociones() {
  const sinMovimiento = useReducedMotion();
  const anos = Array.from({ length: evento.aniversario - 18 }, (_, i) => evento.fundacion + 18 + i);
  const [pausa, setPausa] = useState(false);

  const Fila = ({ dir }: { dir: 1 | -1 }) => (
    <div className="flex overflow-hidden">
      <motion.div
        animate={sinMovimiento || pausa ? {} : { x: dir === 1 ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
        className="flex shrink-0 gap-7 pr-7"
      >
        {[...anos, ...anos].map((a, i) => (
          <span
            key={`${a}-${i}`}
            /* Azul de marca al 22%, NO bone: esta seccion es de fondo claro y
               la cinta venia disenada de cuando era oscura -- los anios eran
               blanco sobre blanco y no se veia ninguno.

               Los que cierran decada o media decada van en dorado: le dan
               ritmo a la cinta y sirven de punto de referencia para ubicar tu
               anio. El patron es por el numero, no al azar, para que no baile
               entre las dos filas ni al repetirse la lista. */
            className={`shrink-0 cursor-default font-display font-bold text-xl tabular-nums transition-colors duration-200 hover:text-goldDeep sm:text-2xl ${
              a % 5 === 0 ? 'text-goldDeep/70' : 'text-brand/[0.22]'
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
      className="relative mt-6 space-y-1.5 py-1.5"
    >
      {/* Desvanecido en los bordes, del color DE ESTA seccion. Con from-ink
          se pintaban dos franjas oscuras sobre el fondo claro. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bone to-transparent sm:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bone to-transparent sm:w-40" />
      <Fila dir={1} />
      <Fila dir={-1} />
      {/* Redaccion del colegio. Va SIN mayusculas forzadas y en cuerpo mayor
          que un pie de foto: es una frase que se lee, no una etiqueta. El
          remate va en azul de marca para que cierre la idea. */}
      <p className="pt-4 text-center font-body text-[15px] text-grayBrand sm:text-base">
        Cada generación que dejó su huella&hellip;{' '}
        <span className="text-brand">hoy vuelve a casa.</span>
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
      {/* Respiro recortado: era py-24/py-32 (96 y 128px). El colegio pidió que
          la sección se vea completa sin bajar, y ese aire de arriba y abajo
          era lo que la empujaba fuera de pantalla. */}
      {/* Cierra mas apretado de lo que abre: arriba respira donde arranca el
          titular, abajo ya no hay nada que respire -- solo la cinta y el borde
          con la siguiente seccion. Es lo que permite ver la seccion entera de
          un vistazo, sin scroll. */}
      <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-6 md:pt-12 md:pb-8">
        <div ref={ref} /* La foto se lleva MÁS columna que el texto (antes era al revés). El
           colegio veía un vacío a la derecha: los años que llenaban ese lado se
           habían quitado y la foto quedaba corta para el espacio que le tocaba. */
        className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
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
              className="mt-4 font-display text-[clamp(2rem,4.2vw,3rem)] font-bold leading-[1.05] tracking-[-0.015em] text-brand"
              acento={[4, 5]}
              claseAcento="text-goldDeep"
            />

            <motion.div
              variants={escalonar(0.25, 0.12)}
              initial="oculto"
              whileInView="visible"
              viewport={enVista}
              className="mt-5 space-y-4"
            >
              <motion.p
                variants={subir}
                className="max-w-xl font-body text-[16px] font-bold leading-relaxed text-brand lg:max-w-none"
              >
                {historia.entrada}
              </motion.p>

              {historia.parrafos.map((p, i) => (
                <motion.p
                  key={i}
                  variants={subir}
                  className="max-w-xl font-body text-[14.5px] leading-[1.75] text-grayBrand lg:max-w-none"
                >
                  {p}
                </motion.p>
              ))}

              {/* El cierre dejó de ser un renglón dorado más y pasó a caja con
                  filo: es la frase que empuja a comprar y tenía que separarse
                  del cuerpo. */}
              <motion.div
                variants={subir}
                className="max-w-xl border-y border-r border-brand/10 border-l-[3px] border-l-gold bg-white px-5 py-4 lg:max-w-none"
              >
                <p className="font-body text-[14.5px] font-bold leading-snug text-brand">
                  {historia.cierre}
                </p>
              </motion.div>

              <motion.div variants={subir}>
                <div className="flex items-center gap-3">
                  <Magnetic href="#boletas" className="btn-gold">
                    {historia.cta}
                  </Magnetic>
                  <ManitoClic color="azul" />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* La foto es lo más alto de la sección y lo que decide si cabe en
              pantalla. Conserva su 4:5, pero con un techo en altura de
              ventana: en un portátil bajo se recorta un poco por arriba y
              por abajo (la imagen va con object-cover) en vez de empujar la
              sección fuera de la pantalla. */}
          <Reveal /* TECHO DE ALTO, y es lo que hace que la seccion quepa en una pantalla.
              La foto es 4:5: en una columna de 600px mide 750px de alto, mas que
              la pantalla ella sola, y empujaba la cinta fuera de vista.

              Con el techo la caja se vuelve mas baja que 4:5 y `object-cover`
              recorta arriba y abajo -- NO deja aire a los lados, que era lo que
              el colegio veia antes: eso lo causaba el reparto de columnas, ya
              corregido. */
            className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-brand/15 lg:aspect-auto lg:h-[54vh] lg:min-h-[380px]">
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

            {/* El rango de años (1947 — 2027) salió por pedido del colegio:
                el 2027 no es la fecha del evento y confundía. Queda el nombre
                del colegio solo. */}
            <div className="absolute inset-x-0 bottom-0 bg-brand px-6 py-4">
              <p className="font-body text-xs font-black uppercase tracking-[0.14em] text-bone">
                {evento.colegio}
              </p>
            </div>
          </Reveal>
        </div>
      </div>

        <CintaPromociones />
    </section>
  );
}
