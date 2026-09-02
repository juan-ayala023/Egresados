'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import {
  boletas as boletasBase,
  boleteria,
  formatoCOP,
  totalPorBoleta,
  type Boleta,
} from '@/data';
import { obtenerBoletas, aPesos, type EstadoVenta } from '@/lib/api';
import RevealText from './RevealText';
import { dur, ease, enVista, subir } from '@/lib/motion';

/* ESTA SECCIÓN VA EN CLARO, como la de historia.
   Es el momento de la compra: es donde más letra chica hay (precio, tarifa,
   desglose, qué incluye) y es la que tiene que leerse sin esfuerzo. La
   tarjeta blanca sobre el fondo claro es lo que hace que el cuadro resalte,
   que era el pedido. Sobre claro el 139C no contrasta, así que los acentos
   de texto van en --gold-deep y el 139C queda para los rellenos: el
   distintivo y el botón, donde es fondo y no letra. */

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
      whileHover={agotada ? undefined : { y: -6 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex w-full flex-col rounded-xl border bg-white p-7 transition-colors duration-500 sm:p-9 ${
        agotada
          ? 'border-brand/10 opacity-50'
          : b.destacada
          ? 'border-gold shadow-[0_24px_70px_-40px_rgba(0,32,67,0.55)]'
          : 'border-brand/15 hover:border-brand/35'
      }`}
    >
      {/* Troqueles: los dos semicírculos que deja la máquina al cortar un
          tiquete. Van pintados del color del FONDO DE LA SECCIÓN, así que se
          leen como agujeros reales en la tarjeta; al pasar la sección a
          claro tuvieron que cambiar de --ink a --bone o quedaban dos
          lunares negros. */}
      <span
        aria-hidden
        className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-bone"
      />
      <span
        aria-hidden
        className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-bone"
      />
      {/* Perforación entre los dos troqueles */}
      <span
        aria-hidden
        className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, rgb(var(--brand)/0.22) 0 5px, transparent 5px 11px)',
        }}
      />

      {b.destacada && !agotada && (
        <span className="absolute -top-3 left-8 rounded-full bg-gold px-4 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">
          Más elegida
        </span>
      )}
      {agotada && (
        <span className="absolute -top-3 left-8 rounded-full border border-brand/20 bg-bone px-4 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-grayBrand">
          {ventaAbierta ? 'Agotada' : 'Venta cerrada'}
        </span>
      )}

      <h3 className="font-display font-bold text-2xl leading-tight text-brand sm:text-[1.7rem]">
        {b.nombre}
      </h3>
      <p className="mt-2.5 font-body text-[14px] text-grayBrand">{b.descripcion}</p>

      {/* Desglose: el asistente ve la tarifa de servicio antes de pagar,
          no al final del checkout. */}
      <div className="mt-7">
        <span className="lining font-display font-bold text-[2.6rem] leading-none text-brand">
          {formatoCOP(totalPorBoleta(b))}
        </span>
        <span className="ml-2 font-body text-xs uppercase tracking-[0.14em] text-grayBrand">
          {b.personas > 1 ? `/ ${b.personas} personas` : '/ persona'}
        </span>

        {b.tarifaServicio > 0 && (
          <dl className="mt-5 space-y-2 rounded-lg bg-brand/[0.05] px-5 py-4 font-body text-[13.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-grayBrand">Precio boleta</dt>
              <dd className="tabular-nums text-brand/80">{formatoCOP(b.precio)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-grayBrand">Tarifa de servicio</dt>
              <dd className="tabular-nums text-brand/80">{formatoCOP(b.tarifaServicio)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-brand/10 pt-2.5 font-semibold">
              <dt className="text-brand">Total a pagar</dt>
              <dd className="tabular-nums text-brand">{formatoCOP(totalPorBoleta(b))}</dd>
            </div>
          </dl>
        )}
      </div>

      <ul className="mt-7 flex-1 space-y-3">
        {b.incluye.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 font-body text-[14px] font-medium leading-snug text-brand/90"
          >
            <Check size={15} className="mt-0.5 shrink-0 text-goldDeep" strokeWidth={2.5} />
            {item}
          </li>
        ))}
      </ul>

      {/* Cantidad + CTA.
          No hay barra de cupos: el comité pidió no revelar cuántos quedan y
          el backend, en consecuencia, solo envía un booleano. */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center self-start rounded-full border border-brand/20 bg-white sm:self-auto">
          <button
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            disabled={agotada || cantidad <= 1}
            aria-label="Quitar una"
            className="flex h-11 w-11 items-center justify-center text-brand transition-colors hover:text-goldDeep disabled:opacity-25"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <span className="w-8 text-center font-body text-sm font-semibold tabular-nums text-brand">
            {cantidad}
          </span>
          <button
            onClick={() => setCantidad((c) => Math.min(tope, c + 1))}
            disabled={agotada || cantidad >= tope}
            aria-label="Agregar una"
            className="flex h-11 w-11 items-center justify-center text-brand transition-colors hover:text-goldDeep disabled:opacity-25"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>

        <motion.button
          whileTap={agotada ? undefined : { scale: 0.97 }}
          onClick={() => onComprar(b, cantidad)}
          disabled={agotada}
          className={`flex-1 rounded-full px-6 py-4 font-body text-[12px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
            agotada
              ? 'cursor-not-allowed border border-brand/15 text-grayBrand'
              : b.destacada
              ? 'bg-gold text-ink hover:bg-goldSoft hover:shadow-[0_16px_36px_-14px_rgb(var(--gold)/0.85)]'
              : 'border border-brand/30 text-brand hover:border-gold hover:text-goldDeep'
          }`}
        >
          {agotada ? (ventaAbierta ? 'Agotada' : 'Cerrada') : 'Confirmar mi lugar'}
        </motion.button>
      </div>
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
    <section id="boletas" className="relative overflow-hidden bg-bone py-24 md:py-32">
      {/* Encabezado y tarjeta comparten el mismo ancho: era el pedido, y es
          lo que deja el titular en un solo renglón. El cuerpo del titular
          está atado a 3.6vw justamente para que no se parta en escritorio. */}
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="text-center">
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="eyebrow-claro"
          >
            {boleteria.eyebrow}
          </motion.p>
          <RevealText
            texto={boleteria.titulo}
            as="h2"
            className="mt-4 font-display text-[clamp(1.7rem,3.6vw,2.5rem)] font-bold leading-[1.12] tracking-[-0.015em] text-brand"
            /* De "Celebración" en adelante, en dorado */
            acento={[5, 6, 7, 8, 9]}
            claseAcento="text-goldDeep"
          />
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="mx-auto mt-5 max-w-2xl font-body text-[15px] leading-relaxed text-grayBrand"
          >
            {boleteria.nota.replace('{max}', String(tope))}
          </motion.p>
        </div>

        <div
          className={`mt-14 grid items-stretch gap-6 ${
            boletas.length === 1 ? '' : boletas.length === 2 ? 'sm:grid-cols-2' : 'lg:grid-cols-3'
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
