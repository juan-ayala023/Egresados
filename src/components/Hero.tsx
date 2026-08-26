'use client';

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MapPin, CalendarDays, Clock } from 'lucide-react';
import Photo from './Photo';
import Magnetic from './Magnetic';
import Aurora from './Aurora';
import { dur, ease, escalonar, palabra, subir } from '@/lib/motion';
import { evento, imagenes } from '@/data';

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
  const velo = useTransform(scrollYProgress, [0, 1], [0.55, 0.9]);

  const unidades = [
    { v: t.dias, l: 'Días' },
    { v: t.horas, l: 'Horas' },
    { v: t.minutos, l: 'Min' },
    { v: t.segundos, l: 'Seg' },
  ];

  const titulo = ['Homecoming', '80 Años'];

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
          className="grayscale-[42%] brightness-[0.6]"
        />
      </motion.div>

      <motion.div
        style={sinMovimiento ? undefined : { opacity: velo }}
        className="absolute inset-0 bg-gradient-to-b from-ink via-ink/60 to-ink"
      />
      <div className="absolute inset-0 bg-gold/[0.07] mix-blend-overlay" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink to-transparent" />

      <motion.div
        style={sinMovimiento ? undefined : { y: contenidoY, opacity: contenidoOpacidad }}
        variants={escalonar(0.15, 0.09)}
        initial="oculto"
        animate={listo ? 'visible' : 'oculto'}
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pb-16 pt-36"
      >
        <motion.p variants={subir} className="eyebrow">
          {evento.colegio} · {evento.fundacion}–{evento.fundacion + evento.aniversario}
        </motion.p>

        <h1 className="lining mt-6 font-display text-[clamp(3rem,11vw,8.5rem)] font-bold leading-[0.88] tracking-[-0.02em]">
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
                className={`block pb-[0.24em] ${i === 1 ? 'text-gold' : ''}`}
              >
                {linea}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          variants={subir}
          className="mt-8 h-px w-full max-w-md origin-left bg-gradient-to-r from-gold/60 to-transparent"
        />

        <motion.p
          variants={subir}
          className="mt-7 max-w-lg font-body text-base leading-relaxed text-bone/70"
        >
          {evento.descripcion}
        </motion.p>

        <motion.div
          variants={subir}
          className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3 font-body text-sm text-bone/80"
        >
          <span className="flex items-center gap-2.5">
            <CalendarDays size={16} className="text-gold" strokeWidth={1.5} />
            {evento.fechaTexto}
          </span>
          <span className="flex items-center gap-2.5">
            <MapPin size={16} className="text-gold" strokeWidth={1.5} />
            {evento.lugar} ({evento.direccion})
          </span>
          <span className="flex items-center gap-2.5">
            <Clock size={16} className="text-gold" strokeWidth={1.5} />
            {evento.horaTexto}
          </span>
        </motion.div>

        <motion.div variants={subir} className="mt-11 flex flex-wrap items-center gap-4">
          <Magnetic href="#boletas" className="btn-gold">
            Comprar boleta
          </Magnetic>
          <Magnetic href="#evento" className="btn-ghost" fuerza={0.2}>
            Ver el evento
          </Magnetic>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={listo ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: dur.slow, ease: ease.out, delay: 0.75 }}
        className="relative z-10 border-t border-white/[0.08] bg-ink/50 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-6 md:flex-row md:items-center">
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
        className="pointer-events-none absolute bottom-32 left-1/2 z-10 hidden -translate-x-1/2 lg:block"
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
