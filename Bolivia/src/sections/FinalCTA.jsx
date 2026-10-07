import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { FaWhatsapp } from 'react-icons/fa'
import { Mail, ArrowUpRight } from 'lucide-react'
import { BRAND, BOOKING_CHANNELS, img, wa } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import Button from '../components/ui/Button'

export default function FinalCTA() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const bgY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  // Sólo mostramos los canales que ya tienen enlace configurado.
  const extraChannels = BOOKING_CHANNELS.filter((c) => !c.primary && c.href)

  return (
    <section
      id="reservar"
      ref={ref}
      className="relative isolate flex min-h-[92svh] items-center justify-center overflow-hidden py-28"
    >
      {/* Fondo espectacular con parallax. `isolate` en la sección + z positivos:
          con `-z-10` estas capas quedaban detrás del `bg-ink` del contenedor. */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 z-0 h-[124%] -top-[12%]">
        <img
          src={img('laguna-atardecer-bote')}
          alt="Atardecer sobre la laguna del Puerto Santa Cruz Yacht Club"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </motion.div>
      <div className="absolute inset-0 z-[1] bg-ink/55" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-ink via-transparent to-ink/60" />

      <motion.div
        variants={stagger(0.15)}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="container-luxe relative z-10 text-center"
      >
        <motion.p variants={fadeUp} className="eyebrow mb-7">
          {BRAND.tagline}
        </motion.p>

        <motion.h2
          variants={fadeUp}
          className="mx-auto max-w-4xl font-serif text-display font-light leading-[0.98] text-ivory text-balance"
        >
          Elige tu fecha antes de que la elijan por ti.
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-8 max-w-xl text-lg font-light text-ivory/70"
        >
          Los sábados y feriados se reservan con semanas de anticipación.
          Escríbenos y te confirmamos disponibilidad al momento.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            href={wa('Hola, quiero reservar Cabaña Alpina Kudita. ¿Qué fechas tienen disponibles?')}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
          >
            <FaWhatsapp className="text-base" />
            Reservar por WhatsApp
          </Button>
          <Button href={`mailto:${BRAND.email}`} variant="outline" size="lg">
            <Mail className="h-4 w-4" />
            Escribirnos un correo
          </Button>
        </motion.div>

        <motion.p variants={fadeUp} className="mt-10 text-sm tracking-[0.12em] text-ivory/50">
          {BRAND.phone} · {BRAND.location}
        </motion.p>

        {/* Otros canales de reserva — sólo los configurados */}
        {extraChannels.length > 0 && (
          <motion.div variants={fadeUp} className="mt-14">
            <p className="eyebrow mb-6">También puedes reservarnos en</p>
            <ul className="flex flex-wrap items-center justify-center gap-3">
              {extraChannels.map(({ id, name, icon: Icon, href }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-full border border-ivory/25 px-5 py-2.5 text-sm text-ivory/80 backdrop-blur-sm transition-all duration-500 hover:border-bronze hover:bg-bronze hover:text-ink"
                  >
                    {Icon && <Icon className="text-base" />}
                    {name}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-50 transition-opacity group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}
