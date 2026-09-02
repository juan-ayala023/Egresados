'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import Photo from './Photo';
import RevealText from './RevealText';
import { dur, ease, enVista, subir } from '@/lib/motion';
import { galeria, imagenes } from '@/data';

export default function Galeria() {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [sentido, setSentido] = useState(1);
  const total = galeria.fotos.length;

  /* ---- Carrusel ----
     Reemplaza la retícula de diez fotos: con todas a la vez el bloque
     quedaba lleno y pesado. Va sobre desplazamiento nativo con `scroll-snap`
     en vez de un arrastre en JS, porque así el gesto táctil, la rueda del
     trackpad y el teclado funcionan solos, y el navegador se encarga de
     frenar en la foto correcta.

     Las páginas se miden en vez de calcularse: cuántas fotos caben depende
     del punto de quiebre, y medir el carril evita repetir esos anchos en JS
     y que se desincronicen del CSS. */
  const pista = useRef<HTMLDivElement>(null);
  const [paginas, setPaginas] = useState(1);
  const [pagina, setPagina] = useState(0);
  const [pausa, setPausa] = useState(false);
  const sinMovimiento = useReducedMotion();
  /* Momento de la última acción del visitante. El paso automático no es un
     carrusel que manda: si alguien está mirando una foto, arrastrando o
     eligiendo un punto, la máquina se calla un rato. Va en ref y no en
     estado porque cambia en cada gesto y no tiene que repintar nada. */
  const ultimoGesto = useRef(0);

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el || el.clientWidth === 0) return;
    setPaginas(Math.max(1, Math.round(el.scrollWidth / el.clientWidth)));
    setPagina(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir]);

  const irAPagina = useCallback((p: number) => {
    const el = pista.current;
    if (!el) return;
    el.scrollTo({ left: p * el.clientWidth, behavior: 'smooth' });
  }, []);

  const deslizar = useCallback((paso: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: paso * el.clientWidth, behavior: 'smooth' });
  }, []);

  /* Paso automático. Avanza de a una pantalla completa y vuelve al principio
     al llegar al final. Se detiene con el cursor encima, con el foco dentro
     (quien navega con teclado no puede perseguir un carril en movimiento),
     mientras el visor está abierto, y ocho segundos después de cualquier
     gesto. Con `prefers-reduced-motion` no arranca nunca. */
  useEffect(() => {
    if (sinMovimiento || pausa || abierta !== null || paginas <= 1) return;
    const id = setInterval(() => {
      const el = pista.current;
      if (!el || Date.now() - ultimoGesto.current < 8000) return;
      const alFinal = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({
        left: alFinal ? 0 : el.scrollLeft + el.clientWidth,
        behavior: 'smooth',
      });
    }, 5000);
    return () => clearInterval(id);
  }, [sinMovimiento, pausa, abierta, paginas]);

  /* ---- Visor a pantalla completa ---- */
  const cerrar = useCallback(() => setAbierta(null), []);
  const mover = useCallback(
    (paso: number) => {
      setSentido(paso);
      setAbierta((i) => (i === null ? null : (i + paso + total) % total));
    },
    [total]
  );

  useEffect(() => {
    if (abierta === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [abierta, cerrar, mover]);

  return (
    <section id="galeria" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="eyebrow"
          >
            {galeria.eyebrow}
          </motion.p>
          <RevealText
            texto={galeria.titulo}
            as="h2"
            className="mt-6 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.015em]"
            acento={[4, 5]}
          />
          <motion.p
            variants={subir}
            initial="oculto"
            whileInView="visible"
            viewport={enVista}
            className="mt-6 max-w-xl font-body text-[15px] leading-relaxed text-bone/65"
          >
            {galeria.subtitulo}
          </motion.p>
        </div>

        {/* Sello del lema, en la esquina superior. El lettering es azul 280C:
            sobre el navy del sitio da 2.0:1 y desaparece, así que va dentro de
            una pastilla clara. La inclinación es lo que lo hace leer como
            sello estampado y no como un logo más. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, rotate: -10 }}
          whileInView={{ opacity: 1, scale: 1, rotate: -4 }}
          viewport={enVista}
          transition={{ duration: dur.slow, ease: ease.out }}
          className="shrink-0 self-start rounded-lg bg-bone px-5 py-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] md:self-end"
        >
          <Image
            src={imagenes.fraseTiger}
            alt="Once a Tiger, Always a Tiger"
            width={650}
            height={361}
            className="h-auto w-[150px] sm:w-[170px]"
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={enVista}
        transition={{ duration: dur.slow, ease: ease.out }}
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
        onFocusCapture={() => setPausa(true)}
        onBlurCapture={() => setPausa(false)}
        onPointerDown={() => {
          ultimoGesto.current = Date.now();
        }}
        className="relative mt-14"
      >
        {/* Las flechas son solo un atajo de escritorio: en táctil se desliza,
            y ocupando espacio sobre la foto estorbarían. */}
        {[
          { dir: -1 as const, Icono: ChevronLeft, pos: '-left-4', label: 'Fotos anteriores' },
          { dir: 1 as const, Icono: ChevronRight, pos: '-right-4', label: 'Más fotos' },
        ].map(({ dir, Icono, pos, label }) => (
          <button
            key={label}
            onClick={() => deslizar(dir)}
            aria-label={label}
            className={`absolute top-[38%] z-20 hidden h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-ink/80 text-bone backdrop-blur-sm transition-colors hover:border-gold hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:flex ${pos}`}
          >
            <Icono size={20} strokeWidth={1.5} />
          </button>
        ))}

        {/* `basis` decide cuántas fotos caben por pantalla; el resto del
            carrusel se adapta solo a partir de eso. */}
        <div
          ref={pista}
          onScroll={medir}
          className="sin-barra -mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto scroll-smooth px-6 pb-1"
        >
          {galeria.fotos.map((f, i) => (
            <button
              key={f.src}
              onClick={() => setAbierta(i)}
              aria-label={`Ampliar: ${f.alt}`}
              className="group relative aspect-[4/3] w-[78%] shrink-0 snap-start overflow-hidden rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:w-[46%] lg:w-[31%] xl:w-[23.5%]"
            >
              {/* Tratamiento propio en vez del de Photo: el de la casa baja el
                  brillo a 0.82 y aquí se pidieron las fotos más claras. */}
              <Photo
                src={f.src}
                alt={f.alt}
                sizes="(max-width: 640px) 78vw, (max-width: 1024px) 46vw, 24vw"
                treat={false}
                className="grayscale-[18%] contrast-[1.06] brightness-[0.98] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0 group-hover:brightness-110"
              />
              <div className="absolute inset-0 bg-ink/15 transition-opacity duration-700 group-hover:opacity-0" />
              <div className="absolute inset-0 bg-gold/[0.08] mix-blend-overlay" />
              <div className="absolute inset-0 border border-white/10 transition-colors duration-500 group-hover:border-gold/40" />

              {/* Pie que sube al pasar el cursor */}
              <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink/95 to-transparent px-4 pb-4 pt-10 text-left transition-transform duration-500 ease-out group-hover:translate-y-0 [@media(hover:none)]:translate-y-0">
                <span className="block font-body text-[11px] uppercase leading-relaxed tracking-[0.14em] text-bone/85">
                  {f.alt}
                </span>
              </span>

              <span className="absolute right-3 top-3 flex h-8 w-8 scale-75 items-center justify-center rounded-full bg-ink/70 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:scale-100 group-hover:opacity-100">
                <Expand size={14} className="text-gold" strokeWidth={1.5} />
              </span>
            </button>
          ))}
        </div>

        {paginas > 1 && (
          <div className="mt-7 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2.5">
              {Array.from({ length: paginas }, (_, p) => (
                <button
                  key={p}
                  onClick={() => irAPagina(p)}
                  aria-label={`Ir al grupo ${p + 1} de ${paginas}`}
                  aria-current={p === pagina}
                  className={`h-2 rounded-full transition-all duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                    p === pagina ? 'w-7 bg-gold' : 'w-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
            <p className="font-body text-[11px] uppercase tracking-[0.14em] text-muted">
              {galeria.pistaCarrusel}
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        variants={subir}
        initial="oculto"
        whileInView="visible"
        viewport={enVista}
        className="mt-14 flex flex-col items-center justify-center gap-5 border-t border-white/[0.08] pt-12 sm:flex-row sm:gap-7"
      >
        <p className="text-center font-display text-xl font-bold text-bone sm:text-2xl">
          {galeria.ctaPregunta}
        </p>
        <a href="#boletas" className="btn-gold text-center">
          {galeria.cta}
        </a>
      </motion.div>

      <AnimatePresence>
        {abierta !== null && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: ease.out }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/95"
            onClick={cerrar}
            role="dialog"
            aria-modal="true"
          >
            {[
              { pos: 'right-5 top-5', icon: X, accion: cerrar, label: 'Cerrar' },
              { pos: 'left-4 md:left-8', icon: ChevronLeft, accion: () => mover(-1), label: 'Anterior' },
              { pos: 'right-4 md:right-8', icon: ChevronRight, accion: () => mover(1), label: 'Siguiente' },
            ].map(({ pos, icon: Icon, accion, label }, k) => (
              <motion.button
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + k * 0.06, duration: 0.4, ease: ease.out }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.94 }}
                onClick={(e) => {
                  e.stopPropagation();
                  accion();
                }}
                aria-label={label}
                className={`absolute z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-bone transition-colors hover:border-gold hover:text-gold ${pos}`}
              >
                <Icon size={label === 'Cerrar' ? 18 : 20} strokeWidth={1.5} />
              </motion.button>
            ))}

            {/* En móvil nadie busca las flechas: desliza. El umbral de 60px
                evita que un scroll vertical torpe cambie de foto. */}
            <motion.div
              onClick={(e) => e.stopPropagation()}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) mover(1);
                else if (info.offset.x > 60) mover(-1);
              }}
              className="relative mx-auto w-[min(92vw,1000px)] touch-pan-y"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm">
                <AnimatePresence initial={false} mode="wait" custom={sentido}>
                  <motion.div
                    key={abierta}
                    custom={sentido}
                    initial={{ opacity: 0, x: sentido * 60, scale: 1.04 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: sentido * -60, scale: 0.98 }}
                    transition={{ duration: 0.5, ease: ease.out }}
                    className="absolute inset-0"
                  >
                    <Photo
                      src={galeria.fotos[abierta].src}
                      alt={galeria.fotos[abierta].alt}
                      sizes="90vw"
                      treat={false}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.figcaption
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: dur.base, ease: ease.out }}
                className="mt-4 flex items-center justify-between gap-4 font-body text-xs uppercase tracking-[0.14em] text-muted"
              >
                <span>{galeria.fotos[abierta].alt}</span>
                <span className="shrink-0 tabular-nums text-gold">
                  {String(abierta + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </span>
              </motion.figcaption>

              {/* Barra de posición dentro de la galería */}
              <div className="mt-3 h-px w-full bg-white/10">
                <motion.div
                  animate={{ width: `${((abierta + 1) / total) * 100}%` }}
                  transition={{ duration: 0.5, ease: ease.out }}
                  className="h-full bg-gold"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
