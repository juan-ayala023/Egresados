import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Check } from 'lucide-react'
import { STORIES, DIFFERENTIATORS } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import LazyImage from '../components/ui/LazyImage'
import cn from '../utils/cn'

function StoryBlock({ story, index }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const imgY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])
  const isRight = story.align === 'right'

  return (
    <div
      ref={ref}
      className="grid items-center gap-8 lg:grid-cols-12 lg:gap-16"
    >
      {/* Imagen enorme con parallax */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className={cn(
          'relative lg:col-span-7',
          isRight && 'lg:order-2 lg:col-start-6',
        )}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] sm:aspect-[16/11]">
          <motion.div style={{ y: imgY }} className="absolute inset-0 h-[116%] -top-[8%]">
            <LazyImage
              src={story.image}
              alt={story.alt}
              className="h-full w-full"
            />
          </motion.div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
        </div>

        {/* Número flotante grande */}
        <span
          className={cn(
            'pointer-events-none absolute -top-10 font-serif text-[7rem] leading-none text-bronze/20 sm:text-[9rem]',
            isRight ? 'right-0 lg:-right-8' : 'left-0 lg:-left-8',
          )}
        >
          0{index + 1}
        </span>
      </motion.div>

      {/* Texto */}
      <motion.div
        variants={stagger(0.15)}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className={cn(
          'lg:col-span-5',
          isRight ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-8',
        )}
      >
        <motion.p variants={fadeUp} className="eyebrow mb-5">
          {story.kicker}
        </motion.p>
        <motion.h3
          variants={fadeUp}
          className="font-serif text-4xl font-light leading-tight text-ivory sm:text-5xl text-balance"
        >
          {story.title}
        </motion.h3>
        <motion.p
          variants={fadeUp}
          className="mt-6 text-lg font-light leading-relaxed text-ivory/55 text-pretty"
        >
          {story.text}
        </motion.p>
      </motion.div>
    </div>
  )
}

export default function Story() {
  return (
    <section id="la-cabana" className="relative overflow-hidden bg-ink py-28 sm:py-36">
      {/* Halo cálido: evita que el arranque de la sección sea un muro negro
          plano justo después del hero. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(176,141,87,0.13),transparent_70%)]" />

      <div className="container-luxe relative">
        {/* Intro editorial */}
        <motion.div
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mx-auto mb-24 max-w-3xl text-center"
        >
          <motion.p variants={fadeUp} className="eyebrow mb-6">
            La experiencia Kudita
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="font-serif text-display-sm font-light text-ivory text-balance"
          >
            No venimos a ofrecerte una noche. Venimos a devolverte el fin de semana.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-7 max-w-2xl text-lg font-light leading-relaxed text-ivory/55 text-pretty"
          >
            Kudita nació con un propósito muy simple: crear un lugar donde la
            gente pueda desconectarse de la rutina, compartir con los suyos y
            volver con recuerdos que duren.
          </motion.p>
        </motion.div>

        {/* Bloques narrativos */}
        <div className="space-y-32 sm:space-y-44">
          {STORIES.map((story, i) => (
            <StoryBlock key={story.id} story={story} index={i} />
          ))}
        </div>

        {/* Diferenciadores */}
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-32 border-y border-ivory/10 py-14"
        >
          <motion.p variants={fadeUp} className="eyebrow mb-9 text-center">
            Lo que nos hace diferentes
          </motion.p>
          <ul className="mx-auto grid max-w-4xl gap-x-10 gap-y-5 sm:grid-cols-2">
            {DIFFERENTIATORS.map((item) => (
              <motion.li key={item} variants={fadeUp} className="flex items-start gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0 text-bronze" strokeWidth={2} />
                <span className="font-light leading-relaxed text-ivory/70">{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
