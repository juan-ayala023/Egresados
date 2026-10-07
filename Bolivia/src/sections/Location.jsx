import { motion } from 'framer-motion'
import { MapPin, Navigation, Car } from 'lucide-react'
import { BRAND, SURROUNDINGS, imgSm } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import SectionHeading from '../components/ui/SectionHeading'
import LazyImage from '../components/ui/LazyImage'
import Button from '../components/ui/Button'

export default function Location() {
  return (
    <section id="ubicacion" className="relative bg-ivory py-28 text-ink sm:py-36">
      <div className="container-luxe">
        <SectionHeading
          light
          eyebrow="Dónde estamos"
          title="Lejos de la rutina, cerca de tu casa."
          intro="Dentro del Puerto Santa Cruz Yacht Club, a 45 minutos del puente del Urubó. Suficiente para sentir que te fuiste — poco para tener que planificarlo con meses."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-12">
          {/* Mapa */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="overflow-hidden rounded-[2rem] border border-ink/10 shadow-float-soft lg:col-span-7"
          >
            <iframe
              title="Ubicación de Cabaña Alpina Kudita en el Puerto Santa Cruz Yacht Club"
              src="https://www.google.com/maps?q=Puerto+Santa+Cruz+Yacht+Club,+Santa+Cruz,+Bolivia&output=embed"
              className="h-[380px] w-full lg:h-full lg:min-h-[460px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </motion.div>

          {/* Datos de acceso */}
          <motion.div
            variants={stagger(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="flex flex-col gap-5 lg:col-span-5"
          >
            <motion.div variants={fadeUp} className="rounded-[1.5rem] border border-ink/10 bg-ivory-soft p-7">
              <MapPin className="mb-4 h-6 w-6 text-wood" strokeWidth={1.5} />
              <p className="font-serif text-2xl font-light text-ink">{BRAND.location}</p>
              <p className="mt-1 text-ink/60">{BRAND.city}</p>
              <div className="mt-6">
                <Button
                  href={BRAND.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline-dark"
                  size="md"
                >
                  <Navigation className="h-4 w-4" />
                  Abrir en Google Maps
                </Button>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-start gap-4 rounded-[1.5rem] border border-ink/10 bg-ivory-soft p-7">
              <Car className="mt-1 h-6 w-6 shrink-0 text-wood" strokeWidth={1.5} />
              <div>
                <p className="font-sans font-medium text-ink">45 minutos en auto</p>
                <p className="mt-1 font-light leading-relaxed text-ink/60">
                  Desde el puente del Urubó. Hay garaje privado en la cabaña para
                  dejar tu vehículo bajo techo.
                </p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="overflow-hidden rounded-[1.5rem]">
              <LazyImage
                src={imgSm('atardecer-camino')}
                alt="Camino de ingreso al complejo con la laguna y el atardecer de fondo"
                className="aspect-[16/9]"
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Qué hay alrededor */}
        <motion.ul
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-16 grid gap-x-8 gap-y-9 border-t border-ink/10 pt-14 sm:grid-cols-2 lg:grid-cols-4"
        >
          {SURROUNDINGS.map(({ icon: Icon, name, note }) => (
            <motion.li key={name} variants={fadeUp}>
              <Icon className="mb-4 h-6 w-6 text-bronze-deep" strokeWidth={1.5} />
              <p className="font-sans font-medium text-ink">{name}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/55">{note}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
