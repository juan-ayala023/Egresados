'use client';

import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import Photo from './Photo';
import Reveal from './Reveal';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import { enVista, subir, escalonar } from '@/lib/motion';
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
      <div className="relative mx-auto max-w-7xl px-6 py-14 md:py-16">
        <div ref={ref} className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
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

              <motion.div variants={subir}>
                <Magnetic href="#boletas" className="btn-gold">
                  {historia.cta}
                </Magnetic>
              </motion.div>
            </motion.div>
          </div>

          {/* La foto es lo más alto de la sección y lo que decide si cabe en
              pantalla. Conserva su 4:5, pero con un techo en altura de
              ventana: en un portátil bajo se recorta un poco por arriba y
              por abajo (la imagen va con object-cover) en vez de empujar la
              sección fuera de la pantalla. */}
          <Reveal className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-brand/15 lg:max-h-[62vh]">
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
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-bone">
                {evento.colegio}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
