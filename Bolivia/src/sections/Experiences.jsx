import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { EXPERIENCES, wa } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import LazyImage from '../components/ui/LazyImage'
import cn from '../utils/cn'

function ExperienceCard({ exp, large }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.15, 1])

  return (
    <motion.article
      ref={ref}
      variants={fadeUp}
      className={cn(
        // `flex ... justify-end` + contenido en flujo: la tarjeta crece si el
        // texto no entra, en vez de recortarlo. Con el bloque en `absolute`
        // los títulos largos se salían por arriba.
        'group relative flex h-full flex-col justify-end overflow-hidden rounded-[1.75rem]',
        large ? 'min-h-[70vh] lg:min-h-[86vh]' : 'min-h-[52vh] lg:min-h-[42vh]',
      )}
    >
      <motion.div style={{ scale: imgScale }} className="absolute inset-0">
        <LazyImage
          src={large ? exp.full : exp.image}
          alt={exp.name}
          className="h-full w-full"
          imgClassName={cn(
            'transition-transform duration-[1400ms] ease-luxe group-hover:scale-105',
            // `position` desplaza el encuadre cuando el sujeto no está al centro
            exp.position,
          )}
        />
      </motion.div>

      {/* Overlay: más denso abajo, donde va el texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-transparent transition-opacity duration-700" />

      {/* Tag */}
      <span className="absolute left-6 top-6 rounded-full border border-ivory/20 bg-ink/20 px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-ivory backdrop-blur-md">
        {exp.tag}
      </span>

      {/* Contenido — en flujo, no absoluto */}
      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-lg">
            <h3
              className={cn(
                'font-serif font-light leading-tight text-ivory',
                large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl',
              )}
            >
              {exp.name}
            </h3>
            {/* Siempre visible: es texto de venta y en móvil no hay hover
                que lo revele. */}
            <p className="mt-3 max-w-md font-light leading-relaxed text-ivory/75">
              {exp.description}
            </p>
          </div>
          {/* La flecha era decorativa y no llevaba a ningún lado. Ahora cada
              experiencia abre WhatsApp con su propia consulta. */}
          <a
            href={wa(`Hola, quiero saber más sobre "${exp.name}" en Cabaña Alpina Kudita.`)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Consultar por ${exp.name} por WhatsApp`}
            className="hidden h-12 w-12 shrink-0 place-items-center self-end rounded-full border border-ivory/30 text-ivory transition-all duration-500 hover:bg-bronze hover:text-ink group-hover:border-bronze sm:grid"
          >
            <ArrowUpRight className="h-5 w-5" />
          </a>
        </div>
      </div>
    </motion.article>
  )
}

export default function Experiences() {
  return (
    <section id="experiencias" className="relative bg-ink py-28 sm:py-36">
      <div className="container-luxe">
        <motion.div
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mb-16 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end"
        >
          <div className="max-w-2xl">
            <motion.p variants={fadeUp} className="eyebrow mb-5">
              Qué se hace en Kudita
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-serif text-display-sm font-light text-ivory text-balance"
            >
              Un día aquí da para mucho más de lo que imaginas.
            </motion.h2>
          </div>
          <motion.p
            variants={fadeUp}
            className="max-w-sm font-light leading-relaxed text-ivory/50"
          >
            Parrillada al mediodía, laguna por la tarde, hidromasaje al caer el sol
            y fogata bajo las estrellas. Todo dentro de la misma propiedad.
          </motion.p>
        </motion.div>

        {/* Grid asimétrico de experiencias */}
        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          className="grid gap-5 lg:grid-cols-12"
        >
          {/* Primera destacada grande */}
          <div className="lg:col-span-7">
            <ExperienceCard exp={EXPERIENCES[0]} large />
          </div>
          {/* Dos apiladas */}
          <div className="grid gap-5 lg:col-span-5 lg:grid-rows-2">
            <ExperienceCard exp={EXPERIENCES[1]} />
            <ExperienceCard exp={EXPERIENCES[2]} />
          </div>

          {/* Fila inferior: tres columnas iguales. Antes era 5/3/4 y la del
              medio quedaba demasiado angosta para su título. */}
          <div className="lg:col-span-4">
            <ExperienceCard exp={EXPERIENCES[3]} />
          </div>
          <div className="lg:col-span-4">
            <ExperienceCard exp={EXPERIENCES[4]} />
          </div>
          <div className="lg:col-span-4">
            <ExperienceCard exp={EXPERIENCES[5]} />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
