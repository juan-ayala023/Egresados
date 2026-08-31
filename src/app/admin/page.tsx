'use client';

/* ============================================================================
   PANEL DEL COMITÉ

   Lo mínimo que pedía BACKEND.md §8: ver el aforo, buscar una orden, reenviar
   boletas, anular, y exportar el reporte. Más las alertas, que son lo primero
   que hay que mirar cada día.

   No es bonito a propósito: es una herramienta interna para cinco personas.
   Lo que sí tiene que ser es honesto — si algo se rompió, se ve.
   ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import {
  leerToken, guardarToken, olvidarToken,
  obtenerAlertas, buscarOrdenes, obtenerFicha, reenviarBoletas, anularOrden, descargarCsv,
  type Alertas, type OrdenBuscada, type FichaOrden,
} from '@/lib/admin';
import { ErrorApi } from '@/lib/api';

const pesos = (centavos: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(centavos / 100);

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function Panel() {
  const [token, setToken] = useState('');
  const [entrado, setEntrado] = useState(false);
  const [error, setError] = useState('');

  const [alertas, setAlertas] = useState<Alertas | null>(null);
  const [cargando, setCargando] = useState(false);

  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<OrdenBuscada[] | null>(null);
  const [ficha, setFicha] = useState<FichaOrden | null>(null);
  const [aviso, setAviso] = useState('');

  const refrescar = useCallback(async (t: string) => {
    setCargando(true);
    setError('');
    try {
      setAlertas(await obtenerAlertas(t));
      setEntrado(true);
      guardarToken(t);
    } catch (e) {
      setEntrado(false);
      setError(e instanceof ErrorApi ? e.message : 'No pudimos entrar.');
    } finally {
      setCargando(false);
    }
  }, []);

  /* Si el token quedó en la sesión, se entra solo. */
  useEffect(() => {
    const guardado = leerToken();
    if (guardado) {
      setToken(guardado);
      refrescar(guardado);
    }
  }, [refrescar]);

  /* Se refresca solo cada minuto: es un panel que se deja abierto. */
  useEffect(() => {
    if (!entrado) return;
    const id = setInterval(() => { obtenerAlertas(token).then(setAlertas).catch(() => {}); }, 60_000);
    return () => clearInterval(id);
  }, [entrado, token]);

  const salir = () => {
    olvidarToken();
    setToken('');
    setEntrado(false);
    setAlertas(null);
    setResultados(null);
    setFicha(null);
  };

  const buscar = async () => {
    setAviso('');
    setFicha(null);
    if (texto.trim().length < 3) {
      setAviso('Escribe al menos 3 caracteres.');
      return;
    }
    try {
      const r = await buscarOrdenes(token, texto.trim());
      setResultados(r.ordenes);
      if (!r.ordenes.length) setAviso('Sin resultados.');
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'Falló la búsqueda.');
    }
  };

  const abrir = async (referencia: string) => {
    setAviso('');
    try {
      setFicha(await obtenerFicha(token, referencia));
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'No pudimos abrir la orden.');
    }
  };

  const reenviar = async (referencia: string) => {
    setAviso('Enviando…');
    try {
      const r = await reenviarBoletas(token, referencia);
      setAviso(r.enviado ? `Reenviado (${r.via ?? 'ok'})` : `No salió: ${r.detalle ?? 'sin detalle'}`);
      await refrescar(token);
      await abrir(referencia);
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'Falló el reenvío.');
    }
  };

  const anular = async (referencia: string) => {
    /* Devuelve los cupos y mata todos los QR de esa orden. No devuelve la
       plata: eso se hace desde el panel de Wompi. */
    const motivo = window.prompt(
      `Anular ${referencia}.\n\nEsto libera los cupos y anula sus boletas.\n` +
      'NO devuelve el dinero: eso se hace en Wompi.\n\nMotivo:'
    );
    if (motivo === null) return;
    try {
      const r = await anularOrden(token, referencia, motivo);
      setAviso(`Anulada. Se liberaron ${r.cuposLiberados} cupo(s).`);
      await refrescar(token);
      await abrir(referencia);
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'No se pudo anular.');
    }
  };

  /* --- entrada ----------------------------------------------------------- */
  if (!entrado) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-2xl text-bone">Panel del comité</h1>
        <p className="mt-2 font-body text-sm text-muted">
          Homecoming 80 Años. Pega el token de administración.
        </p>

        <form
          className="mt-6"
          onSubmit={(e) => { e.preventDefault(); refrescar(token); }}
        >
          <label className="label">Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="field"
            autoComplete="off"
          />
          {error && <p className="mt-2 font-body text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={cargando || !token} className="btn-gold mt-5 w-full">
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 font-body text-xs leading-relaxed text-muted">
          El token se guarda solo en esta pestaña y se borra al cerrarla. Da acceso
          a todos los datos personales y permite anular órdenes: no lo compartas
          por chat.
        </p>
      </main>
    );
  }

  const a = alertas;

  /* --- panel -------------------------------------------------------------- */
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-bone">Panel del comité</h1>
          <p className="font-body text-xs text-muted">
            Actualizado {fecha(a?.generadoEn)} · se refresca solo cada minuto
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => refrescar(token)} className="btn-ghost !px-5 !py-2 !text-xs">
            Refrescar
          </button>
          <button onClick={salir} className="btn-ghost !px-5 !py-2 !text-xs">Salir</button>
        </div>
      </header>

      {/* --- aforo --- */}
      {a && (
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Aforo', a.aforo.aforo],
            ['Vendidas', a.aforo.vendidas],
            ['Reservadas', a.aforo.reservadas],
            ['Disponibles', a.aforo.disponibles],
            ['Sobreventa', a.aforo.sobreventa],
          ].map(([etiqueta, valor]) => (
            <div
              key={String(etiqueta)}
              className={`rounded-lg border p-4 ${
                etiqueta === 'Sobreventa' && Number(valor) > 0
                  ? 'border-red-500/50 bg-red-500/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                {etiqueta}
              </div>
              <div className="mt-1 font-display text-2xl text-bone tabular-nums">{valor}</div>
            </div>
          ))}
        </section>
      )}

      {/* --- alertas --- */}
      <section className="mt-10">
        <h2 className="font-display text-lg text-bone">
          Alertas{' '}
          {a && a.criticas > 0 && (
            <span className="ml-2 rounded-full bg-red-500/20 px-3 py-1 font-body text-xs text-red-300">
              {a.criticas} crítica{a.criticas === 1 ? '' : 's'}
            </span>
          )}
        </h2>

        {a && a.alertas.length === 0 && (
          <p className="mt-3 font-body text-sm text-muted">Nada que reportar.</p>
        )}

        <div className="mt-4 space-y-3">
          {a?.alertas.map((al, i) => (
            <article
              key={`${al.tipo}-${al.referencia ?? i}`}
              className={`rounded-lg border p-4 ${
                al.nivel === 'critico'
                  ? 'border-red-500/40 bg-red-500/[0.07]'
                  : 'border-gold/30 bg-gold/[0.05]'
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                  {al.nivel === 'critico' ? 'Crítico' : 'Aviso'}
                </span>
                <span className="font-body text-sm font-semibold text-bone">{al.tipo}</span>
                {al.referencia && (
                  <button
                    onClick={() => abrir(al.referencia!)}
                    className="font-body text-sm text-gold underline underline-offset-4"
                  >
                    {al.referencia}
                  </button>
                )}
              </div>

              <p className="mt-2 font-body text-sm leading-relaxed text-bone/80">{al.detalle}</p>

              {al.comprador?.correo && (
                <p className="mt-1 font-body text-xs text-muted">
                  {al.comprador.nombre} · {al.comprador.correo}
                  {al.comprador.celular ? ` · ${al.comprador.celular}` : ''}
                </p>
              )}
              {al.ultimoError && (
                <p className="mt-1 font-body text-xs text-muted">Último error: {al.ultimoError}</p>
              )}
              {al.accion && (
                <p className="mt-2 font-body text-xs text-muted">→ {al.accion}</p>
              )}

              {al.referencia && al.tipo === 'CORREO_NO_ENVIADO' && (
                <button
                  onClick={() => reenviar(al.referencia!)}
                  className="btn-gold mt-3 !px-5 !py-2 !text-xs"
                >
                  Reenviar ahora
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* --- búsqueda --- */}
      <section className="mt-12">
        <h2 className="font-display text-lg text-bone">Buscar una orden</h2>
        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={(e) => { e.preventDefault(); buscar(); }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cédula, correo, referencia o nombre"
            className="field flex-1 min-w-[240px]"
          />
          <button type="submit" className="btn-gold !px-6 !py-3 !text-xs">Buscar</button>
          <button
            type="button"
            onClick={() => descargarCsv(token).catch(() => setAviso('No se pudo descargar.'))}
            className="btn-ghost !px-6 !py-3 !text-xs"
          >
            Descargar CSV
          </button>
        </form>

        {aviso && <p className="mt-3 font-body text-sm text-gold">{aviso}</p>}

        {resultados && resultados.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse font-body text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.16em] text-muted">
                  <th className="py-2 pr-4">Referencia</th>
                  <th className="py-2 pr-4">Comprador</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4">Correo</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((o) => (
                  <tr key={o.referencia} className="border-b border-white/[0.06] text-bone/80">
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => abrir(o.referencia)}
                        className="text-gold underline underline-offset-4"
                      >
                        {o.referencia}
                      </button>
                    </td>
                    <td className="py-2 pr-4">
                      {o.nombre}
                      <div className="text-xs text-muted">{o.correo}</div>
                    </td>
                    <td className="py-2 pr-4">{o.estado}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pesos(o.total_centavos)}</td>
                    <td className="py-2 pr-4 text-xs">
                      {o.correo_enviado_a ? 'enviado' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- ficha --- */}
      {ficha && (
        <section className="mt-12 rounded-lg border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-lg text-bone">{ficha.orden.referencia}</h2>
            <span className="font-body text-sm text-muted">
              {ficha.orden.estado} · {pesos(ficha.orden.total_centavos)}
            </span>
          </div>

          <dl className="mt-4 grid gap-x-8 gap-y-2 font-body text-sm sm:grid-cols-2">
            {[
              ['Comprador', String(ficha.comprador.nombre ?? '')],
              ['Documento', `${ficha.comprador.tipo_documento ?? 'CC'} ${ficha.comprador.cedula ?? ''}`],
              ['Correo', String(ficha.comprador.correo ?? '')],
              ['Celular', String(ficha.comprador.celular ?? '')],
              ['Dirección', `${ficha.comprador.direccion ?? '—'}, ${ficha.comprador.ciudad ?? ''}`],
              ['Promoción', String(ficha.comprador.promocion ?? '')],
              ['Egresado verificado', ficha.comprador.egresado_verificado ? 'sí' : 'no'],
              ['Método', `${ficha.orden.metodo_pago ?? '—'} ${ficha.orden.franquicia ?? ''}`],
              ['Correo enviado', fecha(ficha.orden.correo_enviado_en)],
              ['Intentos de correo', String(ficha.orden.correo_intentos ?? 0)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-white/[0.06] py-1">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right text-bone/80">{v}</dd>
              </div>
            ))}
          </dl>

          {ficha.orden.correo_ultimo_error && (
            <p className="mt-3 font-body text-xs text-red-400">
              Último error de correo: {String(ficha.orden.correo_ultimo_error)}
            </p>
          )}

          <h3 className="mt-6 font-body text-[11px] uppercase tracking-[0.16em] text-muted">
            Asistentes y boletas
          </h3>
          <ul className="mt-2 space-y-1 font-body text-sm text-bone/80">
            {ficha.asistentes.map((as, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-3 border-b border-white/[0.06] py-1">
                <span>
                  {String(as.nombre)}{' '}
                  <span className="text-muted">
                    ({String(as.tipo_documento ?? 'CC')} {String(as.cedula ?? '—')})
                  </span>
                </span>
                <span className="text-muted">
                  {ficha.boletas[i] ? ficha.boletas[i].estado : 'sin boleta'}
                </span>
              </li>
            ))}
          </ul>

          {ficha.boletas.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {ficha.boletas.map((b) => (
                <a
                  key={b.id}
                  href={b.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost !px-5 !py-2 !text-xs"
                >
                  PDF de {b.asistente.split(' ')[0]}
                </a>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => reenviar(ficha.orden.referencia)}
              className="btn-gold !px-5 !py-2 !text-xs"
            >
              Reenviar boletas
            </button>
            {['pendiente', 'pagada'].includes(ficha.orden.estado) && (
              <button
                onClick={() => anular(ficha.orden.referencia)}
                className="btn-ghost !px-5 !py-2 !text-xs !border-red-500/40 hover:!border-red-500 hover:!text-red-400"
              >
                Anular orden
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
