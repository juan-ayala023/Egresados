'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { escalonar, palabra } from '@/lib/motion';
import { enVista } from '@/lib/motion';

type Props = {
  texto: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  /* Palabras que se pintan en dorado, por índice */
  acento?: number[];
  /* Fuerza un salto de línea después de estos índices */
  saltos?: number[];
  delay?: number;
  gap?: number;
  /* Si es true anima al montar en vez de esperar el scroll */
  inmediato?: boolean;
};

export default function RevealText({
  texto,
  as = 'h2',
  className = '',
  acento = [],
  saltos = [],
  delay = 0,
  gap = 0.07,
  inmediato = false,
}: Props) {
  const sinMovimiento = useReducedMotion();
  const palabras = texto.split(' ');
  const Tag = motion[as];

  if (sinMovimiento) {
    return <Tag className={className}>{texto}</Tag>;
  }

  return (
    <Tag
      variants={escalonar(delay, gap)}
      initial="oculto"
      {...(inmediato ? { animate: 'visible' } : { whileInView: 'visible', viewport: enVista })}
      className={className}
      aria-label={texto}
    >
      {palabras.map((p, i) => (
        <span key={`${p}-${i}`}>
          <span
            aria-hidden
            className="inline-block overflow-hidden align-bottom"
            style={{ paddingBottom: '0.12em', marginBottom: '-0.12em' }}
          >
            <motion.span
              variants={palabra}
              className={`inline-block ${acento.includes(i) ? 'text-gold' : ''}`}
            >
              {p}
            </motion.span>
          </span>
          {saltos.includes(i) ? <br /> : <span aria-hidden> </span>}
        </span>
      ))}
    </Tag>
  );
}
