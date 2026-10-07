import { motion } from 'framer-motion'
import cn from '../../utils/cn'

// Botón/enlace de marca. Renderiza <a> por defecto para que funcione como CTA
// de navegación o WhatsApp. Variantes pensadas sobre fondos claros y oscuros.
const VARIANTS = {
  solid:
    'bg-bronze text-ink hover:bg-bronze-soft shadow-float-soft',
  outline:
    'border border-ivory/40 text-ivory hover:border-ivory hover:bg-ivory/5',
  'outline-dark':
    'border border-ink/25 text-ink hover:border-ink/60 hover:bg-ink/5',
  ghost: 'text-ivory/80 hover:text-ivory',
}

const SIZES = {
  md: 'px-7 py-3 text-[0.8rem]',
  lg: 'px-9 py-4 text-[0.85rem]',
}

export default function Button({
  as = 'a',
  variant = 'solid',
  size = 'md',
  className,
  children,
  ...props
}) {
  const Comp = motion[as] || motion.a
  return (
    <Comp
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium uppercase tracking-[0.18em] transition-colors duration-500',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}
