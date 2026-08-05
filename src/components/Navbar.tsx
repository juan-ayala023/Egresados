'use client';

import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import { ease } from '@/lib/motion';

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
        <a href="#top" className="flex items-baseline gap-2.5">
          <span className="lining font-display text-2xl leading-none text-gold">80</span>
          <span className="hidden font-body text-[10px] uppercase tracking-eyebrow text-muted sm:block">
            Homecoming
          </span>
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

        <a
          href="#boletas"
          className="rounded-full border border-gold/40 px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          Comprar
        </a>
      </nav>
    </motion.header>
  );
}
