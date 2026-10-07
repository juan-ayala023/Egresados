import { useScroll, useTransform } from 'framer-motion'

// Parallax muy ligero y elegante. Devuelve un MotionValue de desplazamiento Y.
// `range` controla la intensidad (en px). Se ancla a un ref de sección.
export default function useParallax(ref, range = 60) {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  return useTransform(scrollYProgress, [0, 1], [range, -range])
}
