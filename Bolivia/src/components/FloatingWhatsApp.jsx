import { AnimatePresence, motion } from 'framer-motion'
import { FaWhatsapp } from 'react-icons/fa'
import { wa } from '../utils/data'
import useScrolled from '../hooks/useScrolled'

// Botón flotante persistente para maximizar reservas directas.
// Aparece recién al pasar el hero: así no tapa la barra de datos
// ni compite con el CTA principal en la primera pantalla.
export default function FloatingWhatsApp() {
  const visible = useScrolled(500)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-40"
        >
          {/* Pulso sutil. Va como hermano del enlace: dentro quedaba detrás
              del fondo verde del propio botón y no se veía nunca. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#25D366]/40"
          />
          <motion.a
            href={wa('Hola, quiero reservar Cabaña Alpina Kudita. ¿Qué fechas tienen disponibles?')}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Reservar por WhatsApp"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center gap-3 rounded-full bg-[#25D366] py-3 pl-3 pr-5 shadow-float"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/25">
              <FaWhatsapp className="text-xl text-white" />
            </span>
            <span className="hidden text-sm font-medium uppercase tracking-[0.12em] text-white sm:inline">
              Reservar
            </span>
          </motion.a>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
