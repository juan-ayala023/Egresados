'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import Preloader from '@/components/Preloader';
import SmoothScroll from '@/components/SmoothScroll';
import ScrollProgress from '@/components/ScrollProgress';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Historia from '@/components/Historia';
import Artistas from '@/components/Artistas';
import Galeria from '@/components/Galeria';
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
