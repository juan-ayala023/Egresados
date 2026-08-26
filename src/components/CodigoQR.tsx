'use client';

/* QR visual para la maqueta. No codifica datos reales: en producción se reemplaza
   por un QR firmado que genera el backend al confirmar el pago. */

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 25;

export default function CodigoQR({ seed, size = 168 }: { seed: string; size?: number }) {
  const rand = hash(seed);
  const cell = size / N;

  const esFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);

  const modulos: JSX.Element[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (esFinder(x, y)) continue;
      if (rand() > 0.52) {
        modulos.push(
          <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} />
        );
      }
    }
  }

  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g transform={`translate(${x * cell} ${y * cell})`}>
      <rect width={cell * 7} height={cell * 7} />
      <rect x={cell} y={cell} width={cell * 5} height={cell * 5} fill="#FFFFFF" />
      <rect x={cell * 2} y={cell * 2} width={cell * 3} height={cell * 3} />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Código QR de la boleta"
      className="rounded-sm bg-white p-1"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      <g fill="#001222">
        {modulos}
        <Finder x={0} y={0} />
        <Finder x={N - 7} y={0} />
        <Finder x={0} y={N - 7} />
      </g>
    </svg>
  );
}
