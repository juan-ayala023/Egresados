'use client';

/* ============================================================================
   PANEL DEL COMITÉ

   Lo mínimo que pedía BACKEND.md §8: ver el aforo, buscar una orden, reenviar
   boletas, anular, y exportar el reporte. Más las alertas, que son lo primero
   que hay que mirar cada día.

   No es bonito a propósito: es una herramienta interna para cinco personas.
   Lo que sí tiene que ser es honesto — si algo se rompió, se ve.
   ========================================================================== */

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  leerToken, guardarToken, olvidarToken,
  obtenerAlertas, atenderAlerta, obtenerVentas, buscarOrdenes, obtenerFicha, reenviarBoletas, anularOrden, descargarCsv, descargarCsvLector,
  type Alertas, type Venta, type OrdenBuscada, type FichaOrden,
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
  const [ventas, setVentas] = useState<Venta[]>([]);
  /* Qué venta está desplegada, por referencia. Una sola a la vez: con 500
     ventas, abrirlas todas convierte la tabla en un muro. */
  const [desplegada, setDesplegada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<OrdenBuscada[] | null>(null);
  const [ficha, setFicha] = useState<FichaOrden | null>(null);
  const [aviso, setAviso] = useState('');

  const refrescar = useCallback(async (t: string) => {
    setCargando(true);
    setError('');
    try {
      /* En paralelo: son dos llamadas independientes y en serie el panel
         tarda el doble en pintar. */
      const [al, ve] = await Promise.all([obtenerAlertas(t), obtenerVentas(t, 25)]);
      setAlertas(al);
      setVentas(ve.ventas);
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
    const id = setInterval(() => {
      obtenerAlertas(token).then(setAlertas).catch(() => {});
      obtenerVentas(token, 25).then((v) => setVentas(v.ventas)).catch(() => {});
    }, 60_000);
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

  /* Esconde una alerta del panel. Se refrescan las alertas de una para que
     desaparezca al instante, en vez de esperar al refresco del minuto. */
  const atender = async (tipo: string, referencia?: string | null) => {
    try {
      await atenderAlerta(token, tipo, referencia);
      setAlertas(await obtenerAlertas(token));
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'No se pudo marcar la alerta.');
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
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Aforo', a.aforo.aforo],
            ['Vendidas', a.aforo.vendidas],
            /* El número que el comité pregunta primero y que antes no estaba
               en ninguna parte: había que abrir el CSV y sumar en Excel.
               Viene de la BASE, sobre todas las órdenes pagadas -- no de sumar
               las filas visibles, que con 500 ventas daría un total falso. */
            ['Recaudado', `$${a.aforo.recaudadoCop.toLocaleString('es-CO')}`],
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
              <div className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-muted">
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

        {/* Las atendidas no se borran: se esconden. Se dice cuántas hay para
            que nadie piense que una alerta desapareció sola. */}
        {!!a?.atendidas && (
          <p className="mt-2 font-body text-xs text-muted">
            {a.atendidas} alerta{a.atendidas === 1 ? '' : 's'} escondida
            {a.atendidas === 1 ? '' : 's'} porque alguien ya se hizo cargo.
          </p>
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
                <span className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-muted">
                  {al.nivel === 'critico' ? 'Crítico' : 'Aviso'}
                </span>
                <span className="font-body text-sm font-bold text-bone">{al.tipo}</span>
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

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {al.referencia && al.tipo === 'CORREO_NO_ENVIADO' && (
                  <button
                    onClick={() => reenviar(al.referencia!)}
                    className="btn-gold !px-5 !py-2 !text-xs"
                  >
                    Reenviar ahora
                  </button>
                )}

                {/* Esconde la alerta del panel. NO arregla el problema ni toca
                    la orden: es "ya me hice cargo de esto".
                    Sin este botón las alertas se acumulan para siempre, y un
                    tablero que solo crece deja de mirarse -- que es peor que
                    no tenerlo, porque la alerta que sí importa se pierde entre
                    las viejas. */}
                <button
                  onClick={() => atender(al.tipo, al.referencia)}
                  className="font-body text-xs text-muted underline underline-offset-4 transition-colors hover:text-bone"
                >
                  Ya me hice cargo
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* --- últimas ventas ---
          La razón de existir de esta tabla: antes solo había buscador, y para
          buscar hay que saber a quién. Quien entraba a ver cómo va la venta no
          veía ninguna. Ahora lo primero que se ve es la venta pasando. */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-bone">Últimas ventas</h2>
          <span className="font-body text-xs text-muted">
            Las {ventas.length} más recientes · pagadas
          </span>
        </div>

        {ventas.length === 0 ? (
          <p className="mt-3 font-body text-sm text-muted">
            Todavía no hay ventas pagadas.
          </p>
        ) : (
          /* El contenedor scrollea solo: en móvil la tabla no cabe y sin esto
             empuja la página entera de lado. */
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.08]">
            <table className="w-full min-w-[720px] border-collapse font-body text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">
                  <th className="w-8 px-2 py-3 font-medium" aria-label="Desplegar"></th>
                  <th className="px-4 py-3 font-medium">Referencia</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Promoción</th>
                  <th className="px-4 py-3 text-center font-medium">Boletas</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pagada</th>
                  <th className="px-4 py-3 font-medium">Correo</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => {
                  const abierta = desplegada === v.referencia;
                  return (
                  <Fragment key={v.referencia}>
                  <tr
                    onClick={() => setDesplegada(abierta ? null : v.referencia)}
                    className={`cursor-pointer border-b border-white/[0.05] transition-colors hover:bg-white/[0.03] ${
                      abierta ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    {/* La flecha marca que la fila se abre. Sin ella nadie
                        descubre que hay algo debajo. */}
                    <td className="px-2 py-3 text-center align-middle">
                      <ChevronDown
                        size={15}
                        className={`inline-block text-muted transition-transform duration-200 ${
                          abierta ? 'rotate-180 text-gold' : ''
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); abrir(v.referencia); }}
                        className="text-gold underline underline-offset-4"
                      >
                        {v.referencia}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-bone">
                      {v.nombre}
                      <span className="block text-xs text-muted">
                        {v.cedula} · {v.correo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-bone/80">{v.promocion ?? '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-bone">{v.cantidad}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">
                      ${(v.total_centavos / 100).toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {v.pagada_en
                        ? new Date(v.pagada_en).toLocaleString('es-CO', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    {/* Que el correo salió es lo que decide si esa persona
                        tiene su QR. Si está vacío, no le llegó nada. */}
                    <td className="px-4 py-3 text-xs">
                      {v.correo_enviado_a ? (
                        <span className="text-emerald-400/90">enviado</span>
                      ) : (
                        <span className="text-red-400/90">sin enviar</span>
                      )}
                    </td>
                  </tr>

                  {/* A NOMBRE DE QUIÉN VAN LAS BOLETAS.
                      Quien compra 4 no va solo, y hasta ahora el panel solo
                      mostraba al que pagó. Esto es lo que se necesita para
                      responderle a quien llama diciendo "no me llegó la de mi
                      esposa", y para saber quién va a entrar. */}
                  {abierta && (
                    <tr className="border-b border-white/[0.05] bg-ink/40">
                      <td colSpan={8} className="px-4 py-4 sm:px-12">
                        <p className="mb-3 font-body text-[11px] font-black uppercase tracking-[0.14em] text-muted">
                          Boletas de esta compra
                        </p>
                        <ul className="space-y-2">
                          {v.asistentes.map((a) => (
                            <li
                              key={a.boleta_id ?? a.indice}
                              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-gold/40 pl-3"
                            >
                              <span className="font-body text-sm text-bone">{a.nombre}</span>
                              <span className="font-body text-xs text-muted">
                                {a.tipo_documento} {a.cedula}
                              </span>
                              <span className="font-body text-xs text-muted">
                                {a.es_egresado
                                  ? `Promoción ${a.promocion}`
                                  : a.promocion
                                  ? 'No egresado'
                                  : 'Sin promoción'}
                              </span>
                              {/* El estado de la boleta es lo que le importa a
                                  quien está en la puerta: si dice usada, ese
                                  código ya entró y no sirve otra vez. */}
                              {a.boleta_estado === 'usada' ? (
                                <span className="font-body text-xs text-gold">
                                  ya entró
                                  {a.usada_en
                                    ? ` · ${new Date(a.usada_en).toLocaleString('es-CO', {
                                        day: '2-digit', month: '2-digit',
                                        hour: '2-digit', minute: '2-digit',
                                      })}`
                                    : ''}
                                </span>
                              ) : a.boleta_estado === 'anulada' ? (
                                <span className="font-body text-xs text-red-400/90">anulada</span>
                              ) : (
                                <span className="font-body text-xs text-emerald-400/80">sin usar</span>
                              )}
                              {a.boleta_id && (
                                <span className="font-body text-[10.5px] text-muted/70">
                                  {a.boleta_id}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
          {/* Lo que se le manda al proveedor de la pistola: el código del QR,
              sin datos personales. Ver descargarCsvLector en lib/admin.ts. */}
          <button
            type="button"
            onClick={() => descargarCsvLector(token).catch(() => setAviso('No se pudo descargar.'))}
            className="btn-ghost !px-6 !py-3 !text-xs"
            title="Boletas válidas con el código del QR, para el sistema del lector"
          >
            Lista para el lector
          </button>
        </form>

        {aviso && <p className="mt-3 font-body text-sm text-gold">{aviso}</p>}

        {resultados && resultados.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse font-body text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] font-black uppercase tracking-[0.16em] text-muted">
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

          <h3 className="mt-6 font-body text-[11px] font-black uppercase tracking-[0.16em] text-muted">
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
