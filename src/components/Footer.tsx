'use client';

import { Instagram, Mail, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { contacto, evento } from '@/data';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import { enVista, subir } from '@/lib/motion';

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.08] bg-surface/30">
      {/* Cierre */}
      <div className="mx-auto max-w-4xl px-6 py-24 text-center md:py-32">
        <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista} className="eyebrow">
          {evento.fechaTexto}
        </motion.p>
        <RevealText
          texto={`Nos vemos en ${evento.lugar}`}
          as="h2"
          className="mt-6 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.02em]"
          acento={[3, 4, 5]}
          saltos={[1]}
          gap={0.09}
        />
        <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista}
                  className="mx-auto mt-7 max-w-md font-body text-[15px] leading-relaxed text-bone/55">
          {evento.horaTexto} · {evento.codigoVestuario}
        </motion.p>
        <motion.div variants={subir} initial="oculto" whileInView="visible" viewport={enVista} className="mt-10">
          <Magnetic href="#boletas" className="btn-gold">
            Comprar mi boleta
          </Magnetic>
        </motion.div>
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
            <div className="flex items-baseline justify-center gap-2.5 md:justify-start">
              <span className="font-display text-3xl leading-none text-gold">80</span>
              <span className="font-body text-[10px] uppercase tracking-eyebrow text-muted">
                Años
              </span>
            </div>
            <p className="mt-4 font-body text-sm text-bone/70">{evento.colegio}</p>
            <p className="mt-1 font-body text-[12px] text-muted">{contacto.comite}</p>
          </div>

          <div className="flex flex-col items-center gap-3 md:items-end">
            <a
              href={`mailto:${contacto.correo}`}
              className="flex items-center gap-2.5 font-body text-[13px] text-bone/60 transition-colors hover:text-gold"
            >
              <Mail size={14} strokeWidth={1.5} />
              {contacto.correo}
            </a>
            <a
              href={`tel:${contacto.telefono.replace(/\s/g, '')}`}
              className="flex items-center gap-2.5 font-body text-[13px] text-bone/60 transition-colors hover:text-gold"
            >
              <Phone size={14} strokeWidth={1.5} />
              {contacto.telefono}
            </a>
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
