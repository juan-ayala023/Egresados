'use client';

import type { Variants } from 'framer-motion';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { MapPin, CalendarDays, Clock } from 'lucide-react';
import Photo from './Photo';
import Magnetic from './Magnetic';
import Aurora from './Aurora';
import CompartirWhatsApp from './CompartirWhatsApp';
import { dur, ease, escalonar, palabra, subir } from '@/lib/motion';
import { evento, imagenes } from '@/data';

/* Entrada del sello: entra grande y se asienta, como el golpe de un sello de
   tinta. Ahora vive dentro de una tarjeta a la derecha, así que la tarjeta
   aterriza derecha (torcida chocaría con la columna de texto) y la
   inclinación de estampado se la queda la pieza de adentro. */
const sello: Variants = {
  oculto: { opacity: 0, scale: 1.12, rotate: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: dur.base, ease: ease.out },
  },
};

function useCuentaRegresiva(iso: string) {
  const [t, setT] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  useEffect(() => {
    const destino = new Date(iso).getTime();
    const tick = () => {
      const diff = Math.max(0, destino - Date.now());
      setT({
        dias: Math.floor(diff / 86400000),
        horas: Math.floor((diff / 3600000) % 24),
        minutos: Math.floor((diff / 60000) % 60),
        segundos: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return t;
}

/* Dígito que rota al cambiar, como un tablero de aeropuerto */
function Digito({ valor }: { valor: string }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={valor}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.42, ease: ease.out }}
          className="absolute inset-0 flex items-center justify-center tabular-nums"
        >
          {valor}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Unidad({ valor, label }: { valor: number; label: string }) {
  const s = String(valor).padStart(2, '0');
  return (
    <div>
      <div className="flex font-display font-bold text-3xl leading-none text-bone lining sm:text-4xl">
        {s.split('').map((d, i) => (
          <Digito key={i} valor={d} />
        ))}
      </div>
      <div className="mt-2 font-body text-[9px] uppercase tracking-[0.18em] text-muted sm:text-[10px] sm:tracking-eyebrow">{label}</div>
    </div>
  );
}

export default function Hero({ listo }: { listo: boolean }) {
  const t = useCuentaRegresiva(evento.fechaISO);
  const ref = useRef<HTMLElement>(null);
  const sinMovimiento = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const fondoY = useTransform(scrollYProgress, [0, 1], ['0%', '26%']);
  const fondoEscala = useTransform(scrollYProgress, [0, 1], [1.06, 1.18]);
  const contenidoY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contenidoOpacidad = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const velo = useTransform(scrollYProgress, [0, 1], [0.45, 0.85]);

  const unidades = [
    { v: t.dias, l: 'Días' },
    { v: t.horas, l: 'Horas' },
    { v: t.minutos, l: 'Min' },
    { v: t.segundos, l: 'Seg' },
  ];

  const titulo = evento.tituloHero;

  return (
    <section
      ref={ref}
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-between overflow-hidden"
    >
      <motion.div
        style={sinMovimiento ? undefined : { y: fondoY, scale: fondoEscala }}
        className="absolute inset-0 will-change-transform"
      >
        <Photo
          src={imagenes.hero}
          alt="Homecoming, edicion anterior"
          sizes="100vw"
          priority
          treat={false}
          className="grayscale-[14%] brightness-[0.95]"
        />
      </motion.div>

      {/* Duotono de marca. `mix-blend-color` toma el matiz y la saturación de
          esta capa (Azul 280C) y conserva la luminosidad de la foto: la
          fotografía queda teñida del azul del colegio en vez de ser una foto
          de fiesta cualquiera oscurecida. Bajó de /70 a /40: la foto se pedía
          más clara y a /70 el azul se comía el detalle. */}
      <div className="absolute inset-0 bg-brand/40 mix-blend-color" />

      {/* El velo general se aclaró para que la foto se vea. Lo que salva la
          lecturabilidad ya no es oscurecerlo todo, sino el degradado
          horizontal de abajo: la izquierda (donde va el texto) queda oscura y
          la derecha se abre para que la foto respire. */}
      <motion.div
        style={sinMovimiento ? undefined : { opacity: velo }}
        className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/25 to-ink/90"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-ink/20 lg:via-ink/45 lg:to-transparent" />
      <div className="absolute inset-0 bg-gold/[0.05] mix-blend-overlay" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink to-transparent" />

      {/* Dos columnas en escritorio: el texto a la izquierda y el sello a la
          derecha. Antes el sello iba encima del titular y empujaba todo el
          bloque hacia abajo, que era lo que dejaba la información cortada
          contra el borde inferior. En móvil vuelve a una sola columna con el
          sello arriba (`order`), que ahí sí es la primera lectura. */}
      <motion.div
        style={sinMovimiento ? undefined : { y: contenidoY, opacity: contenidoOpacidad }}
        variants={escalonar(0.15, 0.09)}
        initial="oculto"
        animate={listo ? 'visible' : 'oculto'}
        className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-[clamp(1.5rem,4vh,2.5rem)] px-6 pb-[clamp(1.5rem,3vh,2.5rem)] pt-[clamp(5.5rem,11vh,7.5rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14"
      >
        <div className="order-2 lg:order-1">
          <motion.p variants={subir} className="eyebrow">
            {evento.eyebrowHero}
          </motion.p>

          {/* El título pasó de dos palabras a una frase de tres renglones: a
              11vw se comía la pantalla. Cuerpo más bajo y ancho acotado para
              que las líneas se lean como frase y no como titular de prensa.
              Con la columna a la mitad del ancho, el tope baja a 4.25rem. */}
          <h1 className="lining mt-[clamp(0.9rem,2.2vh,1.25rem)] font-display text-[clamp(2.1rem,min(5.4vw,7.4vh),4.25rem)] font-bold leading-[0.95] tracking-[-0.02em]">
            {/* La máscara del reveal recorta a la altura de la caja de línea, y
                leading-[0.88] la deja más corta que el descendente: la 'g' de
                Homecoming baja hasta ~1.02em y quedaba cortada.

                El relleno va en el HIJO, no en la máscara. Puesto en la máscara
                agranda la zona visible y el texto asoma por debajo antes de
                animar; puesto en el hijo crece también su altura, y como
                `palabra` lo esconde con translateY(110%) el recorrido aumenta
                solo. El margen negativo del padre descuenta ese alto extra para
                que el interlineado entre las dos líneas no cambie. */}
            {titulo.map((linea, i) => (
              <span key={linea} className="block overflow-hidden -mb-[0.18em]">
                <motion.span
                  variants={palabra}
                  className={`block pb-[0.24em] ${i === titulo.length - 1 ? 'text-gold' : ''}`}
                >
                  {linea}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.div
            variants={subir}
            className="mt-[clamp(1rem,2.4vh,1.5rem)] h-px w-full max-w-md origin-left bg-gradient-to-r from-gold/60 to-transparent"
          />

          <motion.p
            variants={subir}
            className="mt-[clamp(0.9rem,2.2vh,1.25rem)] max-w-xl font-body text-base leading-relaxed text-bone/75"
          >
            {evento.descripcion}
          </motion.p>

          {/* Fecha, lugar y hora dejaron de ser tres líneas sueltas sobre la
              foto: van en una sola ficha con fondo propio. Con la foto más
              clara, el texto pequeño sin caja se perdía contra el público. */}
          <motion.div
            variants={subir}
            className="mt-[clamp(1rem,2.6vh,1.5rem)] inline-flex flex-col gap-y-2.5 rounded-2xl border border-white/10 bg-ink/55 px-5 py-3.5 font-body text-sm text-bone/85 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6"
          >
            <span className="flex items-center gap-2.5">
              <CalendarDays size={16} className="shrink-0 text-gold" strokeWidth={1.5} />
              {evento.fechaTexto}
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <span className="flex items-center gap-2.5">
              <MapPin size={16} className="shrink-0 text-gold" strokeWidth={1.5} />
              {evento.lugar} ({evento.direccion})
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <span className="flex items-center gap-2.5">
              <Clock size={16} className="shrink-0 text-gold" strokeWidth={1.5} />
              {evento.horaTexto}
            </span>
          </motion.div>

          {/* Apilados en móvil y a lo ancho: el CTA principal es largo y en una
              fila de dos se partía en dos renglones. */}
          <motion.div
            variants={subir}
            className="mt-[clamp(1.1rem,3vh,1.75rem)] flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
          >
            <Magnetic href="#boletas" className="btn-gold">
              {evento.ctaPrincipal}
            </Magnetic>
            <Magnetic href="#artistas" className="btn-ghost" fuerza={0.2}>
              {evento.ctaSecundario}
            </Magnetic>
          </motion.div>

          {/* Acción grupal, deliberadamente por debajo de los dos botones: la
              prioridad es comprar, no compartir. */}
          <motion.div variants={subir} className="mt-[clamp(0.9rem,2.2vh,1.25rem)]">
            <CompartirWhatsApp />
          </motion.div>
        </div>

        {/* Sello del evento: la firma de la pieza. Va la versión blanca porque
            el fondo es la foto teñida de navy; la dorada se apagaría contra el
            velo. La tarjeta con fondo propio lo separa del público de la foto,
            que ahora se ve mucho más. */}
        <motion.div variants={sello} className="order-1 w-full lg:order-2 lg:justify-self-end">
          <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-gold/25 bg-ink/55 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-8 lg:mx-0">
            <Image
              src={imagenes.selloBlanco}
              alt="Sello TCS Homecoming Party"
              width={3174}
              height={881}
              priority
              className="mx-auto h-auto w-full max-w-[300px] -rotate-2 drop-shadow-[0_10px_26px_rgba(0,0,0,0.5)]"
            />
            <p className="mt-6 border-t border-white/10 pt-5 text-center font-body text-[10px] uppercase leading-relaxed tracking-[0.24em] text-bone/60">
              {evento.aniversario} años de historia &amp; reencuentro
            </p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={listo ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: dur.slow, ease: ease.out, delay: 0.75 }}
        className="relative z-10 border-t border-white/[0.08] bg-ink/50 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-[clamp(0.9rem,2vh,1.5rem)] md:flex-row md:items-center md:gap-6">
          {/* gap-7 con 4 unidades y etiquetas de tracking ancho sumaba más
              de 330px: se desbordaba en iPhone SE. Escala con la pantalla. */}
          <div className="flex w-full items-end justify-between gap-3 sm:w-auto sm:justify-start sm:gap-7">
            {unidades.map((u) => (
              <Unidad key={u.l} valor={u.v} label={u.l} />
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="font-body text-xs uppercase tracking-[0.18em] text-bone/70">
              {evento.urgencia}
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={listo ? { opacity: 1 } : {}}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="pointer-events-none absolute bottom-28 left-1/2 z-10 hidden -translate-x-1/2 xl:block"
      >
        <div className="h-14 w-px overflow-hidden bg-white/15">
          <motion.div
            animate={{ y: ['-100%', '100%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-full bg-gold"
          />
        </div>
      </motion.div>
    </section>
  );
}
