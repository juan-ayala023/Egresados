import { motion } from 'framer-motion'
import { GUESTS, imgSm } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import SectionHeading from '../components/ui/SectionHeading'
import LazyImage from '../components/ui/LazyImage'

export default function Guests() {
  return (
    <section id="para-quien" className="relative bg-ivory py-28 text-ink sm:py-36">
      <div className="container-luxe">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          {/* Encabezado + tarjetas */}
          <div className="lg:col-span-7">
            <SectionHeading
              light
              eyebrow="Para quién es Kudita"
              title="Funciona igual de bien para ocho amigos que para dos."
              intro="La cabaña es privada y se alquila completa, así que se adapta al plan que traigas."
            />

            <motion.ul
              variants={stagger(0.08)}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2"
            >
              {GUESTS.map(({ id, icon: Icon, name, note }) => (
                <motion.li key={id} variants={fadeUp} className="group">
                  <span className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-wood/25 text-wood transition-all duration-500 group-hover:border-wood group-hover:bg-wood group-hover:text-ivory">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <p className="font-sans text-lg font-medium text-ink">{name}</p>
                  <p className="mt-1 font-light leading-relaxed text-ink/55">{note}</p>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {/* Imagen lateral */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="lg:col-span-5"
          >
            <div className="overflow-hidden rounded-[2rem] shadow-float">
              <LazyImage
                src={imgSm('almuerzo-familiar')}
                alt="Un grupo grande almorzando junto en una mesa larga de madera"
                className="aspect-[4/5] lg:aspect-[3/4]"
              />
            </div>
            <p className="mt-6 max-w-sm font-serif text-2xl font-light leading-snug text-ink/80">
              “Hasta 8 huéspedes en camas y 20 personas alrededor de la mesa.”
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
