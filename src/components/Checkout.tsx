'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, Loader2, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { ease } from '@/lib/motion';
import { useBloquearScroll } from '@/lib/bloquearScroll';
import {
  DEPARTAMENTOS, DEPARTAMENTO_EXTERIOR, nombreCiudad, validarDireccion, validarCiudad,
} from '@/lib/direcciones';
import {
  anosGraduacion,
  formatoCOP,
  totalPorBoleta,
  metodosPago,
  type Boleta,
} from '@/data';
import {
  crearOrden, obtenerEvento, urlCheckoutWompi, ErrorApi, TIPOS_DOCUMENTO, ETIQUETA_DOCUMENTO,
  type AsistenteApi,
} from '@/lib/api';

type Asistente = AsistenteApi;

const vacio = (): Asistente => ({
  nombre: '',
  /* CC es el caso de casi todo el mundo; el acta pidió poder elegir NIT. */
  tipoDocumento: 'CC',
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
  /* La ciudad son DOS desplegables (14 de septiembre de 2026): departamento
     y luego municipio, con los 1.122 municipios oficiales del DANE. Antes era
     texto libre y aceptaba "xyz", y eso va a la factura electrónica.
     Si vive fuera de Colombia, elige "Fuera de Colombia" en el primero y
     escribe "Ciudad, País" a mano. `ciudad` es lo que se manda al servidor. */
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [ciudadTexto, setCiudadTexto] = useState('');
  const exterior = departamento === DEPARTAMENTO_EXTERIOR;
  const depElegido = DEPARTAMENTOS.find((d) => d.codigo === departamento);
  const muniElegido = depElegido?.municipios.find((m) => m.codigo === municipio);
  const ciudad = exterior
    ? ciudadTexto.trim()
    : depElegido && muniElegido ? nombreCiudad(muniElegido.nombre, depElegido.nombre) : '';
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  /* Un mensaje por campo, no un booleano: cuando el error viene del backend
     queremos mostrar su texto exacto y no uno genérico inventado aquí. */
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [sentido, setSentido] = useState(1);
  /* Enlaces a la política de datos y a los términos. Los publica el colegio y
     el backend los expone en /api/evento; mientras no existan llegan en null y
     las casillas se muestran como texto plano, igual que hasta ahora. */
  const [legales, setLegales] = useState<{ datos: string | null; terminos: string | null }>({
    datos: null, terminos: null,
  });

  /* Se piden al abrir el checkout. Si la consulta falla no se avisa nada: son
     un adorno del texto, no un requisito para comprar, y un error aquí no
     puede impedir una venta. */
  useEffect(() => {
    if (!boleta) return;
    let vigente = true;
    obtenerEvento()
      .then((e) => {
        if (vigente) setLegales({ datos: e.politicaDatosUrl, terminos: e.terminosUrl });
      })
      .catch(() => {});
    return () => { vigente = false; };
  }, [boleta]);

  useEffect(() => {
    if (boleta) {
      setPaso(0);
      setAsistentes(Array.from({ length: cantidad }, vacio));
      setDireccion('');
      setDepartamento('');
      setMunicipio('');
      setCiudadTexto('');
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
    return () => document.removeEventListener('keydown', onKey);
  }, [boleta, procesando, onClose]);

  /* El scroll del fondo lo congela el candado compartido. Antes se hacía aquí
     con document.body.style.overflow, y el Navbar y el Preloader —que hacen lo
     mismo— se lo quitaban: la rueda sobre el checkout movía la página. */
  useBloquearScroll(Boolean(boleta));

  /* LA RUEDA MUEVE EL FORMULARIO DESDE CUALQUIER PARTE DEL CUADRO.

     Con la página congelada, girar la rueda no hacía nada salvo que el puntero
     cayera justo sobre el formulario, y se sentía como que el sitio se hubiera
     trabado.

     POR QUÉ UN LISTENER NATIVO Y NO onWheel DE REACT: React registra `wheel`
     como pasivo, y un manejador pasivo no puede llamar a preventDefault. Sin
     eso hay que adivinar cuándo el navegador ya va a scrollear por su cuenta
     para no moverlo el doble — y esa adivinanza es lo que no funcionó. Con
     `{ passive: false }` se cancela el comportamiento del navegador y el
     scroll lo mueve SIEMPRE este código: pase lo que pase, una vuelta de
     rueda es una sola cantidad de desplazamiento. */
  const telonRef = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boleta) return;
    const telon = telonRef.current;
    if (!telon) return;

    const alGirar = (e: WheelEvent) => {
      const cuerpo = cuerpoRef.current;
      if (!cuerpo) return;
      e.preventDefault();
      /* deltaMode dice en qué unidad viene el giro: 0 píxeles (lo normal),
         1 líneas (varios ratones y Firefox), 2 páginas. Sin convertirlo, un
         mouse de los que reportan líneas movería 3px por vuelta y parecería
         que no responde. */
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cuerpo.clientHeight : 1;
      cuerpo.scrollTop += e.deltaY * factor;
    };

    telon.addEventListener('wheel', alGirar, { passive: false });
    return () => telon.removeEventListener('wheel', alGirar);
  }, [boleta]);

  /* AL CAMBIAR DE PASO, EL SCROLL VUELVE ARRIBA.
     El area scrolleable es la misma en los dos pasos, y para llegar al boton
     de continuar hay que bajar hasta el fondo del paso 1. Sin esto, el paso 2
     abria ya scrolleado a la mitad y el resumen del pago quedaba cortado. */
  useEffect(() => {
    if (cuerpoRef.current) cuerpoRef.current.scrollTop = 0;
  }, [paso]);

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
      /* Al menos dos palabras: el colegio pidio que no se pueda poner solo el
         nombre (13 de septiembre de 2026). La boleta va a nombre de esta
         persona y en la puerta se cruza con la cedula. */
      if (a.nombre.trim().split(/\s+/).length < 2) nuevos[`${i}-nombre`] = 'Escribe nombre y apellidos.';
      if (a.cedula.trim().length < 6) nuevos[`${i}-cedula`] = 'Mínimo 6 dígitos.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.correo)) nuevos[`${i}-correo`] = 'Correo no válido.';
      if (a.celular.replace(/\D/g, '').length < 10) nuevos[`${i}-celular`] = 'Mínimo 10 dígitos.';
      /* Solo QUIEN COMPRA (índice 0) tiene que poner su año de grado.
         Para los acompañantes es opcional: quien compra sabe el suyo, pero
         de los amigos que lleva puede no acordarse, y trancarlo ahí es
         perder la venta. Lo pidió el colegio el 11 de septiembre de 2026.
         El backend valida igual, no se confía en esto. */
      if (i === 0 && !a.promocion) nuevos[`${i}-promocion`] = 'Selecciona tu promoción.';

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
    if (Object.keys(nuevos).length) irAlPrimerError();
    return Object.keys(nuevos).length === 0;
  };

  /* Lleva la vista al primer error.
     Sin esto, alguien que no marcó las casillas de aceptación aprieta "Pagar"
     y no pasa nada: el aviso sale al final del formulario, fuera de la
     pantalla, y no hay forma de saber que hay que bajar. El botón parece
     roto. Pasó en la primera prueba real.

     Se busca en el DOM y no en el objeto de errores porque así se respeta el
     orden en que están los campos en pantalla, y no el orden en que se
     escribieron las validaciones. Va en el fotograma siguiente porque los
     avisos todavía no existen cuando se llama a setErrores. */
  const irAlPrimerError = () => {
    requestAnimationFrame(() => {
      const primero = document.querySelector('[data-error]');
      primero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const validarPago = () => {
    const nuevos: Record<string, string> = {};
    /* Misma regla que el servidor (lib/direcciones.ts): la dirección tiene
       que parecer una dirección y la ciudad tiene que ser una ciudad. Si vive
       fuera de Colombia no se le exige una vía colombiana. */
    const errorCiudad = validarCiudad(ciudad);
    if (errorCiudad) nuevos['ciudad'] = errorCiudad;
    const errorDireccion = validarDireccion(direccion, { exterior });
    if (errorDireccion) nuevos['direccion'] = errorDireccion;
    if (!aceptaDatos) nuevos['aceptaDatos'] = 'Debes aceptar el tratamiento de datos.';
    if (!aceptaTerminos) nuevos['aceptaTerminos'] = 'Debes aceptar los términos.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) irAlPrimerError();
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
          tipoDocumento: titular.tipoDocumento,
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

  /* El `data-error` es lo que permite encontrarlos después: al fallar la
     validación se busca el primero que exista en la página y se lleva al
     usuario hasta él. */
  const Aviso = ({ clave }: { clave: string }) =>
    errores[clave] ? (
      <p
        data-error={clave}
        className="mt-1.5 font-body text-[11.5px] leading-snug text-red-400/90"
      >
        {errores[clave]}
      </p>
    ) : null;

  return (
    <AnimatePresence>
      {boleta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          /* EL TELON NO SCROLLEA. Antes era `overflow-y-auto`, y con el cuerpo
             del cuadro tambien scrolleable habia DOS scrolls anidados: al
             llegar al final del de adentro, la rueda seguia en el de afuera y
             se sentia como que se movia la pagina de atras. Ahora el telon
             solo centra y el unico scroll esta dentro del cuadro. */
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-ink/92 px-4 py-6 backdrop-blur-md sm:py-8"
          ref={telonRef}
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
            /* max-h-full lo acota al alto del telon MENOS su padding, asi que
               nunca se sale de la pantalla y no hace falta ninguna medida en
               vh (que en movil miente por la barra del navegador).
               La columna flex es lo que deja el encabezado y el boton fijos
               mientras el medio scrollea. */
            className="relative flex max-h-full w-full max-w-2xl flex-col rounded-lg border border-white/10 bg-surface shadow-2xl"
          >
            {/* Encabezado */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex items-center gap-4">
                {paso === 1 && !procesando && (
                  <button
                    onClick={() => { setSentido(-1); setPaso(0); }}
                    aria-label="Volver"
                    className="text-bone transition-colors hover:text-gold"
                  >
                    <ArrowLeft size={18} strokeWidth={1.5} />
                  </button>
                )}
                <div>
                  {/* Dorado pleno y 12px, no 10px al 70%: el colegio pidio que
                      "Paso 1 de 2" se viera (13 de septiembre de 2026). */}
                  <p className="font-body text-[12px] font-black uppercase tracking-eyebrow text-gold">
                    Paso {paso + 1} de {PASOS.length}
                  </p>
                  <h3 className="mt-1 font-display font-black text-xl text-bone">{PASOS[paso]}</h3>
                </div>
              </div>
              {!procesando && (
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="text-bone transition-colors hover:text-gold"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Progreso */}
            <div className="flex shrink-0 gap-1.5 px-5 pt-4 sm:px-7 sm:pt-5">
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

            {/* EL UNICO QUE SCROLLEA.
                - flex-1 + min-h-0: toma el alto que sobra. El min-h-0 es
                  obligatorio, sin el un hijo flex no se deja encoger y el
                  overflow no llega a activarse nunca.
                - overscroll-contain: aunque algo quede scrolleable detras, la
                  rueda NO se pasa a la pagina al llegar al final. */}
            <div
              ref={cuerpoRef}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7 sm:py-7"
            >
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
                  <p className="font-body text-[13px] leading-relaxed text-bone">
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
                        <span className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-bone">
                          {i === 0 ? 'Titular de la compra' : `Acompañante ${i}`}
                        </span>
                        <div className="h-px flex-1 bg-white/[0.08]" />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="label">Nombre y apellidos completos</label>
                          <input
                            value={a.nombre}
                            onChange={(e) => actualizar(i, 'nombre', e.target.value)}
                            placeholder="Nombre y apellidos, como en el documento"
                            className={`field ${clase(`${i}-nombre`)}`}
                          />
                          <Aviso clave={`${i}-nombre`} />
                        </div>
                        <div>
                          <label className="label">Tipo de documento</label>
                          <select
                            value={a.tipoDocumento}
                            onChange={(e) => actualizar(i, 'tipoDocumento', e.target.value)}
                            className={`field ${clase(`${i}-tipoDocumento`)}`}
                          >
                            {TIPOS_DOCUMENTO.map((t) => (
                              <option key={t} value={t}>
                                {ETIQUETA_DOCUMENTO[t]}
                              </option>
                            ))}
                          </select>
                          <Aviso clave={`${i}-tipoDocumento`} />
                        </div>
                        <div>
                          <label className="label">Número de documento</label>
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
                          <label className="label">
                            Promoción
                            {i !== 0 && (
                              <span className="ml-1.5 font-normal normal-case tracking-normal text-bone">
                                · opcional
                              </span>
                            )}
                          </label>
                          <select
                            value={a.promocion}
                            onChange={(e) => actualizar(i, 'promocion', e.target.value)}
                            className={`field ${clase(`${i}-promocion`)}`}
                          >
                            <option value="">Año de grado</option>
                            {/* Solo los acompañantes pueden no ser egresados. El
                                colegio exige que QUIEN COMPRA sí lo sea, y el
                                backend lo verifica contra la base de mercadeo. */}
                            {i !== 0 && <option value="no-egresado">No es egresado</option>}
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
                      <span className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-bone">
                        Datos de facturación
                      </span>
                      <div className="h-px flex-1 bg-white/[0.08]" />
                    </div>
                    <p className="mb-4 font-body text-[12.5px] leading-relaxed text-bone">
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
                        <label className="label">Departamento</label>
                        <select
                          value={departamento}
                          onChange={(e) => { setDepartamento(e.target.value); setMunicipio(''); setCiudadTexto(''); limpiar('ciudad'); }}
                          className={`field ${clase('ciudad')}`}
                        >
                          <option value="">Selecciona el departamento</option>
                          {DEPARTAMENTOS.map((d) => (
                            <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                          ))}
                          <option value={DEPARTAMENTO_EXTERIOR}>Fuera de Colombia</option>
                        </select>
                      </div>
                      {exterior ? (
                        <div>
                          <label className="label">Ciudad y país</label>
                          <input
                            value={ciudadTexto}
                            onChange={(e) => { setCiudadTexto(e.target.value); limpiar('ciudad'); }}
                            placeholder="Miami, Estados Unidos"
                            className={`field ${clase('ciudad')}`}
                            autoFocus
                          />
                          <Aviso clave="ciudad" />
                        </div>
                      ) : (
                        <div>
                          <label className="label">Municipio</label>
                          <select
                            value={municipio}
                            onChange={(e) => { setMunicipio(e.target.value); limpiar('ciudad'); }}
                            disabled={!depElegido}
                            className={`field ${clase('ciudad')} disabled:opacity-50`}
                          >
                            <option value="">
                              {depElegido ? 'Selecciona el municipio' : 'Primero el departamento'}
                            </option>
                            {depElegido?.municipios.map((m) => (
                              <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                            ))}
                          </select>
                          <Aviso clave="ciudad" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="font-display font-bold text-xl text-bone">{boleta.nombre}</p>
                        <p className="mt-1 font-body text-[12px] text-bone">
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
                          <dt className="text-bone">
                            Boletas ({cantidad} × {formatoCOP(boleta.precio)})
                          </dt>
                          <dd className="tabular-nums text-bone/75">{formatoCOP(subtotal)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-bone">
                            Tarifa de servicio ({cantidad} × {formatoCOP(boleta.tarifaServicio)})
                          </dt>
                          <dd className="tabular-nums text-bone/75">{formatoCOP(tarifas)}</dd>
                        </div>
                      </dl>
                    )}

                    <div className="flex items-baseline justify-between">
                      <span className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-bone">
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
                      <span className="font-body text-[12.5px] leading-relaxed text-bone">
                        Autorizo el{' '}
                        {legales.datos ? (
                          <a
                            href={legales.datos}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-bone underline underline-offset-2 transition-colors hover:text-gold"
                          >
                            tratamiento de mis datos personales
                          </a>
                        ) : (
                          'tratamiento de mis datos personales'
                        )}{' '}
                        para la gestión del ingreso y la facturación del evento.
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
                      <span className="font-body text-[12.5px] leading-relaxed text-bone">
                        Acepto los{' '}
                        {legales.terminos ? (
                          <a
                            href={legales.terminos}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-bone underline underline-offset-2 transition-colors hover:text-gold"
                          >
                            términos y condiciones
                          </a>
                        ) : (
                          'términos y condiciones'
                        )}{' '}
                        de la venta.
                      </span>
                    </label>
                    <Aviso clave="aceptaTerminos" />
                  </div>

                  <div className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <ShieldCheck size={16} className="shrink-0 text-gold" strokeWidth={1.5} />
                    <p className="font-body text-[12px] leading-relaxed text-bone">
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
            <div className="shrink-0 border-t border-white/[0.08] px-5 py-4 sm:px-7 sm:py-5">
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
