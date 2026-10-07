import { motion } from 'framer-motion'
import { fadeUp, viewportOnce } from '../../utils/animations'

// Envoltorio de revelado al hacer scroll. Reutilizable en toda la landing
// para mantener un lenguaje de movimiento coherente y elegante.
export default function Reveal({
  children,
  variants = fadeUp,
  className,
  delay = 0,
  as = 'div',
}) {
  const Comp = motion[as] || motion.div
  return (
    <Comp
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      transition={{ delay }}
      className={className}
    >
      {children}
    </Comp>
  )
}
