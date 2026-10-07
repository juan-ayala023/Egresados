import { motion } from 'framer-motion'
import { MapPin, Mail, Phone } from 'lucide-react'
import { FaWhatsapp, FaInstagram, FaFacebookF, FaAirbnb } from 'react-icons/fa'
import { BRAND, NAV_LINKS, LINKS } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'

const CONTACT = [
  { icon: MapPin, text: BRAND.location, sub: `${BRAND.city} · ${BRAND.distance}`, href: BRAND.maps },
  { icon: Phone, text: BRAND.phone, sub: 'WhatsApp', href: BRAND.whatsappLink },
  { icon: Mail, text: BRAND.email, href: `mailto:${BRAND.email}` },
]

// Sólo se pintan las redes que tienen enlace configurado en data.js
const SOCIAL = [
  { icon: FaWhatsapp, href: BRAND.whatsappLink, label: 'WhatsApp' },
  { icon: FaAirbnb, href: LINKS.airbnb, label: 'Airbnb' },
  { icon: FaInstagram, href: LINKS.instagram, label: 'Instagram' },
  { icon: FaFacebookF, href: LINKS.facebook, label: 'Facebook' },
].filter((s) => s.href)

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink pt-24 pb-10">
      <div className="container-luxe">
        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="grid gap-14 lg:grid-cols-[1.4fr_1fr_1.2fr]"
        >
          {/* Marca */}
          <motion.div variants={fadeUp}>
            <span className="font-serif text-3xl text-ivory">{BRAND.name}</span>
            <p className="mt-5 max-w-sm font-light leading-relaxed text-ivory/50">
              Una auténtica cabaña alpina A-Frame en madera Mara, dentro del
              Puerto Santa Cruz Yacht Club. {BRAND.tagline}.
            </p>
            <div className="mt-7 flex gap-3">
              {SOCIAL.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-11 w-11 place-items-center rounded-full border border-ivory/15 text-ivory/70 transition-all duration-500 hover:border-bronze hover:bg-bronze hover:text-ink"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Navegación */}
          <motion.nav variants={fadeUp}>
            <h3 className="eyebrow mb-6">Explora</h3>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="font-light text-ivory/60 transition-colors hover:text-ivory"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq" className="font-light text-ivory/60 transition-colors hover:text-ivory">
                  Preguntas frecuentes
                </a>
              </li>
            </ul>
          </motion.nav>

          {/* Contacto */}
          <motion.div variants={fadeUp}>
            <h3 className="eyebrow mb-6">Contacto</h3>
            <ul className="space-y-5">
              {CONTACT.map(({ icon: Icon, text, sub, href }) => (
                <li key={text} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-bronze" strokeWidth={1.6} />
                  <div>
                    <a
                      href={href}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="font-light text-ivory/70 transition-colors hover:text-ivory"
                    >
                      {text}
                    </a>
                    {sub && <p className="text-sm text-ivory/40">{sub}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        <div className="mt-16 hairline" />

        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm text-ivory/40 sm:flex-row">
          <p>© {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.</p>
          <p className="font-light">{BRAND.location} · {BRAND.city}</p>
        </div>
      </div>
    </footer>
  )
}
