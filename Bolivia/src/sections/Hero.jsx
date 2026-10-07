import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { MapPin } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { BRAND, TRUST, img, wa } from '../utils/data'
import { EASE } from '../utils/animations'
import Button from '../components/ui/Button'

// Línea por línea para el revelado tipo cortina del título.
const TITLE_LINES = ['Una cabaña', 'alpina frente', 'a la laguna.']

export default function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  // Parallax ligero: la imagen se aleja, el contenido sube al hacer scroll.
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-24%'])
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.4])

  // `isolate` crea el contexto de apilamiento de la sección. Sin él las capas
  // de fondo se pintan detrás del `bg-ink` del contenedor de Home y el hero se
  // ve completamente negro.
  return (
    <section
      id="top"
      ref={ref}
      className="relative isolate min-h-[100svh] w-full overflow-hidden"
    >
      {/* Fondo con Ken Burns + parallax. En móvil desplazamos el encuadre hacia
          la cabaña, que en la foto original está a la derecha. */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 z-0 h-[115%]">
        <img
          src={img('exterior-atardecer')}
          alt="Cabaña Alpina Kudita a la hora dorada: su estructura A-Frame de madera junto a la pérgola y el jardín"
          className="h-full w-full animate-kenburns object-cover object-[68%_50%] md:object-center"
          fetchpriority="high"
        />
      </motion.div>

      {/* Overlays: sólo el contraste necesario para leer, sin apagar la foto */}
      <motion.div
        style={{ opacity: overlayOpacity }}
        className="absolute inset-0 z-[1] bg-gradient-to-b from-ink/55 via-transparent to-ink"
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-ink/85 via-ink/45 to-transparent" />

      {/* Contenido */}
      <motion.div
        style={{ y: contentY }}
        className="container-luxe relative z-10 flex min-h-[100svh] flex-col justify-center pb-32 pt-28 sm:pb-40"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.4 }}
          className="eyebrow mb-6 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-bronze" />
          {BRAND.distance}
        </motion.p>

        <h1 className="font-serif text-display font-light leading-[0.95] text-ivory">
          {TITLE_LINES.map((line, i) => (
            // El padding abajo evita que `overflow-hidden` corte las
            // descendentes (g, j, p, q, y): con leading-[0.95] la caja de línea
            // es más baja que los glifos. El margen negativo devuelve el
            // interlineado original para no aflojar el título.
            <span key={line} className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
              {/* 130% en lugar de 110%: la caja de recorte ahora es más alta,
                  y con 110% asomaba el borde del texto antes de entrar. */}
              <motion.span
                initial={{ y: '130%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.5 + i * 0.12 }}
                className="block"
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 1 }}
          className="mt-6 max-w-xl text-base font-light leading-relaxed text-ivory/75 text-pretty sm:mt-8 sm:text-lg"
        >
          Una auténtica A-Frame en madera Mara dentro del Puerto Santa Cruz Yacht
          Club. Piscina, hidromasaje, fogatero y laguna navegable — para hasta 8
          huéspedes, a 45 minutos de Santa Cruz.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 1.2 }}
          className="mt-8 flex flex-col gap-3 sm:mt-11 sm:flex-row sm:gap-4"
        >
          <Button
            href={wa('Hola, quiero reservar Cabaña Alpina Kudita. ¿Qué fechas tienen disponibles?')}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
          >
            <FaWhatsapp className="text-base" />
            Consultar disponibilidad
          </Button>
          <Button href="#la-cabana" variant="outline" size="lg">
            Conocer la cabaña
          </Button>
        </motion.div>

        <motion.a
          href={BRAND.maps}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 1.4 }}
          className="mt-8 hidden w-fit items-center gap-2 text-sm font-light text-ivory/55 transition-colors hover:text-ivory sm:inline-flex"
        >
          <MapPin className="h-4 w-4 text-bronze" strokeWidth={1.6} />
          {BRAND.location} · {BRAND.city}
        </motion.a>
      </motion.div>

      {/* Barra de confianza — responde las dudas básicas sin hacer scroll */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE, delay: 1.5 }}
        className="absolute inset-x-0 bottom-0 z-10 border-t border-ivory/10 bg-ink/50 backdrop-blur-md"
      >
        <dl className="container-luxe grid grid-cols-2 divide-ivory/10 lg:grid-cols-4 lg:divide-x">
          {TRUST.map((item) => (
            <div key={item.label} className="px-4 py-5 text-center sm:py-6">
              <dt className="font-serif text-2xl font-light text-bronze sm:text-3xl">
                {item.value}
              </dt>
              <dd className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-ivory/55 sm:text-xs">
                {item.label}
              </dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </section>
  )
}
