import { useEffect } from 'react'

// Bloquea el scroll del body mientras `locked` sea true.
// Usado por el menú móvil y el lightbox de la galería.
export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}
