'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useRef } from 'react';
import { spring } from '@/lib/motion';

/* El botón se inclina hacia el cursor. Micro-detalle, alto impacto percibido. */

type Props = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  fuerza?: number;
};

export default function Magnetic({ children, className = '', href, onClick, fuerza = 0.32 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const sinMovimiento = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, spring.magnetico);
  const y = useSpring(my, spring.magnetico);

  const mover = (e: React.MouseEvent) => {
    if (sinMovimiento || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) * fuerza);
    my.set((e.clientY - (r.top + r.height / 2)) * fuerza);
  };

  const salir = () => {
    mx.set(0);
    my.set(0);
  };

  const Tag = (href ? motion.a : motion.button) as any;

  return (
    <Tag
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={mover}
      onMouseLeave={salir}
      style={{ x, y }}
      className={className}
    >
      {children}
    </Tag>
  );
}
