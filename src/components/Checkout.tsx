'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { X, ArrowLeft, Loader2, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { ease } from '@/lib/motion';
import {
  anosGraduacion,
  formatoCOP,
  totalPorBoleta,
  metodosPago,
  type Boleta,
} from '@/data';
import { crearOrden, urlCheckoutWompi, ErrorApi, type AsistenteApi } from '@/lib/api';

type Asistente = AsistenteApi;

const vacio = (): Asistente => ({
  nombre: '',
  cedula: '',
  correo: '',
  celular: '',
  promocion: '',
});

const PASOS = ['Asistentes', 'Facturación y pago'];

/* Clave de referencia de la orden en sessionStorage.
   Wompi devuelve al usuario con su propio transaction_id en la URL, no con
   nuestra referencia, así que la guardamos antes de salir del sitio. Es lo
   único que le permite a /pago/resultado saber qué orden consultar. */
export const CLAVE_REFERENCIA = 'hc80:referencia';

type Props = {
  boleta: Boleta | null;
  cantidad: number;
  onClose: () => void;
};

export default function Checkout({ boleta, cantidad, onClose }: Props) {
  const [paso, setPaso] = useState(0);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  /* Un mensaje por campo, no un booleano: cuando el error viene del backend
     queremos mostrar su texto exacto y no uno genérico inventado aquí. */
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [sentido, setSentido] = useState(1);

  useEffect(() => {
    if (boleta) {
      setPaso(0);
      setAsistentes(Array.from({ length: cantidad }, vacio));
      setDireccion('');
      setCiudad('');
      setAceptaDatos(false);
      setAceptaTerminos(false);
      setErrores({});
      setErrorGeneral('');
      setProcesando(false);
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

  const subtotal = useMemo(() => (boleta ? boleta.precio * cantidad : 0), [boleta, cantidad]);
  const tarifas = useMemo(() => (boleta ? boleta.tarifaServicio * cantidad : 0), [boleta, cantidad]);
  const total = useMemo(() => subtotal + tarifas, [subtotal, tarifas]);

  const limpiar = (clave: string) =>
    setErrores((prev) => {
      if (!prev[clave]) return prev;
      const { [clave]: _, ...resto } = prev;
      return resto;
    });

  const actualizar = (i: number, campo: keyof Asistente, valor: string) => {
    setAsistentes((prev) => prev.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));
    limpiar(`${i}-${campo}`);
  };

  /* Validación local. El backend vuelve a validar todo —nunca se confía en el
     cliente— pero atajar aquí evita un viaje de red para errores obvios. */
  const validarAsistentes = () => {
    const nuevos: Record<string, string> = {};
    const cedulasVistas = new Map<string, number>();

    asistentes.forEach((a, i) => {
      if (a.nombre.trim().length < 5) nuevos[`${i}-nombre`] = 'Escribe el nombre completo.';
      if (a.cedula.trim().length < 6) nuevos[`${i}-cedula`] = 'Mínimo 6 dígitos.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.correo)) nuevos[`${i}-correo`] = 'Correo no válido.';
      if (a.celular.replace(/\D/g, '').length < 10) nuevos[`${i}-celular`] = 'Mínimo 10 dígitos.';
      if (!a.promocion) nuevos[`${i}-promocion`] = 'Selecciona la promoción.';

      /* El backend rechaza cédulas repetidas dentro de una misma compra:
         cada boleta es de una persona distinta. Se atrapa aquí para que el
         usuario lo vea al instante y sepa cuál de las dos filas corregir. */
      const cedula = a.cedula.trim();
      if (cedula.length >= 6) {
        const previa = cedulasVistas.get(cedula);
        if (previa !== undefined) {
          nuevos[`${i}-cedula`] = `Esta cédula ya está en la boleta ${previa + 1}.`;
        } else {
          cedulasVistas.set(cedula, i);
        }
      }
    });

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const validarPago = () => {
    const nuevos: Record<string, string> = {};
    if (direccion.trim().length < 5) nuevos['direccion'] = 'Escribe la dirección de facturación.';
    if (ciudad.trim().length < 3) nuevos['ciudad'] = 'Escribe la ciudad.';
    if (!aceptaDatos) nuevos['aceptaDatos'] = 'Debes aceptar el tratamiento de datos.';
    if (!aceptaTerminos) nuevos['aceptaTerminos'] = 'Debes aceptar los términos.';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  /* Traduce las claves del backend a las del formulario.
     Llegan en notación de punto: "comprador.direccion", "asistentes.0.cedula".
     El comprador ES el asistente 0, así que sus errores de datos personales
     se pintan sobre esa primera fila. */
  const mapearErrores = (campos: Record<string, string>) => {
    const nuevos: Record<string, string> = {};
    let hayDePasoAsistentes = false;

    for (const [clave, mensaje] of Object.entries(campos)) {
      const asistente = clave.match(/^asistentes\.(\d+)\.(\w+)$/);
      if (asistente) {
        nuevos[`${asistente[1]}-${asistente[2]}`] = mensaje;
        hayDePasoAsistentes = true;
        continue;
      }
      if (clave === 'comprador.direccion') { nuevos['direccion'] = mensaje; continue; }
      if (clave === 'comprador.ciudad') { nuevos['ciudad'] = mensaje; continue; }
      const comprador = clave.match(/^comprador\.(\w+)$/);
      if (comprador) {
        nuevos[`0-${comprador[1]}`] = mensaje;
        hayDePasoAsistentes = true;
        continue;
      }
      if (clave === 'aceptaTratamientoDatos') { nuevos['aceptaDatos'] = mensaje; continue; }
      if (clave === 'aceptaTerminos') { nuevos['aceptaTerminos'] = mensaje; continue; }
      /* Cualquier otra cosa (p. ej. "cantidad") no tiene input propio en el
         formulario, así que sube al aviso general en vez de perderse. */
      setErrorGeneral(mensaje);
    }

    setErrores(nuevos);
    return hayDePasoAsistentes;
  };

  const pagar = async () => {
    if (!boleta || !validarPago()) return;
    setProcesando(true);
    setErrorGeneral('');

    const titular = asistentes[0];

    try {
      const orden = await crearOrden({
        tipoBoletaId: boleta.id,
        cantidad,
        comprador: {
          nombre: titular.nombre,
          cedula: titular.cedula,
          correo: titular.correo,
          celular: titular.celular,
          direccion: direccion.trim(),
          ciudad: ciudad.trim(),
          promocion: titular.promocion,
        },
        asistentes,
        aceptaTratamientoDatos: aceptaDatos,
        aceptaTerminos: aceptaTerminos,
      });

      /* Antes de salir del sitio. Si se guarda después del redirect nunca se
         ejecuta, y al volver de Wompi no sabríamos qué orden consultar. */
      try {
        sessionStorage.setItem(CLAVE_REFERENCIA, orden.referencia);
      } catch {
        /* Modo incógnito o almacenamiento bloqueado. La página de resultado
           tiene su propio respaldo por query param, así que no es fatal. */
      }

      window.location.href = urlCheckoutWompi(orden.wompi);
    } catch (e) {
      setProcesando(false);

      if (!(e instanceof ErrorApi)) {
        setErrorGeneral('Algo salió mal. Intenta de nuevo.');
        return;
      }

      if (e.codigo === 'VALIDACION') {
        const volver = mapearErrores(e.campos);
        if (volver) { setSentido(-1); setPaso(0); }
        else setErrorGeneral(e.message);
        return;
      }

      if (e.codigo === 'LIMITE_CEDULA') {
        const ya = typeof e.extra.yaCompradas === 'number' ? e.extra.yaCompradas : null;
        setSentido(-1);
        setPaso(0);
        setErrores({
          '0-cedula': ya
            ? `Esta cédula ya compró ${ya} ${ya === 1 ? 'boleta' : 'boletas'}.`
            : e.message,
        });
        setErrorGeneral(e.message);
        return;
      }

      setErrorGeneral(e.message);
    }
  };

  const clase = (clave: string) =>
    errores[clave] ? 'border-red-400/60 bg-red-400/[0.04]' : '';

  const Aviso = ({ clave }: { clave: string }) =>
    errores[clave] ? (
      <p className="mt-1.5 font-body text-[11.5px] leading-snug text-red-400/90">{errores[clave]}</p>
    ) : null;

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
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-7 sm:py-5">
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
                    Paso {paso + 1} de {PASOS.length}
                  </p>
                  <h3 className="mt-1 font-display font-bold text-xl text-bone">{PASOS[paso]}</h3>
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
            <div className="flex gap-1.5 px-5 pt-4 sm:px-7 sm:pt-5">
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

            <div className="relative max-h-[68vh] overflow-y-auto px-5 py-6 sm:max-h-[62vh] sm:px-7 sm:py-7">
             <AnimatePresence mode="wait" custom={sentido}>
              <motion.div
                key={paso}
                custom={sentido}
                initial={{ opacity: 0, x: sentido * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: sentido * -28 }}
                transition={{ duration: 0.38, ease: ease.out }}
              >
              {/* ---------- PASO 1 · ASISTENTES ---------- */}
              {paso === 0 && (
                <div className="space-y-8">
                  <p className="font-body text-[13px] leading-relaxed text-muted">
                    Registra los datos de cada persona que va a ingresar. El QR se emite
                    individualmente y se valida en la entrada. Cada boleta va a nombre de
                    una cédula distinta.
                  </p>

                  {asistentes.map((a, i) => (
                    <div key={i} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-lg text-gold">
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
                            className={`field ${clase(`${i}-nombre`)}`}
                          />
                          <Aviso clave={`${i}-nombre`} />
                        </div>
                        <div>
                          <label className="label">Cédula</label>
                          <input
                            value={a.cedula}
                            onChange={(e) => actualizar(i, 'cedula', e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            placeholder="1020304050"
                            className={`field ${clase(`${i}-cedula`)}`}
                          />
                          <Aviso clave={`${i}-cedula`} />
                        </div>
                        <div>
                          <label className="label">Celular</label>
                          <input
                            value={a.celular}
                            onChange={(e) => actualizar(i, 'celular', e.target.value)}
                            inputMode="tel"
                            placeholder="300 000 0000"
                            className={`field ${clase(`${i}-celular`)}`}
                          />
                          <Aviso clave={`${i}-celular`} />
                        </div>
                        <div>
                          <label className="label">Correo</label>
                          <input
                            value={a.correo}
                            onChange={(e) => actualizar(i, 'correo', e.target.value)}
                            inputMode="email"
                            placeholder="nombre@correo.com"
                            className={`field ${clase(`${i}-correo`)}`}
                          />
                          <Aviso clave={`${i}-correo`} />
                        </div>
                        <div>
                          <label className="label">Promoción</label>
                          <select
                            value={a.promocion}
                            onChange={(e) => actualizar(i, 'promocion', e.target.value)}
                            className={`field ${clase(`${i}-promocion`)}`}
                          >
                            <option value="">Año de grado</option>
                            <option value="no-egresado">No soy egresado</option>
                            {anosGraduacion.map((y) => (
                              <option key={y} value={String(y)}>
                                {y}
                              </option>
                            ))}
                          </select>
                          <Aviso clave={`${i}-promocion`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ---------- PASO 2 · FACTURACIÓN Y PAGO ---------- */}
              {paso === 1 && (
                <div className="space-y-8">
                  {/* Datos que exige la facturación electrónica y que no se
                      piden por asistente: son del responsable del pago. */}
                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                        Datos de facturación
                      </span>
                      <div className="h-px flex-1 bg-white/[0.08]" />
                    </div>
                    <p className="mb-4 font-body text-[12.5px] leading-relaxed text-muted">
                      La factura se emite a nombre de{' '}
                      <span className="text-bone/80">{asistentes[0]?.nombre || 'el titular'}</span>,
                      cédula <span className="text-bone/80">{asistentes[0]?.cedula || '—'}</span>.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="label">Dirección</label>
                        <input
                          value={direccion}
                          onChange={(e) => { setDireccion(e.target.value); limpiar('direccion'); }}
                          placeholder="Cra 43A # 1-50 Apto 902"
                          className={`field ${clase('direccion')}`}
                        />
                        <Aviso clave="direccion" />
                      </div>
                      <div>
                        <label className="label">Ciudad</label>
                        <input
                          value={ciudad}
                          onChange={(e) => { setCiudad(e.target.value); limpiar('ciudad'); }}
                          placeholder="Medellín"
                          className={`field ${clase('ciudad')}`}
                        />
                        <Aviso clave="ciudad" />
                      </div>
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="font-display font-bold text-xl text-bone">{boleta.nombre}</p>
                        <p className="mt-1 font-body text-[12px] text-muted">
                          {cantidad} {cantidad === 1 ? 'boleta' : 'boletas'} ·{' '}
                          {formatoCOP(totalPorBoleta(boleta))} c/u
                        </p>
                      </div>
                      <span className="font-body text-sm tabular-nums text-bone/70">
                        {formatoCOP(total)}
                      </span>
                    </div>

                    <div className="my-5 h-px bg-white/[0.08]" />

                    {boleta.tarifaServicio > 0 && (
                      <dl className="mb-5 space-y-1.5 font-body text-[13px]">
                        <div className="flex justify-between">
                          <dt className="text-muted">
                            Boletas ({cantidad} × {formatoCOP(boleta.precio)})
                          </dt>
                          <dd className="tabular-nums text-bone/75">{formatoCOP(subtotal)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">
                            Tarifa de servicio ({cantidad} × {formatoCOP(boleta.tarifaServicio)})
                          </dt>
                          <dd className="tabular-nums text-bone/75">{formatoCOP(tarifas)}</dd>
                        </div>
                      </dl>
                    )}

                    <div className="flex items-baseline justify-between">
                      <span className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                        Total a pagar
                      </span>
                      <span className="lining font-display font-bold text-3xl text-gold">{formatoCOP(total)}</span>
                    </div>
                  </div>

                  {/* Medios aceptados. No es un selector: el medio se elige
                      dentro de Wompi, y fingir que se escoge aquí obligaría a
                      preguntarlo dos veces. */}
                  <div>
                    <p className="label">Medios de pago aceptados</p>
                    <div className="flex flex-wrap gap-2">
                      {metodosPago.map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full border border-white/10 px-3.5 py-1.5 font-body text-[11.5px] text-bone/70"
                        >
                          {m.nombre}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Aceptaciones */}
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={aceptaDatos}
                        onChange={(e) => { setAceptaDatos(e.target.checked); limpiar('aceptaDatos'); }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--gold))]"
                      />
                      <span className="font-body text-[12.5px] leading-relaxed text-muted">
                        Autorizo el tratamiento de mis datos personales para la gestión del
                        ingreso y la facturación del evento.
                      </span>
                    </label>
                    <Aviso clave="aceptaDatos" />

                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={aceptaTerminos}
                        onChange={(e) => { setAceptaTerminos(e.target.checked); limpiar('aceptaTerminos'); }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--gold))]"
                      />
                      <span className="font-body text-[12.5px] leading-relaxed text-muted">
                        Acepto los términos y condiciones de la venta.
                      </span>
                    </label>
                    <Aviso clave="aceptaTerminos" />
                  </div>

                  <div className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <ShieldCheck size={16} className="shrink-0 text-gold" strokeWidth={1.5} />
                    <p className="font-body text-[12px] leading-relaxed text-muted">
                      Te llevamos a <span className="text-bone/80">Wompi</span> para completar el
                      pago. Los datos de tu tarjeta nunca pasan por este sitio.
                    </p>
                  </div>
                </div>
              )}
              </motion.div>
             </AnimatePresence>

              {errorGeneral && (
                <div className="mt-6 flex items-start gap-3 rounded-sm border border-red-400/30 bg-red-400/[0.06] px-4 py-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400/90" strokeWidth={1.5} />
                  <p className="font-body text-[12.5px] leading-relaxed text-red-400/90">
                    {errorGeneral}
                  </p>
                </div>
              )}
            </div>

            {/* Pie */}
            <div className="border-t border-white/[0.08] px-5 py-4 sm:px-7 sm:py-5">
              {paso === 0 && (
                <motion.button
                  whileTap={{ scale: 0.985 }}
                  onClick={() => { if (validarAsistentes()) { setSentido(1); setPaso(1); } }}
                  className="btn-gold w-full"
                >
                  Continuar · {formatoCOP(total)}
                </motion.button>
              )}
              {paso === 1 && (
                <motion.button whileTap={{ scale: 0.985 }} onClick={pagar} disabled={procesando} className="btn-gold w-full">
                  {procesando ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Conectando con Wompi
                    </>
                  ) : (
                    <>Pagar {formatoCOP(total)}</>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
