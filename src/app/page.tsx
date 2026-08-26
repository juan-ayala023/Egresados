'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Preloader from '@/components/Preloader';
import SmoothScroll from '@/components/SmoothScroll';
import ScrollProgress from '@/components/ScrollProgress';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Historia from '@/components/Historia';
import Artistas from '@/components/Artistas';
import Galeria from '@/components/Galeria';
import Frase from '@/components/Frase';
import Boletas from '@/components/Boletas';
import Checkout from '@/components/Checkout';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';
import { ease } from '@/lib/motion';
import type { Boleta } from '@/data';

export default function Home() {
  const [seleccion, setSeleccion] = useState<{ boleta: Boleta; cantidad: number } | null>(null);
  const [listo, setListo] = useState(false);

  const terminarCarga = useCallback(() => setListo(true), []);

  /* Red de seguridad.
     Todo el sitio bajo el hero se muestra con opacity: listo ? 1 : 0, así que
     `listo` es un único punto de falla para TODO el contenido. Si el preloader
     no alcanza a llamar onDone —un error de JS, un dispositivo lento, una
     pestaña en segundo plano que congela los rAF— el visitante se queda
     mirando una página en blanco y no hay forma de recuperarse.

     Este temporizador destapa el contenido pase lo que pase. El preloader
     normal termina en ~1.9s; a los 4s ya algo salió mal. */
  useEffect(() => {
    const red = setTimeout(() => setListo(true), 4000);
    return () => clearTimeout(red);
  }, []);

  return (
    <>
      <Preloader onDone={terminarCarga} />
      <SmoothScroll />
      <ScrollProgress />
      <Navbar listo={listo} />

      <main>
        <Hero listo={listo} />

        {/* El resto del sitio aparece cuando el telón termina de abrir */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: listo ? 1 : 0 }}
          transition={{ duration: 0.8, ease: ease.out }}
        >
          <Historia />
          <Artistas />
          <Galeria />
          <Frase />
          <Boletas onComprar={(boleta, cantidad) => setSeleccion({ boleta, cantidad })} />
          <FAQ />
        </motion.div>
      </main>

      <Footer />

      <Checkout
        boleta={seleccion?.boleta ?? null}
        cantidad={seleccion?.cantidad ?? 1}
        onClose={() => setSeleccion(null)}
      />
    </>
  );
}
