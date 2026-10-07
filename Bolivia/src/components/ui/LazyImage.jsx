import { useState } from 'react'
import cn from '../../utils/cn'

// Imagen con carga diferida y transición suave de aparición.
// Muestra un fondo cálido mientras carga para evitar saltos bruscos.
export default function LazyImage({ src, alt, className, imgClassName, ...props }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={cn('overflow-hidden bg-ink-muted', className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          'h-full w-full object-cover transition-all duration-[1200ms] ease-luxe',
          loaded ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-md',
          imgClassName,
        )}
        {...props}
      />
    </div>
  )
}
