import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { GALLERY, img, imgSm } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import SectionHeading from '../components/ui/SectionHeading'
import LazyImage from '../components/ui/LazyImage'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import cn from '../utils/cn'

export default function Gallery() {
  const [index, setIndex] = useState(null)
  const isOpen = index !== null
  useLockBodyScroll(isOpen)

  const close = useCallback(() => setIndex(null), [])
  const next = useCallback(
    () => setIndex((i) => (i + 1) % GALLERY.length),
    [],
  )
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + GALLERY.length) % GALLERY.length),
    [],
  )

  // Navegación por teclado en el lightbox
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close, next, prev])

  return (
    <section id="galeria" className="relative bg-ink py-28 sm:py-36">
      <div className="container-luxe">
        <SectionHeading
          eyebrow="Galería"
          title="Mira exactamente lo que vas a encontrar."
          intro="Fotos reales de la cabaña, del club y del entorno. Sin retoques ni promesas que no podamos cumplir."
        />

        {/* Mosaico tipo Pinterest (masonry con columns) */}
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          className="mt-14 columns-1 gap-5 sm:columns-2 lg:columns-3"
        >
          {GALLERY.map((item, i) => (
            <motion.button
              key={item.id}
              variants={fadeUp}
              onClick={() => setIndex(i)}
              className={cn(
                'group mb-5 block w-full overflow-hidden rounded-2xl',
                item.span === 'tall' ? 'aspect-[3/4]' : 'aspect-[4/3]',
              )}
              aria-label={`Ver ${item.alt}`}
            >
              <div className="relative h-full w-full">
                <LazyImage
                  src={imgSm(item.name)}
                  alt={item.alt}
                  className="h-full w-full"
                  imgClassName="transition-transform duration-[1200ms] ease-luxe group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/25" />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Galería de fotos, imagen ${index + 1} de ${GALLERY.length}`}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 backdrop-blur-lg"
            onClick={close}
          >
            {/* Cerrar */}
            <button
              onClick={close}
              aria-label="Cerrar galería"
              className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full border border-ivory/20 text-ivory transition-colors hover:bg-ivory/10"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Anterior */}
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              aria-label="Anterior"
              className="absolute left-4 grid h-12 w-12 place-items-center rounded-full border border-ivory/20 text-ivory transition-colors hover:bg-ivory/10 sm:left-8"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            {/* Imagen */}
            <motion.img
              key={GALLERY[index].id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              src={img(GALLERY[index].name)}
              alt={GALLERY[index].alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] max-w-[88vw] rounded-xl object-contain shadow-float"
            />

            {/* Pie de foto */}
            <span className="absolute bottom-16 left-1/2 max-w-[80vw] -translate-x-1/2 text-center text-sm font-light text-ivory/70">
              {GALLERY[index].alt}
            </span>

            {/* Siguiente */}
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              aria-label="Siguiente"
              className="absolute right-4 grid h-12 w-12 place-items-center rounded-full border border-ivory/20 text-ivory transition-colors hover:bg-ivory/10 sm:right-8"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Contador */}
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm tracking-[0.14em] text-ivory/60">
              {index + 1} / {GALLERY.length}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
