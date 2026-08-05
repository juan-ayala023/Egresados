'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { X, ArrowLeft, Loader2, ShieldCheck, Download, Mail, Check } from 'lucide-react';
import CodigoQR from './CodigoQR';
import { ease } from '@/lib/motion';
import {
  anosGraduacion,
  evento,
  formatoCOP,
  metodosPago,
  type Boleta,
} from '@/data';

type Asistente = {
  nombre: string;
  cedula: string;
  correo: string;
  celular: string;
  promocion: string;
};

const vacio = (): Asistente => ({
  nombre: '',
  cedula: '',
  correo: '',
  celular: '',
  promocion: '',
});

const PASOS = ['Asistentes', 'Pago', 'Confirmación'];

type Props = {
  boleta: Boleta | null;
  cantidad: number;
  onClose: () => void;
};

export default function Checkout({ boleta, cantidad, onClose }: Props) {
  const [paso, setPaso] = useState(0);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [errores, setErrores] = useState<Record<string, boolean>>({});
  const [metodo, setMetodo] = useState(metodosPago[0].id);
  const [procesando, setProcesando] = useState(false);
  const [orden, setOrden] = useState('');
  const [sentido, setSentido] = useState(1);

  useEffect(() => {
    if (boleta) {
      setPaso(0);
      setAsistentes(Array.from({ length: cantidad }, vacio));
      setErrores({});
      setProcesando(false);
      setOrden('');
      setSentido(1);
    }
  }, [boleta, cantidad]);

  useEffect(() => {
    if (!boleta) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !procesando && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [boleta, procesando, onClose]);

  const total = useMemo(() => (boleta ? boleta.precio * cantidad : 0), [boleta, cantidad]);

  const actualizar = (i: number, campo: keyof Asistente, valor: string) => {
    setAsistentes((prev) => prev.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));
    setErrores((prev) => ({ ...prev, [`${i}-${campo}`]: false }));
  };

  const validar = () => {
    const nuevos: Record<string, boolean> = {};
    asistentes.forEach((a, i) => {
      if (a.nombre.trim().length < 5) nuevos[`${i}-nombre`] = true;
      if (a.cedula.trim().length < 6) nuevos[`${i}-cedula`] = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.correo)) nuevos[`${i}-correo`] = true;
      if (a.celular.replace(/\D/g, '').length < 10) nuevos[`${i}-celular`] = true;
      if (!a.promocion) nuevos[`${i}-promocion`] = true;
    });
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const pagar = () => {
    setProcesando(true);
    setTimeout(() => {
      setOrden(`HC80-${Math.floor(100000 + Math.random() * 899999)}`);
      setProcesando(false);
      setSentido(1);
      setPaso(2);
    }, 2200);
  };

  const err = (i: number, campo: string) =>
    errores[`${i}-${campo}`] ? 'border-red-400/60 bg-red-400/[0.04]' : '';

  return (
    <AnimatePresence>
      {boleta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink/92 px-4 py-8 backdrop-blur-md sm:items-center"
          onClick={() => !procesando && onClose()}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-lg border border-white/10 bg-surface shadow-2xl"
          >
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-7 py-5">
              <div className="flex items-center gap-4">
                {paso === 1 && !procesando && (
                  <button
                    onClick={() => { setSentido(-1); setPaso(0); }}
                    aria-label="Volver"
                    className="text-muted transition-colors hover:text-gold"
                  >
                    <ArrowLeft size={18} strokeWidth={1.5} />
                  </button>
                )}
                <div>
                  <p className="font-body text-[10px] uppercase tracking-eyebrow text-gold/70">
                    Paso {paso + 1} de 3
                  </p>
                  <h3 className="mt-1 font-display text-xl text-bone">{PASOS[paso]}</h3>
                </div>
              </div>
              {!procesando && (
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="text-muted transition-colors hover:text-gold"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Progreso */}
            <div className="flex gap-1.5 px-7 pt-5">
              {PASOS.map((_, i) => (
                <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    animate={{ width: i <= paso ? '100%' : '0%' }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gold"
                  />
                </div>
              ))}
            </div>

            <div className="relative max-h-[62vh] overflow-y-auto px-7 py-7">
             <AnimatePresence mode="wait" custom={sentido}>
              <motion.div
                key={paso}
                custom={sentido}
                initial={{ opacity: 0, x: sentido * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: sentido * -28 }}
                transition={{ duration: 0.38, ease: ease.out }}
              >
              {/* ---------- PASO 1 ---------- */}
              {paso === 0 && (
                <div className="space-y-8">
                  <p className="font-body text-[13px] leading-relaxed text-muted">
                    Registra los datos de cada persona que va a ingresar. El QR se emite
                    individualmente y se valida en la entrada.
                  </p>

                  {asistentes.map((a, i) => (
                    <div key={i} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg text-gold">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                          {i === 0 ? 'Titular de la compra' : `Acompañante ${i}`}
                        </span>
                        <div className="h-px flex-1 bg-white/[0.08]" />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="label">Nombre completo</label>
                          <input
                            value={a.nombre}
                            onChange={(e) => actualizar(i, 'nombre', e.target.value)}
                            placeholder="Como aparece en el documento"
                            className={`field ${err(i, 'nombre')}`}
                          />
                        </div>
                        <div>
                          <label className="label">Cédula</label>
                          <input
                            value={a.cedula}
                            onChange={(e) => actualizar(i, 'cedula', e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            placeholder="1020304050"
                            className={`field ${err(i, 'cedula')}`}
                          />
                        </div>
                        <div>
                          <label className="label">Celular</label>
                          <input
                            value={a.celular}
                            onChange={(e) => actualizar(i, 'celular', e.target.value)}
                            inputMode="tel"
                            placeholder="300 000 0000"
                            className={`field ${err(i, 'celular')}`}
                          />
                        </div>
                        <div>
                          <label className="label">Correo</label>
                          <input
                            value={a.correo}
                            onChange={(e) => actualizar(i, 'correo', e.target.value)}
                            inputMode="email"
                            placeholder="nombre@correo.com"
                            className={`field ${err(i, 'correo')}`}
                          />
                        </div>
                        <div>
                          <label className="label">Promoción</label>
                          <select
                            value={a.promocion}
                            onChange={(e) => actualizar(i, 'promocion', e.target.value)}
                            className={`field ${err(i, 'promocion')}`}
                          >
                            <option value="">Año de grado</option>
                            <option value="no-egresado">No soy egresado</option>
                            {anosGraduacion.map((y) => (
                              <option key={y} value={String(y)}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {Object.keys(errores).length > 0 && (
                    <p className="font-body text-[13px] text-red-400/90">
                      Revisa los campos marcados. Faltan datos o el formato no es válido.
                    </p>
                  )}
                </div>
              )}

              {/* ---------- PASO 2 ---------- */}
              {paso === 1 && (
                <div className="space-y-8">
                  <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="font-display text-xl text-bone">{boleta.nombre}</p>
                        <p className="mt-1 font-body text-[12px] text-muted">
                          {cantidad} {cantidad === 1 ? 'boleta' : 'boletas'} ·{' '}
                          {formatoCOP(boleta.precio)} c/u
                        </p>
                      </div>
                      <span className="font-body text-sm tabular-nums text-bone/70">
                        {formatoCOP(total)}
                      </span>
                    </div>

                    <div className="my-5 h-px bg-white/[0.08]" />

                    <div className="flex items-baseline justify-between">
                      <span className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                        Total a pagar
                      </span>
                      <span className="lining font-display text-3xl text-gold">{formatoCOP(total)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="label">Método de pago</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {metodosPago.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMetodo(m.id)}
                          className={`flex items-center justify-between rounded-sm border px-4 py-3.5 text-left transition-all ${
                            metodo === m.id
                              ? 'border-gold/60 bg-gold/[0.06]'
                              : 'border-white/10 hover:border-white/25'
                          }`}
                        >
                          <span>
                            <span className="block font-body text-sm text-bone">{m.nombre}</span>
                            <span className="mt-0.5 block font-body text-[11px] text-muted">
                              {m.detalle}
                            </span>
                          </span>
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                              metodo === m.id ? 'border-gold bg-gold' : 'border-white/25'
                            }`}
                          >
                            {metodo === m.id && <Check size={10} className="text-ink" strokeWidth={3} />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <ShieldCheck size={16} className="shrink-0 text-gold" strokeWidth={1.5} />
                    <p className="font-body text-[12px] leading-relaxed text-muted">
                      Pagos procesados por <span className="text-bone/80">Wompi</span>. Los datos
                      de tu tarjeta nunca pasan por este sitio.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------- PASO 3 ---------- */}
              {paso === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }}
                    className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
                  >
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0.9 }}
                      animate={{ scale: 2.1, opacity: 0 }}
                      transition={{ delay: 0.3, duration: 1.1, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full border border-gold/50"
                    />
                    <Check size={26} className="text-gold" strokeWidth={2} />
                  </motion.div>

                  <h4 className="mt-7 font-display text-3xl text-bone">Tu boleta está lista</h4>
                  <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
                    Enviamos {cantidad === 1 ? 'la boleta' : 'las boletas'} a{' '}
                    <span className="text-bone/80">{asistentes[0]?.correo || 'tu correo'}</span>.
                    Presenta el QR en la entrada.
                  </p>

                  <div className="mx-auto mt-9 max-w-sm rounded-sm border border-white/[0.1] bg-white/[0.02] p-7">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      transition={{ delay: 0.42, duration: 0.7, ease: ease.out }}
                      className="flex justify-center"
                    >
                      <CodigoQR seed={orden} />
                    </motion.div>
                    <div className="mt-6 space-y-2.5 text-left">
                      {[
                        ['Orden', orden],
                        ['Asistente', asistentes[0]?.nombre || '—'],
                        ['Boleta', `${boleta.nombre} × ${cantidad}`],
                        ['Fecha', evento.fechaTexto],
                        ['Lugar', evento.lugar],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <span className="font-body text-[11px] uppercase tracking-[0.14em] text-muted">
                            {k}
                          </span>
                          <span className="text-right font-body text-[13px] text-bone/85">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button className="btn-ghost !py-3 !text-[11px]">
                      <Download size={15} strokeWidth={1.5} />
                      Descargar boleta
                    </button>
                    <button className="btn-ghost !py-3 !text-[11px]">
                      <Mail size={15} strokeWidth={1.5} />
                      Reenviar al correo
                    </button>
                  </div>
                </motion.div>
              )}
              </motion.div>
             </AnimatePresence>
            </div>

            {/* Pie */}
            <div className="border-t border-white/[0.08] px-7 py-5">
              {paso === 0 && (
                <motion.button
                  whileTap={{ scale: 0.985 }}
                  onClick={() => { if (validar()) { setSentido(1); setPaso(1); } }}
                  className="btn-gold w-full"
                >
                  Continuar al pago · {formatoCOP(total)}
                </motion.button>
              )}
              {paso === 1 && (
                <motion.button whileTap={{ scale: 0.985 }} onClick={pagar} disabled={procesando} className="btn-gold w-full">
                  {procesando ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Procesando pago
                    </>
                  ) : (
                    <>Pagar {formatoCOP(total)}</>
                  )}
                </motion.button>
              )}
              {paso === 2 && (
                <button onClick={onClose} className="btn-ghost w-full">
                  Cerrar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
