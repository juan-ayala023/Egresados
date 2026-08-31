'use client';

/* ============================================================================
   CONTROL DE INGRESO

   Para el portátil de la entrada. El escáner escribe el token y presiona Enter;
   esta pantalla solo tiene que decir VERDE o ROJO, grande, desde lejos y de
   noche. Nadie va a leer un párrafo con una fila de 200 personas esperando.

   Funciona sin wifi: se descarga la lista antes del evento y, si se cae la red,
   valida contra ella y deja los escaneos en cola.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  leerTokenPuerta, guardarTokenPuerta,
  descargarLista, guardarLista, leerLista,
  validarEnLinea, validarLocal,
  leerCola, guardarCola, sincronizar, estadoPuerta,
  CLAVE_PUERTA,
  type RespuestaPuerta,
} from '@/lib/puerta';

export default function Puerta() {
  const [token, setToken] = useState('');
  const [entrado, setEntrado] = useState(false);
  const [error, setError] = useState('');

  const [puerta, setPuerta] = useState('Ingreso 1');
  const [operador, setOperador] = useState('');

  const [ultimo, setUltimo] = useState<RespuestaPuerta | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [lista, setLista] = useState(0);
  const [cola, setCola] = useState(0);
  const [conteo, setConteo] = useState<{ emitidas: number; ingresadas: number } | null>(null);
  const [aviso, setAviso] = useState('');

  const entrada = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');

  /* El foco SIEMPRE en la caja: si se pierde, el escáner escribe en la nada y
     la persona pasa sin registrarse. */
  const enfocar = useCallback(() => entrada.current?.focus(), []);

  useEffect(() => {
    const t = leerTokenPuerta();
    if (t) { setToken(t); setEntrado(true); }
    try { setPuerta(localStorage.getItem(CLAVE_PUERTA) || 'Ingreso 1'); } catch { /* bloqueado */ }
  }, []);

  useEffect(() => {
    if (!entrado) return;
    setLista(leerLista().length);
    setCola(leerCola().length);
    enfocar();
    const id = setInterval(() => {
      estadoPuerta(token)
        .then((c) => { setConteo(c); setEnLinea(true); })
        .catch(() => setEnLinea(false));
    }, 15_000);
    estadoPuerta(token).then((c) => { setConteo(c); setEnLinea(true); }).catch(() => setEnLinea(false));
    return () => clearInterval(id);
  }, [entrado, token, enfocar]);

  const entrar = async () => {
    setError('');
    try {
      await estadoPuerta(token);
      guardarTokenPuerta(token);
      setEntrado(true);
    } catch {
      setError('Token de puerta inválido o servidor inalcanzable.');
    }
  };

  const bajarLista = async () => {
    setAviso('Descargando…');
    try {
      const r = await descargarLista(token);
      guardarLista(r.boletas);
      setLista(r.boletas.length);
      setAviso(`Lista lista: ${r.total} boletas. Ya puedes trabajar sin wifi.`);
    } catch {
      setAviso('No se pudo descargar. Necesitas conexión para esto.');
    }
  };

  const subirCola = async () => {
    const pendientes = leerCola();
    if (!pendientes.length) { setAviso('No hay escaneos pendientes.'); return; }
    setAviso('Subiendo…');
    try {
      const r = await sincronizar(token, pendientes);
      guardarCola([]);
      setCola(0);
      setAviso(`Subidos ${r.procesados}: ${r.validas} válidas, ${r.yaUsadas} repetidas, ${r.invalidas} inválidas.`);
      setEnLinea(true);
    } catch {
      setAviso('No se pudieron subir. Siguen guardados, intenta cuando haya wifi.');
    }
  };

  const escanear = async (qr: string) => {
    const limpio = qr.trim();
    if (!limpio) return;
    setBuffer('');

    /* En línea manda el servidor, que marca la boleta como usada de forma
       atómica. Si falla la red, se cae al modo local sin que nadie espere. */
    try {
      const r = await validarEnLinea(token, limpio, puerta, operador);
      setUltimo({ ...r, origen: 'linea' });
      setEnLinea(true);
      estadoPuerta(token).then(setConteo).catch(() => {});
    } catch {
      setEnLinea(false);
      setUltimo(validarLocal(limpio, puerta, operador));
      setCola(leerCola().length);
    }
    enfocar();
  };

  /* --- entrada ------------------------------------------------------------ */
  if (!entrado) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-2xl text-bone">Control de ingreso</h1>
        <p className="mt-2 font-body text-sm text-muted">Homecoming 80 Años</p>
        <form className="mt-6" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
          <label className="label">Token de puerta</label>
          <input
            type="password" value={token} onChange={(e) => setToken(e.target.value)}
            className="field" placeholder="PUERTA_TOKEN" autoComplete="off"
          />
          {error && <p className="mt-2 font-body text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={!token} className="btn-gold mt-5 w-full">Entrar</button>
        </form>
      </main>
    );
  }

  const r = ultimo;
  const fondo =
    !r ? 'bg-ink'
      : r.resultado === 'VALIDA' ? 'bg-emerald-600'
        : r.resultado === 'YA_USADA' ? 'bg-amber-600'
          : 'bg-red-700';

  /* --- operación ---------------------------------------------------------- */
  return (
    <main className={`min-h-screen transition-colors duration-150 ${fondo}`} onClick={enfocar}>
      <div className="mx-auto max-w-3xl px-6 py-6">

        <header className="flex flex-wrap items-center justify-between gap-3 font-body text-xs">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${enLinea ? 'bg-emerald-300' : 'bg-red-300'}`} />
            <span className="text-white/80">{enLinea ? 'En línea' : 'SIN CONEXIÓN — validando con la lista'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-white/80">
            <span>Lista: {lista}</span>
            <span>En cola: {cola}</span>
            {conteo && <span>Entraron: {conteo.ingresadas}/{conteo.emitidas}</span>}
          </div>
        </header>

        {/* --- resultado, lo único que importa a un metro de distancia --- */}
        <section className="flex min-h-[46vh] flex-col items-center justify-center text-center">
          {!r && (
            <p className="font-body text-lg text-white/70">Escanea un código</p>
          )}
          {r && (
            <>
              <div className="font-display text-6xl leading-none text-white sm:text-8xl">
                {r.resultado === 'VALIDA' ? 'PASA'
                  : r.resultado === 'YA_USADA' ? 'YA ENTRÓ' : 'NO VÁLIDA'}
              </div>
              {r.asistente && (
                <div className="mt-5 font-display text-2xl text-white/95 sm:text-3xl">
                  {r.asistente}
                </div>
              )}
              {r.promocion && (
                <div className="mt-1 font-body text-base text-white/80">
                  {r.promocion === 'no-egresado' ? 'Invitado' : `Promoción ${r.promocion}`}
                </div>
              )}
              {r.usadaEn && (
                <div className="mt-3 font-body text-sm text-white/80">
                  Entró {new Date(r.usadaEn).toLocaleTimeString('es-CO')}
                  {r.puerta ? ` por ${r.puerta}` : ''}
                </div>
              )}
              {r.motivo && <div className="mt-3 font-body text-sm text-white/80">{r.motivo}</div>}
              {r.origen === 'local' && (
                <div className="mt-4 rounded-full bg-black/25 px-4 py-1 font-body text-xs text-white/90">
                  validado sin conexión · se sube después
                </div>
              )}
            </>
          )}
        </section>

        {/* --- la caja del escáner. Invisible pero siempre enfocada --- */}
        <form
          onSubmit={(e) => { e.preventDefault(); escanear(buffer); }}
          className="mt-2"
        >
          <input
            ref={entrada}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            onBlur={() => setTimeout(enfocar, 80)}
            placeholder="Escanea aquí (o pega el código y Enter)"
            className="w-full rounded-lg border border-white/30 bg-black/25 px-4 py-3 font-body text-sm text-white placeholder:text-white/50 focus:outline-none"
            autoComplete="off"
            autoFocus
          />
        </form>

        {/* --- herramientas --- */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label !text-white/70">Puerta</label>
            <input
              value={puerta}
              onChange={(e) => {
                setPuerta(e.target.value);
                try { localStorage.setItem(CLAVE_PUERTA, e.target.value); } catch { /* bloqueado */ }
              }}
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-body text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="label !text-white/70">Quién está escaneando</label>
            <input
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-body text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={bajarLista} type="button"
            className="rounded-full border border-white/30 px-5 py-2 font-body text-xs uppercase tracking-[0.12em] text-white">
            Descargar lista
          </button>
          <button onClick={subirCola} type="button"
            className="rounded-full border border-white/30 px-5 py-2 font-body text-xs uppercase tracking-[0.12em] text-white">
            Subir escaneos ({cola})
          </button>
        </div>

        {aviso && <p className="mt-3 font-body text-sm text-white/90">{aviso}</p>}

        <p className="mt-6 font-body text-xs leading-relaxed text-white/60">
          Descarga la lista <strong>antes</strong> del evento, con wifi. Si la red se
          cae, esta pantalla sigue funcionando contra esa lista y guarda los
          escaneos; cuando vuelva, súbelos con el botón.
        </p>
      </div>
    </main>
  );
}
