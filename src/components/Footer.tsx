'use client';

import { Instagram, Mail, Phone, MapPin, CalendarDays, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cierre, contacto, evento } from '@/data';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import { enVista, subir } from '@/lib/motion';

/* EL PIE VA EN CLARO, como historia y boletería.
   Es el último empujón a la compra y también la letra chica legal: las dos
   cosas se leen mejor sobre claro. Sobre --bone el 139C no contrasta como
   letra, así que los textos dorados van en --gold-deep y el 139C se queda
   donde es relleno: el botón y el punto de la línea de urgencia. */

export default function Footer() {
  return (
    <footer className="relative bg-bone">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-28">
        <RevealText
          texto={cierre.titulo}
          as="h2"
          className="font-display text-[clamp(1.9rem,4.4vw,3rem)] font-bold leading-[1.12] tracking-[-0.02em] text-brand"
          acento={[9]}
          claseAcento="text-goldDeep"
          gap={0.07}
        />

        <motion.p
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="mx-auto mt-5 max-w-xl font-body text-[15px] leading-relaxed text-grayBrand"
        >
          {cierre.subtitulo}
        </motion.p>

        {/* Los datos duros del evento en una pastilla, no en una línea corrida
            de texto gris: es el último sitio donde alguien confirma cuándo y
            dónde antes de comprar. */}
        <motion.div
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="mx-auto mt-7 inline-flex flex-col items-center gap-y-2.5 rounded-2xl border border-brand/12 bg-white px-6 py-3.5 font-body text-[13.5px] font-medium text-brand sm:flex-row sm:gap-x-5"
        >
          <span className="flex items-center gap-2">
            <CalendarDays size={15} className="shrink-0 text-goldDeep" strokeWidth={1.75} />
            {evento.fechaTexto}
          </span>
          <span aria-hidden className="hidden h-3.5 w-px bg-brand/15 sm:block" />
          <span className="flex items-center gap-2">
            <MapPin size={15} className="shrink-0 text-goldDeep" strokeWidth={1.75} />
            {evento.lugar}
          </span>
          <span aria-hidden className="hidden h-3.5 w-px bg-brand/15 sm:block" />
          <span className="flex items-center gap-2">
            <Clock size={15} className="shrink-0 text-goldDeep" strokeWidth={1.75} />
            {evento.horaTexto}
          </span>
        </motion.div>

        <motion.div
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="mt-9"
        >
          <Magnetic href="#boletas" className="btn-gold">
            {cierre.cta}
          </Magnetic>
        </motion.div>

        <motion.p
          variants={subir}
          initial="oculto"
          whileInView="visible"
          viewport={enVista}
          className="mt-6 flex items-center justify-center gap-2.5 font-body text-[12px] font-semibold uppercase tracking-[0.16em] text-goldDeep"
        >
          <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
          </span>
          {evento.urgencia}
        </motion.p>
      </div>

      {/* Datos.
          Sin logotipo: el único archivo que hay es la versión sobre fondo
          oscuro y aquí desaparecería. Va el lockup escrito, que es lo que
          pide la referencia. */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 border-t border-brand/10 py-8 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-brand">
              {evento.colegio} {evento.aniversario} Years
            </p>
            <p className="mt-1.5 font-body text-[13px] text-grayBrand">{contacto.comite}</p>
          </div>

          <div className="flex flex-col items-center gap-2.5 md:items-end">
            {contacto.correo && (
              <a
                href={`mailto:${contacto.correo}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-grayBrand transition-colors hover:text-goldDeep"
              >
                <Mail size={14} strokeWidth={1.75} />
                {contacto.correo}
              </a>
            )}
            {contacto.telefono && (
              <a
                href={`tel:${contacto.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-grayBrand transition-colors hover:text-goldDeep"
              >
                <Phone size={14} strokeWidth={1.75} />
                {contacto.telefono}
              </a>
            )}
            <span className="flex items-center gap-2.5 font-body text-[13px] font-medium text-brand">
              <Instagram size={14} strokeWidth={1.75} />
              {contacto.instagram}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-brand/10 py-6 font-body text-[11px] uppercase tracking-[0.14em] text-grayBrand md:flex-row">
          <span>
            © {new Date().getFullYear()} {evento.colegio}. Todos los derechos reservados.
          </span>
          <span>Pagos procesados de forma segura por Wompi</span>
        </div>
      </div>
    </footer>
  );
}
