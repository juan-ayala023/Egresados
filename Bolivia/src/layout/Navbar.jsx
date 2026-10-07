import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import useScrolled from '../hooks/useScrolled'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import { BRAND, NAV_LINKS } from '../utils/data'
import Button from '../components/ui/Button'
import cn from '../utils/cn'

export default function Navbar() {
  const scrolled = useScrolled(60)
  const [open, setOpen] = useState(false)
  useLockBodyScroll(open)

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-700 ease-luxe',
          scrolled
            ? 'glass-dark py-4 shadow-glass'
            : 'bg-transparent py-6',
        )}
      >
        <nav className="container-luxe flex items-center justify-between">
          {/* Logo */}
          <a href="#top" className="group flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-bronze/50 text-bronze transition-colors group-hover:bg-bronze group-hover:text-ink">
              {/* Silueta A-Frame, la forma de la cabaña */}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M12 4 20 20 4 20Z" />
                <path d="M10.4 20v-4.2h3.2V20" />
              </svg>
            </span>
            <span className="leading-none">
              <span className="block font-serif text-xl tracking-wide text-ivory">
                {BRAND.short}
              </span>
              <span className="mt-0.5 block text-[0.55rem] uppercase tracking-luxe text-bronze">
                Cabaña alpina
              </span>
            </span>
          </a>

          {/* Links desktop */}
          <ul className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group relative font-sans text-[0.72rem] uppercase tracking-[0.14em] text-ivory/70 transition-colors hover:text-ivory"
                >
                  {link.label}
                  <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-bronze transition-all duration-500 ease-luxe group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>

          {/* CTA desktop */}
          <div className="hidden items-center gap-4 lg:flex">
            <Button
              href={BRAND.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              size="md"
            >
              <FaWhatsapp className="text-base" />
              Reservar
            </Button>
          </div>

          {/* Botón menú móvil */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="grid h-11 w-11 place-items-center rounded-full border border-ivory/20 text-ivory lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </motion.header>

      {/* Menú móvil overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-xl lg:hidden"
          >
            <div className="container-luxe flex items-center justify-between py-6">
              <span className="font-serif text-xl text-ivory">{BRAND.name}</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="grid h-11 w-11 place-items-center rounded-full border border-ivory/20 text-ivory"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
              className="container-luxe flex flex-1 flex-col justify-center gap-2"
            >
              {NAV_LINKS.map((link) => (
                <motion.li
                  key={link.href}
                  variants={{ hidden: { opacity: 0, x: -30 }, show: { opacity: 1, x: 0 } }}
                >
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-ivory/10 py-4 font-serif text-3xl font-light text-ivory/90 transition-colors hover:text-bronze sm:text-4xl"
                  >
                    {link.label}
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <div className="container-luxe pb-10">
              <Button
                href={BRAND.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                <FaWhatsapp className="text-base" />
                Reserva por WhatsApp
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
