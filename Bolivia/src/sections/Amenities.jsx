import { motion } from 'framer-motion'
import { FaWhatsapp } from 'react-icons/fa'
import { AMENITIES, LAYOUT, imgSm, wa } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import SectionHeading from '../components/ui/SectionHeading'
import LazyImage from '../components/ui/LazyImage'
import Button from '../components/ui/Button'

export default function Amenities() {
  return (
    <section id="espacios" className="relative bg-ivory py-28 text-ink sm:py-36">
      <div className="container-luxe">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          {/* Columna izquierda: imagen editorial + tarjeta flotante */}
          <div className="relative lg:col-span-5">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="overflow-hidden rounded-[2rem] shadow-float"
            >
              <LazyImage
                src={imgSm('habitacion-balcon')}
                alt="Habitación principal de la cabaña con cama matrimonial y salida al balcón"
                className="aspect-[4/5]"
              />
            </motion.div>

            {/* Tarjeta flotante con glassmorphism */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="absolute -bottom-8 -right-4 w-64 rounded-2xl border border-ink/10 bg-ivory-soft/85 p-6 shadow-float backdrop-blur-md sm:-right-8"
            >
              <p className="eyebrow mb-2 text-wood">Capacidad</p>
              <p className="font-serif text-2xl leading-tight text-ink">
                Hasta 8 en camas
              </p>
              <p className="mt-1 text-sm text-ink/60">
                y 20 personas para reuniones
              </p>
            </motion.div>
          </div>

          {/* Columna derecha: encabezado + distribución */}
          <div className="lg:col-span-7">
            <SectionHeading
              light
              eyebrow="La cabaña por dentro"
              title="Dos habitaciones, sala, comedor y cocina propia."
              intro="Todo en madera Mara, distribuido en dos niveles bajo el techo a dos aguas. Llegas con tu equipaje y no te falta nada."
            />

            <motion.ul
              variants={stagger(0.07)}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="mt-12 grid grid-cols-1 gap-x-10 sm:grid-cols-2"
            >
              {LAYOUT.map(({ name, note }, i) => (
                <motion.li
                  key={name}
                  variants={fadeUp}
                  className="flex items-baseline gap-4 border-b border-ink/10 py-4"
                >
                  <span className="font-serif text-sm text-bronze-deep">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="font-sans text-base font-medium text-ink">{name}</p>
                    <p className="text-sm text-ink/55">{note}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </div>

        {/* Amenidades — franja completa debajo */}
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-24 border-t border-ink/10 pt-16"
        >
          <motion.p variants={fadeUp} className="eyebrow mb-10 text-wood">
            Todo lo que está incluido
          </motion.p>

          <ul className="grid grid-cols-2 gap-x-8 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {AMENITIES.map(({ id, icon: Icon, name, note }) => (
              <motion.li key={id} variants={fadeUp} className="group flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest/5 text-forest transition-all duration-500 group-hover:bg-forest group-hover:text-ivory">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="font-sans text-base font-medium text-ink">{name}</p>
                  <p className="text-sm leading-snug text-ink/55">{note}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <motion.div variants={fadeUp} className="mt-14">
            <Button
              href={wa('Hola, quiero saber más sobre la cabaña y qué incluye la estadía.')}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline-dark"
              size="lg"
            >
              <FaWhatsapp className="text-base" />
              Preguntar por WhatsApp
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
