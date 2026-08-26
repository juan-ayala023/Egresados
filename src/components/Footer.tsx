'use client';

import Image from 'next/image';

import { Instagram, Mail, Phone, MapPin, Clock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { contacto, evento, imagenes } from '@/data';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import Aurora from './Aurora';
import LineaAgua from './LineaAgua';
import { enVista, subir } from '@/lib/motion';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.08] bg-surface/30">
      {/* Cierre.
          Antes esto era texto suelto sobre un rectángulo vacío. Ahora tiene
          tres capas de profundidad: la foto del salón al fondo muy apagada,
          la luz ambiental encima, y el contenido flotando sobre ambas. */}
      <div className="relative">
        <div aria-hidden className="absolute inset-0">
          <Image
            src={imagenes.hero}
            alt=""
            fill
            sizes="100vw"
            className="scale-105 object-cover opacity-[0.18] blur-[2px]"
          />
          {/* Degradados que funden la foto con el fondo por los cuatro lados,
              para que no se vea un recorte rectangular pegado. */}
          <div className="absolute inset-0 bg-gradient-to-b from-surface via-ink/85 to-surface" />
          <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_50%,transparent,rgb(var(--ink)/0.9))]" />
        </div>

        <Aurora variante="mixta" intensidad={1.1} />

        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center md:py-36">
          {/* El "80 YEARS" como marca de agua gigante detrás del titular */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 1.08 }}
            whileInView={{ opacity: 0.07, scale: 1 }}
            viewport={enVista}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
          >
            <Image
              src={imagenes.logoVertical}
              alt=""
              width={562}
              height={670}
              className="mx-auto h-64 w-auto md:h-80"
            />
          </motion.div>

          <div className="relative">
            <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista} className="eyebrow">
              {evento.fechaTexto}
            </motion.p>

            <RevealText
              texto={`Nos vemos en ${evento.lugar}`}
              as="h2"
              className="mt-6 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.02em]"
              acento={[3, 4, 5]}
              saltos={[1]}
              gap={0.09}
            />

            <LineaAgua className="mx-auto mt-8 max-w-sm" />

            {/* Los datos duros, separados y legibles, en vez de una sola
                línea corrida de texto gris. */}
            <motion.div
              variants={subir}
              initial="oculto"
              whileInView="visible"
              viewport={enVista}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 font-body text-[13px] text-bone/70"
            >
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-gold" strokeWidth={1.5} />
                {evento.direccion}
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
              <span className="flex items-center gap-2">
                <Clock size={14} className="text-gold" strokeWidth={1.5} />
                {evento.horaTexto}
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-gold" strokeWidth={1.5} />
                {evento.codigoVestuario}
              </span>
            </motion.div>

            <motion.div variants={subir} initial="oculto" whileInView="visible" viewport={enVista} className="mt-11">
              <Magnetic href="#boletas" className="btn-gold">
                Comprar mi boleta
              </Magnetic>
            </motion.div>

            <motion.p
              variants={subir}
              initial="oculto"
              whileInView="visible"
              viewport={enVista}
              className="mt-6 font-body text-[12px] uppercase tracking-[0.16em] text-gold/70"
            >
              {evento.urgencia}
            </motion.p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={enVista}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        className="gold-rule origin-center"
      />

      {/* Datos */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            {/* El lockup vertical ya dice el nombre del colegio, así que la
                línea de texto que lo repetía sobraba. */}
            <Image
              src={imagenes.logoVertical}
              alt={`${evento.titulo} · ${evento.colegio}`}
              width={562}
              height={670}
              className="mx-auto h-28 w-auto md:mx-0"
            />
            <p className="mt-5 font-body text-[12px] text-muted">{contacto.comite}</p>
          </div>

          <div className="flex flex-col items-center gap-3 md:items-end">
            {contacto.correo && (
              <a
                href={`mailto:${contacto.correo}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-bone/60 transition-colors hover:text-gold"
              >
                <Mail size={14} strokeWidth={1.5} />
                {contacto.correo}
              </a>
            )}
            {contacto.telefono && (
              <a
                href={`tel:${contacto.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-bone/60 transition-colors hover:text-gold"
              >
                <Phone size={14} strokeWidth={1.5} />
                {contacto.telefono}
              </a>
            )}
            <span className="flex items-center gap-2.5 font-body text-[13px] text-bone/60">
              <Instagram size={14} strokeWidth={1.5} />
              {contacto.instagram}
            </span>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-8 font-body text-[11px] uppercase tracking-[0.14em] text-muted md:flex-row">
          <span>
            © {new Date().getFullYear()} {evento.colegio}
          </span>
          <span>Pagos procesados por Wompi</span>
        </div>
      </div>
    </footer>
  );
}
