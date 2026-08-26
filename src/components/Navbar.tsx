'use client';

import Image from 'next/image';

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ease } from '@/lib/motion';
import { evento, imagenes } from '@/data';
import Aurora from './Aurora';

const links = [
  { href: '#evento', label: 'El evento' },
  { href: '#artistas', label: 'Artistas' },
  { href: '#galeria', label: 'Galería' },
  { href: '#boletas', label: 'Boletas' },
  { href: '#faq', label: 'Preguntas' },
];

export default function Navbar({ listo }: { listo: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [menu, setMenu] = useState(false);

  /* Con el menú abierto, el fondo no debe poder desplazarse: en móvil se
     siente como si la página se escapara por detrás del panel. */
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menu]);

  /* Escape cierra, como cualquier diálogo. */
  useEffect(() => {
    if (!menu) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [menu]);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => {
    const previo = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    /* Se esconde al bajar, reaparece apenas se sube: deja la pantalla limpia
       para la fotografía y devuelve el menú cuando el usuario lo busca. */
    setOculto(y > 340 && y > previo);
  });

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={listo ? { y: oculto ? -100 : 0, opacity: 1 } : { y: -80, opacity: 0 }}
      transition={{ duration: 0.6, ease: ease.out, delay: listo && !oculto ? 0.2 : 0 }}
      className={`fixed inset-x-0 top-0 z-50 transition-[padding,background-color,border-color] duration-500 ${
        scrolled
          ? 'border-b border-white/[0.06] bg-ink/85 py-3 backdrop-blur-xl'
          : 'border-b border-transparent py-6'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <a href="#top" aria-label={`${evento.titulo} — ${evento.colegio}`} className="flex items-center">
          {/* Alto fijo, ancho automático: la marca no se deforma nunca.
              Encoge al hacer scroll, igual que el resto de la barra. */}
          <Image
            src={imagenes.logoHorizontal}
            alt={`${evento.titulo} · ${evento.colegio}`}
            width={1880}
            height={659}
            priority
            className={`w-auto transition-[height] duration-500 ${
              scrolled ? 'h-8 sm:h-9' : 'h-10 sm:h-12'
            }`}
          />
        </a>

        <ul className="hidden items-center gap-9 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative font-body text-[12px] uppercase tracking-[0.16em] text-bone/60 transition-colors hover:text-gold"
              >
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-right scale-x-0 bg-gold transition-transform duration-500 ease-out group-hover:origin-left group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="#boletas"
            className="rounded-full border border-gold/40 px-4 py-2 font-body text-[10px] uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.16em]"
          >
            Comprar
          </a>

          {/* Área táctil de 44px, el mínimo recomendado para el pulgar. */}
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
            aria-expanded={menu}
            aria-controls="menu-movil"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-bone transition-colors hover:text-gold lg:hidden"
          >
            <Menu size={22} strokeWidth={1.5} />
          </button>
        </div>
      </nav>

      {/* ---------- Panel móvil ---------- */}
      <AnimatePresence>
        {menu && (
          <motion.div
            id="menu-movil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: ease.out }}
            className="fixed inset-0 z-[70] lg:hidden"
          >
            {/* Fondo opaco: sobre una foto un panel translúcido no se lee. */}
            <div className="absolute inset-0 bg-ink" />
            <Aurora variante="mixta" intensidad={0.8} />

            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between px-6 py-6">
                <Image
                  src={imagenes.logoHorizontal}
                  alt={`${evento.titulo} · ${evento.colegio}`}
                  width={1880}
                  height={659}
                  className="h-9 w-auto"
                />
                <button
                  type="button"
                  onClick={() => setMenu(false)}
                  aria-label="Cerrar menú"
                  className="-mr-2 flex h-11 w-11 items-center justify-center text-bone transition-colors hover:text-gold"
                >
                  <X size={24} strokeWidth={1.5} />
                </button>
              </div>

              {/* Enlaces grandes, uno por línea. En móvil el pulgar necesita
                  destino amplio, no una lista apretada. */}
              <nav className="flex flex-1 flex-col justify-center px-6">
                <ul className="space-y-1">
                  {links.map((l, i) => (
                    <motion.li
                      key={l.href}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: ease.out, delay: 0.06 + i * 0.06 }}
                    >
                      <a
                        href={l.href}
                        onClick={() => setMenu(false)}
                        className="flex items-baseline gap-4 border-b border-white/[0.07] py-4 font-display text-2xl font-bold text-bone transition-colors active:text-gold"
                      >
                        <span className="font-body text-[11px] tabular-nums text-gold/60">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {l.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: ease.out, delay: 0.4 }}
                className="px-6 pb-10"
              >
                <a
                  href="#boletas"
                  onClick={() => setMenu(false)}
                  className="btn-gold w-full"
                >
                  Comprar boleta
                </a>
                <p className="mt-4 text-center font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                  {evento.fechaTexto}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
