'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { boletas as boletasBase, formatoCOP, totalPorBoleta, type Boleta } from '@/data';
import { obtenerBoletas, aPesos, type EstadoVenta } from '@/lib/api';
import RevealText from './RevealText';
import Aurora from './Aurora';
import LineaAgua from './LineaAgua';
import { dur, ease, enVista, subir } from '@/lib/motion';

/* La boleta que pinta la tarjeta: el contenido editorial sale de data.ts
   (nombre, descripción, qué incluye) y lo comercial del backend (precio,
   tarifa, tope por compra, disponibilidad). El servidor es la única fuente
   de verdad sobre lo que se cobra; data.ts solo evita que la sección
   aparezca vacía mientras responde la API. */
type BoletaVista = Boleta & { maxPorCompra: number; disponible: boolean };

const desdeBase = (b: Boleta): BoletaVista => ({ ...b, maxPorCompra: 4, disponible: true });

type Props = {
  onComprar: (boleta: Boleta, cantidad: number) => void;
};

function Tarjeta({
  b,
  ventaAbierta,
  onComprar,
}: {
  b: BoletaVista;
  ventaAbierta: boolean;
  onComprar: Props['onComprar'];
}) {
  const [cantidad, setCantidad] = useState(1);
  const agotada = !b.disponible || !ventaAbierta;
  const tope = b.maxPorCompra;

  /* Si el backend baja el tope mientras la tarjeta está abierta, la cantidad
     elegida podría quedar por encima. Se corrige sola en vez de mandar al
     servidor una orden que va a rebotar. */
  useEffect(() => {
    setCantidad((c) => Math.min(c, tope));
  }, [tope]);

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
          {ventaAbierta ? 'Agotada' : 'Venta cerrada'}
        </span>
      )}

      <h3 className="font-display font-bold text-2xl leading-tight text-bone">{b.nombre}</h3>
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

      {/* Cantidad + CTA.
          No hay barra de cupos: el comité pidió no revelar cuántos quedan y
          el backend, en consecuencia, solo envía un booleano. */}
      <div className="mt-9 flex items-center gap-3">
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
            onClick={() => setCantidad((c) => Math.min(tope, c + 1))}
            disabled={agotada || cantidad >= tope}
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
          {agotada ? (ventaAbierta ? 'Agotada' : 'Cerrada') : 'Confirmar mi lugar'}
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
  const [boletas, setBoletas] = useState<BoletaVista[]>(() => boletasBase.map(desdeBase));
  const [estadoVenta, setEstadoVenta] = useState<EstadoVenta>('abierta');

  /* Arranca con lo de data.ts para que la sección nunca aparezca vacía, y se
     sobrescribe con lo que diga el servidor. Si la API no responde queda el
     precio local: la orden se valida igual del lado del backend, así que
     nadie puede pagar un valor distinto al vigente. */
  useEffect(() => {
    let vivo = true;
    obtenerBoletas()
      .then(({ estadoVenta, boletas }) => {
        if (!vivo) return;
        setEstadoVenta(estadoVenta);
        setBoletas(
          boletas.map((api) => {
            const base = boletasBase.find((b) => b.id === api.id) ?? boletasBase[0];
            return {
              ...base,
              id: api.id,
              nombre: base.nombre,
              precio: aPesos(api.precioCentavos),
              tarifaServicio: aPesos(api.tarifaServicioCentavos),
              maxPorCompra: api.maxPorCompra,
              disponible: api.disponible,
            };
          })
        );
      })
      .catch(() => {
        /* Silencio deliberado: la sección ya tiene contenido de data.ts y un
           error de red aquí no debe tapar la página con una alerta. */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const tope = boletas[0]?.maxPorCompra ?? 4;

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
            texto="Asegura tu lugar en el Reencuentro de los 80 Años"
            as="h2"
            className="mt-6 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
            acento={[5]}
          />
          <motion.p variants={subir} initial="oculto" whileInView="visible" viewport={enVista}
                    className="mt-6 font-body text-[15px] leading-relaxed text-bone/60">
            Máximo {tope} boletas por compra. Registro personal con nombre y
            cédula para garantizar un acceso ágil.
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
                <Tarjeta b={b} ventaAbierta={estadoVenta === 'abierta'} onComprar={onComprar} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
