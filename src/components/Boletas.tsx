'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { boletas, formatoCOP, totalPorBoleta, type Boleta } from '@/data';
import RevealText from './RevealText';
import Magnetic from './Magnetic';
import Aurora from './Aurora';
import LineaAgua from './LineaAgua';
import { dur, ease, enVista, escalonar, subir } from '@/lib/motion';

const MAX_POR_COMPRA = 4;

type Props = {
  onComprar: (boleta: Boleta, cantidad: number) => void;
};

function Tarjeta({ b, onComprar }: { b: Boleta; onComprar: Props['onComprar'] }) {
  const [cantidad, setCantidad] = useState(1);
  const disponibles = b.cuposTotales - b.cuposVendidos;
  const agotada = disponibles <= 0;
  const porcentaje = Math.round((b.cuposVendidos / b.cuposTotales) * 100);
  const casiAgotada = !agotada && porcentaje >= 70;

  return (
    <motion.div
      whileHover={agotada ? undefined : { y: -8 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex w-full flex-col rounded-sm border p-8 transition-colors duration-500 ${
        agotada
          ? 'border-white/[0.06] bg-surface/20 opacity-45'
          : b.destacada
          ? 'border-gold/45 bg-gradient-to-b from-gold/[0.07] to-transparent shadow-[0_0_60px_-25px_rgb(var(--gold)/0.5)]'
          : 'border-white/[0.09] bg-surface/40 hover:border-white/20'
      }`}
    >
      {/* Troqueles: los dos semicírculos que deja la máquina al cortar un
          tiquete. Van pintados del color del fondo de la sección, así que
          se leen como agujeros reales en la tarjeta. */}
      <span
        aria-hidden
        className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink"
      />
      <span
        aria-hidden
        className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink"
      />
      {/* Perforación entre los dos troqueles */}
      <span
        aria-hidden
        className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, rgb(var(--gold)/0.55) 0 5px, transparent 5px 11px)',
        }}
      />

      {b.destacada && !agotada && (
        <span className="absolute -top-3 left-8 rounded-full bg-gold px-4 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">
          Más elegida
        </span>
      )}
      {agotada && (
        <span className="absolute -top-3 left-8 rounded-full border border-white/20 bg-ink px-4 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Agotada
        </span>
      )}

      <h3 className="font-display font-bold text-3xl leading-none text-bone">{b.nombre}</h3>
      <p className="mt-3 font-body text-[13px] text-muted">{b.descripcion}</p>

      {/* Desglose: el asistente ve la tarifa de servicio antes de pagar,
          no al final del checkout. */}
      <div className="mt-7">
        <span className="lining font-display font-bold text-4xl text-gold">
          {formatoCOP(totalPorBoleta(b))}
        </span>
        <span className="ml-2 font-body text-xs uppercase tracking-[0.14em] text-muted">
          {b.personas > 1 ? `/ ${b.personas} personas` : '/ persona'}
        </span>

        {b.tarifaServicio > 0 && (
          <dl className="mt-4 space-y-1.5 border-t border-white/[0.08] pt-4 font-body text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Precio boleta</dt>
              <dd className="tabular-nums text-bone/75">{formatoCOP(b.precio)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tarifa de servicio</dt>
              <dd className="tabular-nums text-bone/75">{formatoCOP(b.tarifaServicio)}</dd>
            </div>
            <div className="flex justify-between pt-1.5 font-semibold">
              <dt className="text-bone">Total a pagar</dt>
              <dd className="tabular-nums text-gold">{formatoCOP(totalPorBoleta(b))}</dd>
            </div>
          </dl>
        )}
      </div>

      <ul className="mt-8 flex-1 space-y-3.5">
        {b.incluye.map((item) => (
          <li key={item} className="flex items-start gap-3 font-body text-[13.5px] leading-snug text-bone/70">
            <Check size={15} className="mt-0.5 shrink-0 text-gold" strokeWidth={2} />
            {item}
          </li>
        ))}
      </ul>

      {/* Disponibilidad */}
      <div className="mt-9">
        <div className="mb-2.5 flex items-baseline justify-between font-body text-[11px] uppercase tracking-[0.12em]">
          <span className={casiAgotada ? 'text-gold' : 'text-muted'}>
            {agotada ? 'Sin disponibilidad' : `${disponibles} de ${b.cuposTotales} disponibles`}
          </span>
          <span className="tabular-nums text-muted">{porcentaje}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${porcentaje}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className={`h-full rounded-full ${agotada ? 'bg-muted/50' : 'bg-gold'}`}
          />
        </div>
      </div>

      {/* Cantidad + CTA */}
      <div className="mt-7 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-white/12">
          <button
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            disabled={agotada || cantidad <= 1}
            aria-label="Quitar una"
            className="flex h-11 w-11 items-center justify-center text-bone transition-colors hover:text-gold disabled:opacity-25"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <span className="w-8 text-center font-body text-sm tabular-nums text-bone">{cantidad}</span>
          <button
            onClick={() => setCantidad((c) => Math.min(MAX_POR_COMPRA, disponibles, c + 1))}
            disabled={agotada || cantidad >= Math.min(MAX_POR_COMPRA, disponibles)}
            aria-label="Agregar una"
            className="flex h-11 w-11 items-center justify-center text-bone transition-colors hover:text-gold disabled:opacity-25"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>

        <motion.button
          whileTap={agotada ? undefined : { scale: 0.97 }}
          onClick={() => onComprar(b, cantidad)}
          disabled={agotada}
          className={`flex-1 rounded-full px-6 py-3.5 font-body text-[12px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
            agotada
              ? 'cursor-not-allowed border border-white/10 text-muted'
              : b.destacada
              ? 'bg-gold text-ink hover:bg-goldSoft hover:shadow-[0_0_36px_-8px_rgb(var(--gold)/0.7)]'
              : 'border border-white/20 text-bone hover:border-gold hover:text-gold'
          }`}
        >
          {agotada ? 'Agotada' : 'Continuar'}
        </motion.button>
      </div>

      {/* Resplandor que sigue el hover */}
      {!agotada && (
        <div className="pointer-events-none absolute inset-0 rounded-sm opacity-0 transition-opacity duration-700 group-hover:opacity-100"
             style={{ boxShadow: '0 30px 80px -30px rgb(var(--gold) / 0.35)' }} />
      )}
    </motion.div>
  );
}

export default function Boletas({ onComprar }: Props) {
  return (
    <section
      id="boletas"
      className="relative overflow-hidden border-y border-white/[0.06] bg-surface/30 py-28 md:py-36"
    >
      <Aurora variante="oro" intensidad={0.9} />

      <div className="relative mx-auto max-w-7xl px-6">
        <LineaAgua className="mb-16 opacity-70" />
        <div className="mx-auto max-w-2xl text-center">
          <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista} className="eyebrow">
            Boletería
          </motion.p>
          <RevealText
            texto="Asegura tu lugar en la noche"
            as="h2"
            className="mt-6 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
            acento={[4]}
          />
          <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista}
                    className="mt-6 font-body text-[15px] leading-relaxed text-bone/60">
            Máximo {MAX_POR_COMPRA} boletas por compra. Cada asistente se registra con
            nombre y cédula para el ingreso.
          </motion.p>
        </div>

        <div
          className={`mt-16 grid items-stretch gap-6 ${
            boletas.length === 1
              ? 'mx-auto max-w-md'
              : boletas.length === 2
              ? 'sm:grid-cols-2'
              : 'lg:grid-cols-3'
          }`}
        >
          {boletas.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 46, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={enVista}
              transition={{ duration: dur.slow, ease: ease.out, delay: i * 0.14 }}
              className="flex"
            >
              <div className="flex w-full">
                <Tarjeta b={b} onComprar={onComprar} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
