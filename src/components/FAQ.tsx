'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Plus, Minus, Beer, Ticket, MapPin } from 'lucide-react';
import { faq, contacto } from '@/data';
import RevealText from './RevealText';
import { dur, ease, enVista, subir } from '@/lib/motion';

/* Traduce la llave que viene de data.ts al icono real */
const ICONOS = {
  bebidas: Beer,
  boletas: Ticket,
  acceso: MapPin,
};

export default function FAQ() {
  /* Se identifica por el texto de la pregunta y no por índice: con las
     categorías, el índice 0 existe en las tres y se abrirían todas a la vez.
     Arranca abierta la primera de todas, como antes. */
  const [abierta, setAbierta] = useState<string | null>(faq[0].preguntas[0].pregunta);

  return (
    <section id="faq" className="mx-auto max-w-4xl px-6 py-24 md:py-32">
      {/* Todo el bloque vive dentro de un panel: las preguntas pasaron de ser
          renglones separados por líneas a tarjetas blancas, y sin un fondo
          propio esas tarjetas quedaban flotando sueltas sobre la página. */}
      {/* Relleno lateral corto a propósito: en la referencia los cajones de las
          preguntas llegan casi al filo del panel. Con el px-10 de antes
          quedaban 80px de aire a los lados y las tarjetas se veían angostas
          dentro de un marco enorme. */}
      <div className="rounded-2xl border border-gold/30 bg-surface/50 px-4 py-9 sm:px-6 sm:py-12">
        <div className="text-center">
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="eyebrow"
          >
            Antes de comprar
          </motion.p>
          <RevealText
            texto="Lo que todos preguntan"
            as="h2"
            className="mt-3 font-display text-[clamp(1.5rem,3.2vw,2.05rem)] font-bold leading-[1.15] tracking-[-0.015em]"
            acento={[2]}
          />
        </div>

        <div className="mt-10 space-y-9">
          {faq.map((grupo) => {
            const Icono = ICONOS[grupo.icono];
            return (
              <div key={grupo.categoria}>
                <motion.h3
                  variants={subir}
                  initial="oculto"
                  whileInView="visible"
                  viewport={enVista}
                  /* Más peso y sin la transparencia del .eyebrow de la casa:
                     estos no son una etiqueta de sección sino el rótulo que
                     separa los tres grupos de preguntas, y al 70% de opacidad
                     y peso normal se perdían entre las tarjetas blancas. */
                  className="eyebrow flex items-center gap-2.5 text-[12.5px] font-bold text-gold"
                >
                  <Icono size={17} strokeWidth={2.25} className="shrink-0 text-gold" aria-hidden />
                  {grupo.categoria}
                </motion.h3>

                <div className="mt-4 space-y-3">
                  {grupo.preguntas.map((f, i) => {
                    const activa = abierta === f.pregunta;
                    return (
                      <motion.div
                        key={f.pregunta}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={enVista}
                        transition={{ duration: dur.base, ease: ease.out, delay: i * 0.07 }}
                        /* Tarjeta blanca sobre el navy: es lo que separa una
                           pregunta de la siguiente ahora que no hay líneas
                           divisorias, y lo que hace que el texto resalte.

                           El color va en un filo de 4px a la izquierda y no
                           en el borde completo: rodear toda la tarjeta de
                           amarillo la convierte en una advertencia. El filo
                           marca además en qué estado está — dorado cerrada,
                           azul la que está abierta — que es más claro que
                           fiarlo todo al signo de la derecha. */
                        className={`overflow-hidden rounded-lg border-y border-r border-l-4 bg-white transition-colors duration-300 ${
                          activa
                            ? 'border-brand/15 border-l-brand shadow-[0_18px_40px_-24px_rgba(0,0,0,0.65)]'
                            : 'border-brand/10 border-l-gold hover:border-l-goldSoft'
                        }`}
                      >
                        <button
                          onClick={() => setAbierta(activa ? null : f.pregunta)}
                          aria-expanded={activa}
                          className="flex w-full items-center justify-between gap-5 px-5 py-4 text-left"
                        >
                          <span className="font-display font-bold text-[15px] leading-snug text-brand sm:text-base">
                            {f.pregunta}
                          </span>
                          {/* Menos al abrir, no la cruz que salía de girar el
                              más: cerrar una pregunta no es descartarla. */}
                          <span className="shrink-0 text-goldDeep">
                            {activa ? (
                              <Minus size={18} strokeWidth={2} />
                            ) : (
                              <Plus size={18} strokeWidth={2} />
                            )}
                          </span>
                        </button>

                        <AnimatePresence initial={false}>
                          {activa && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.5, ease: ease.out }}
                              className="overflow-hidden"
                            >
                              <p className="border-t border-brand/10 px-5 pb-5 pt-4 font-body text-[14px] leading-[1.8] text-grayBrand">
                                {f.respuesta}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sin correo no hay línea. Antes se pintaba "Escríbenos a" seguido de
          nada y un enlace mailto vacío: misma regla que el Footer y el botón
          de WhatsApp, antes un hueco que un dato inventado. */}
      {contacto.correo && (
        <p className="mt-10 text-center font-body text-[13px] text-muted">
          ¿Otra pregunta? Escríbenos a{' '}
          <a href={`mailto:${contacto.correo}`} className="text-gold underline-offset-4 hover:underline">
            {contacto.correo}
          </a>
        </p>
      )}
    </section>
  );
}
