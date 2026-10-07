import { useEffect, useState } from 'react'

// Devuelve true cuando la página se ha desplazado más allá del umbral dado.
// Usado por el navbar para pasar de transparente a sólido con vidrio.
export default function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}
