'use client';

/* Luz ambiental.
   El navy plano se lee barato: no tiene profundidad, y a pantalla completa
   se nota. Esto son manchas de luz difusa muy suaves detrás del contenido,
   que dan la sensación de un espacio iluminado en vez de un fondo pintado.

   Todo va en CSS puro (sin JS, sin canvas) y con pointer-events-none, así
   que no cuesta nada en rendimiento ni interfiere con los clics.
   El `motion-reduce` apaga el movimiento para quien lo pidió. */

type Props = {
  variante?: 'oro' | 'agua' | 'mixta';
  className?: string;
  intensidad?: number;
};

export default function Aurora({
  variante = 'mixta',
  className = '',
  intensidad = 1,
}: Props) {
  const oro = `rgb(var(--gold) / ${0.14 * intensidad})`;
  const agua = `rgb(var(--brand) / ${0.3 * intensidad})`;

  const capas =
    variante === 'oro'
      ? [
          { color: oro, pos: '18% 22%', tam: '46rem', dur: 'animate-[floatSlow_14s_ease-in-out_infinite]' },
          { color: oro, pos: '82% 72%', tam: '34rem', dur: 'animate-[floatSlow_18s_ease-in-out_infinite_reverse]' },
        ]
      : variante === 'agua'
      ? [
          { color: agua, pos: '25% 30%', tam: '52rem', dur: 'animate-[floatSlow_16s_ease-in-out_infinite]' },
          { color: agua, pos: '75% 80%', tam: '40rem', dur: 'animate-[floatSlow_20s_ease-in-out_infinite_reverse]' },
        ]
      : [
          { color: agua, pos: '20% 18%', tam: '50rem', dur: 'animate-[floatSlow_16s_ease-in-out_infinite]' },
          { color: oro, pos: '78% 68%', tam: '38rem', dur: 'animate-[floatSlow_22s_ease-in-out_infinite_reverse]' },
        ];

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {capas.map((c, i) => (
        <div
          key={i}
          className={`absolute inset-0 motion-reduce:animate-none ${c.dur}`}
          style={{
            background: `radial-gradient(${c.tam} circle at ${c.pos}, ${c.color}, transparent 62%)`,
          }}
        />
      ))}
    </div>
  );
}
