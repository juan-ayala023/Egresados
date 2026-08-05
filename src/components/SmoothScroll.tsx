'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/* Scroll con inercia. Es lo que separa un sitio "que se siente caro" de uno
   que no: todas las animaciones por scroll heredan esta suavidad. */

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    /* Los anclas del menú pasan por Lenis para que el salto también sea suave */
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const destino = document.querySelector(id);
      if (!destino) return;
      e.preventDefault();
      lenis.scrollTo(destino as HTMLElement, { offset: -80, duration: 1.4 });
    };

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
