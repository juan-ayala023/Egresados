'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { faq, contacto } from '@/data';
import RevealText from './RevealText';
import { dur, ease, enVista, subir } from '@/lib/motion';

export default function FAQ() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-4xl px-6 py-28 md:py-36">
      <div className="text-center">
        <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista} className="eyebrow">
          Antes de comprar
        </motion.p>
        <RevealText
          texto="Lo que todos preguntan"
          as="h2"
          className="mt-6 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.015em]"
          acento={[2]}
        />
      </div>

      <div className="mt-14 divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {faq.map((f, i) => {
          const activa = abierta === i;
          return (
            <motion.div
              key={f.pregunta}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={enVista}
              transition={{ duration: dur.base, ease: ease.out, delay: i * 0.07 }}
            >
              <button
                onClick={() => setAbierta(activa ? null : i)}
                aria-expanded={activa}
                className="flex w-full items-center justify-between gap-6 py-6 text-left transition-colors hover:text-gold"
              >
                <span className="font-display font-bold text-lg leading-snug text-bone sm:text-xl">
                  {f.pregunta}
                </span>
                <motion.span
                  animate={{ rotate: activa ? 45 : 0 }}
                  transition={{ duration: 0.3 }}
                  className={`shrink-0 ${activa ? 'text-gold' : 'text-muted'}`}
                >
                  <Plus size={18} strokeWidth={1.5} />
                </motion.span>
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
                    <p className="max-w-2xl pb-7 font-body text-[14.5px] leading-[1.85] text-bone/60">
                      {f.respuesta}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-10 text-center font-body text-[13px] text-muted">
        ¿Otra pregunta? Escríbenos a{' '}
        <a href={`mailto:${contacto.correo}`} className="text-gold underline-offset-4 hover:underline">
          {contacto.correo}
        </a>
      </p>
    </section>
  );
}
