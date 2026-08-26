'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { imagenes } from '@/data';
import { dur, ease, enVista } from '@/lib/motion';

/* Banda clara entre la galería y la boletería.
   Es el único respiro luminoso del sitio, y está ahí a propósito: llega
   justo después de ver las fotos de la edición pasada y justo antes de
   pedir la compra. El fondo claro no es capricho — el lettering es azul
   280C y sobre el navy del resto del sitio quedaba en 2.0:1. */
export default function Frase() {
  return (
    <section className="relative overflow-hidden bg-bone py-20 md:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={enVista}
          transition={{ duration: dur.slow, ease: ease.out }}
          className="w-full max-w-2xl"
        >
          <Image
            src={imagenes.fraseTiger}
            alt="Once a Tiger, Always a Tiger"
            width={650}
            height={361}
            className="h-auto w-full"
          />
        </motion.div>

        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={enVista}
          transition={{ duration: dur.reveal, ease: ease.out, delay: 0.2 }}
          className="mt-10 h-px w-24 bg-brand/30"
        />
      </div>
    </section>
  );
}
