'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/* Hilo dorado que mide el avance. Continúa el hilo del preloader. */

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 260, damping: 40, restDelta: 0.001 });

  return (
    <motion.div
      style={{ scaleX: x }}
      className="fixed inset-x-0 top-0 z-[90] h-[2px] origin-left bg-gradient-to-r from-gold/40 via-gold to-goldSoft"
    />
  );
}
