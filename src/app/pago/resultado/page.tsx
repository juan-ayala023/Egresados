'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, Download, Mail, ArrowLeft } from 'lucide-react';
import {
  consultarOrden, verificarPago, reenviarCorreo, ErrorApi, type EstadoOrden,
} from '@/lib/api';
import { CLAVE_REFERENCIA } from '@/components/Checkout';
import { evento, formatoCOP, imagenes } from '@/data';
import { ease } from '@/lib/motion';

/* Wompi tarda en confirmar: el webhook llega segundos después de que el
   usuario ya volvió. Consultamos cada 2.5s durante 2 minutos; pasado eso
   dejamos de insistir y ofrecemos reintentar a mano, porque un polling
   infinito calienta el teléfono y no resuelve nada. */
const INTERVALO = 2500;
const INTENTOS_MAX = 48;

type Fase = 'buscando' | 'consultando' | 'listo' | 'sin-referencia' | 'error' | 'agotado';

export default function ResultadoPago() {
  const [orden, setOrden] = useState<EstadoOrden | null>(null);
  const [fase, setFase] = useState<Fase>('buscando');
  const [mensaje, setMensaje] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState('');
  const intentos = useRef(0);

  const referencia = useRef<string>('');

  /* Primer intento, con el id que Wompi dejó en la URL: el backend le pregunta
     directamente a la pasarela. Suele resolver el pago de una, sin esperar al
     webhook. Si falla, no se dice nada al usuario y se sigue con el polling
     normal: es un atajo, no la única vía. */
  const verificar = useCallback(async (idTransaccion: string) => {
    try {
      const r = await verificarPago(referencia.current, idTransaccion);
      setOrden(r);
      if (r.estado !== 'pendiente') {
        setFase('listo');
        return true;
      }
    } catch {
      /* Puede fallar por red o porque la pasarela todavía no sabe nada. El
         polling de abajo se encarga. */
    }
    return false;
  }, []);

  const consultar = useCallback(async () => {
    try {
      const r = await consultarOrden(referencia.current);
      setOrden(r);
      if (r.estado !== 'pendiente') {
        setFase('listo');
        return true;
      }
      return false;
    } catch (e) {
      setMensaje(e instanceof ErrorApi ? e.message : 'No pudimos consultar tu orden.');
      setFase('error');
      return true;
    }
  }, []);

  useEffect(() => {
    /* La referencia se guardó antes de salir hacia Wompi. El query param es
       el respaldo para cuando sessionStorage no está disponible (incógnito)
       o el usuario volvió desde otro dispositivo. */
    const params = new URLSearchParams(window.location.search);
    /* Wompi devuelve al usuario con ?id=<transacción>. Es el dato que hace
       posible resolver el pago sin esperar el webhook. */
    const idTransaccion = params.get('id') ?? '';
    const query = params.get('referencia');
    let guardada = '';
    try {
      guardada = sessionStorage.getItem(CLAVE_REFERENCIA) ?? '';
    } catch {
      /* almacenamiento bloqueado */
    }
    const ref = query || guardada;

    if (!ref) {
      setFase('sin-referencia');
      return;
    }

    referencia.current = ref;
    setFase('consultando');

    let vivo = true;
    let id: ReturnType<typeof setTimeout>;

    const ciclo = async () => {
      if (!vivo) return;

      /* Solo en la primera vuelta, y solo si Wompi nos dio el id. */
      if (intentos.current === 0 && idTransaccion) {
        const resuelto = await verificar(idTransaccion);
        if (resuelto || !vivo) return;
      }

      const terminado = await consultar();
      if (terminado || !vivo) return;
      intentos.current += 1;
      if (intentos.current >= INTENTOS_MAX) {
        setFase('agotado');
        return;
      }
      id = setTimeout(ciclo, INTERVALO);
    };

    ciclo();
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [consultar, verificar]);

  const reintentar = () => {
    intentos.current = 0;
    setFase('consultando');
    consultar().then((terminado) => {
      if (!terminado) setFase('agotado');
    });
  };

  const reenviar = async () => {
    setReenviando(true);
    setReenviado('');
    try {
      const r = await reenviarCorreo(referencia.current);
      setReenviado(`Enviado a ${r.enviadoA}`);
    } catch (e) {
      setReenviado(e instanceof ErrorApi ? e.message : 'No pudimos reenviarlo.');
    } finally {
      setReenviando(false);
    }
  };

  const pagada = fase === 'listo' && orden?.estado === 'pagada';

  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-20">
      <a href="/" className="mb-12 inline-block" aria-label="Volver al inicio">
        <Image
          src={imagenes.logoHorizontal}
          alt={`${evento.titulo} · ${evento.colegio}`}
          width={720}
          height={120}
          className="h-10 w-auto opacity-80 transition-opacity hover:opacity-100"
        />
      </a>

      <div className="w-full max-w-md rounded-lg border border-white/10 bg-surface p-8 text-center shadow-2xl sm:p-10">
        {/* ---------- Esperando confirmación ---------- */}
        {(fase === 'buscando' || fase === 'consultando') && (
          <>
            <Loader2 size={30} className="mx-auto animate-spin text-gold" strokeWidth={1.5} />
            <h1 className="mt-7 font-display font-bold text-2xl text-bone">
              Confirmando tu pago
            </h1>
            <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
              Estamos esperando la confirmación del banco. No cierres esta ventana;
              puede tardar unos segundos.
            </p>
          </>
        )}

        {/* ---------- Pagada ---------- */}
        {pagada && orden && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.out }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 2.1, opacity: 0 }}
                transition={{ delay: 0.25, duration: 1.1, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border border-gold/50"
              />
              <Check size={26} className="text-gold" strokeWidth={2} />
            </motion.div>

            <h1 className="mt-7 font-display font-bold text-3xl text-bone">
              {orden.cantidad === 1 ? 'Tu boleta está lista' : 'Tus boletas están listas'}
            </h1>
            <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
              {orden.correoEnviadoA ? (
                <>
                  Te {orden.cantidad === 1 ? 'la' : 'las'} enviamos a{' '}
                  <span className="text-bone/80">{orden.correoEnviadoA}</span>. Presenta el
                  QR en la entrada.
                </>
              ) : (
                <>Presenta el QR en la entrada. Cada asistente tiene el suyo.</>
              )}
            </p>

            <div className="mt-8 space-y-4">
              {orden.boletas.map((b) => (
                <div key={b.id} className="rounded-sm border border-white/[0.1] bg-white/[0.02] p-6">
                  {/* <img> y no next/image: el host del backend cambia con el
                      túnel y tendría que ir en remotePatterns cada vez. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.qrUrl}
                    alt={`Código QR de ${b.asistente}`}
                    width={168}
                    height={168}
                    className="mx-auto rounded-sm bg-white p-1"
                  />
                  <p className="mt-4 font-body text-[13px] text-bone/85">{b.asistente}</p>
                  <a
                    href={b.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
                  >
                    <Download size={13} strokeWidth={1.5} />
                    Descargar
                  </a>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-2.5 text-left">
              {[
                ['Orden', orden.referencia],
                ['Boletas', String(orden.cantidad)],
                ['Total', formatoCOP(Math.round(orden.totalCentavos / 100))],
                ['Fecha', evento.fechaTexto],
                ['Lugar', evento.lugar],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-body text-[11px] uppercase tracking-[0.14em] text-muted">{k}</span>
                  <span className="text-right font-body text-[13px] text-bone/85">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button onClick={reenviar} disabled={reenviando} className="btn-ghost !py-3 !text-[11px]">
                {reenviando ? (
                  <><Loader2 size={14} className="animate-spin" /> Enviando</>
                ) : (
                  <><Mail size={15} strokeWidth={1.5} /> Reenviar al correo</>
                )}
              </button>
              {reenviado && (
                <p className="font-body text-[12px] text-muted">{reenviado}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* ---------- Pago no aprobado ---------- */}
        {fase === 'listo' && orden && orden.estado !== 'pagada' && (
          <>
            <AlertCircle size={30} className="mx-auto text-red-400/90" strokeWidth={1.5} />
            <h1 className="mt-7 font-display font-bold text-2xl text-bone">
              {orden.estado === 'expirada' ? 'La orden expiró' : 'El pago no se completó'}
            </h1>
            <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
              {orden.estado === 'expirada'
                ? 'Pasaron más de 20 minutos sin confirmar el pago y liberamos los cupos. Puedes volver a intentarlo.'
                : 'No se hizo ningún cobro. Puedes intentar de nuevo con otro medio de pago.'}
            </p>
            <p className="mt-5 font-body text-[11px] uppercase tracking-[0.14em] text-muted">
              Orden {orden.referencia}
            </p>
          </>
        )}

        {/* ---------- Sigue pendiente ---------- */}
        {fase === 'agotado' && (
          <>
            <AlertCircle size={30} className="mx-auto text-gold" strokeWidth={1.5} />
            <h1 className="mt-7 font-display font-bold text-2xl text-bone">
              Seguimos esperando al banco
            </h1>
            <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
              Tu pago puede estar en proceso. Si se aprueba te llega el correo con las
              boletas. Guarda esta referencia por si necesitas escribirnos.
            </p>
            <p className="mt-5 font-body text-[11px] uppercase tracking-[0.14em] text-gold">
              {referencia.current}
            </p>
            <button onClick={reintentar} className="btn-ghost mt-7 !py-3 !text-[11px]">
              Consultar de nuevo
            </button>
          </>
        )}

        {/* ---------- Sin referencia ---------- */}
        {fase === 'sin-referencia' && (
          <>
            <AlertCircle size={30} className="mx-auto text-muted" strokeWidth={1.5} />
            <h1 className="mt-7 font-display font-bold text-2xl text-bone">
              No encontramos tu orden
            </h1>
            <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
              Llegaste a esta página sin una compra en curso. Si ya pagaste, revisa tu
              correo: ahí están las boletas con el QR.
            </p>
          </>
        )}

        {/* ---------- Error de consulta ---------- */}
        {fase === 'error' && (
          <>
            <AlertCircle size={30} className="mx-auto text-red-400/90" strokeWidth={1.5} />
            <h1 className="mt-7 font-display font-bold text-2xl text-bone">
              No pudimos consultar tu orden
            </h1>
            <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">{mensaje}</p>
            <button onClick={reintentar} className="btn-ghost mt-7 !py-3 !text-[11px]">
              Intentar de nuevo
            </button>
          </>
        )}

        <a
          href="/"
          className="mt-9 inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          Volver al inicio
        </a>
      </div>
    </main>
  );
}
