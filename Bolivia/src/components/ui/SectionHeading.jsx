import { motion } from 'framer-motion'
import { fadeUp, stagger, viewportOnce } from '../../utils/animations'
import cn from '../../utils/cn'

// Encabezado editorial reutilizable: eyebrow + título grande + intro opcional.
export default function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
  light = false,
  className,
}) {
  return (
    <motion.header
      variants={stagger(0.15)}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && (
        // Sobre fondo claro usamos un bronce más oscuro: el bronce base
        // no alcanza contraste suficiente sobre marfil.
        <motion.p
          variants={fadeUp}
          className={cn('eyebrow mb-5', light && 'text-bronze-deep')}
        >
          {eyebrow}
        </motion.p>
      )}
      <motion.h2
        variants={fadeUp}
        className={cn(
          'font-serif text-display-sm font-light text-balance',
          light ? 'text-ink' : 'text-ivory',
        )}
      >
        {title}
      </motion.h2>
      {intro && (
        <motion.p
          variants={fadeUp}
          className={cn(
            'mt-6 text-lg font-light leading-relaxed text-pretty',
            light ? 'text-ink/70' : 'text-ivory/60',
          )}
        >
          {intro}
        </motion.p>
      )}
    </motion.header>
  )
}
