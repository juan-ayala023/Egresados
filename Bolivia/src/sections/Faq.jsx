import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FAQ, wa } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import SectionHeading from '../components/ui/SectionHeading'
import Button from '../components/ui/Button'
import cn from '../utils/cn'

function Item({ item, open, onToggle }) {
  return (
    <motion.div variants={fadeUp} className="border-b border-ivory/10">
      <h3>
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-6 py-6 text-left transition-colors hover:text-bronze-soft"
        >
          <span className="font-serif text-xl font-light text-ivory sm:text-2xl">
            {item.q}
          </span>
          <span
            className={cn(
              'mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ivory/20 text-bronze transition-transform duration-500 ease-luxe',
              open && 'rotate-45 border-bronze bg-bronze text-ink',
            )}
          >
            <Plus className="h-4 w-4" />
          </span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-7 pr-12 font-light leading-relaxed text-ivory/60 text-pretty">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="relative bg-ink py-28 sm:py-36">
      <div className="container-luxe">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-4">
            <SectionHeading
              eyebrow="Preguntas frecuentes"
              title="Lo que todos nos preguntan antes de reservar."
            />
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="mt-10"
            >
              <p className="mb-6 font-light leading-relaxed text-ivory/50">
                ¿Te quedó alguna duda? Escríbenos y te respondemos al momento.
              </p>
              <Button
                href={wa('Hola, tengo una consulta sobre Cabaña Alpina Kudita.')}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="md"
              >
                <FaWhatsapp className="text-base" />
                Escribir por WhatsApp
              </Button>
            </motion.div>
          </div>

          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            className="border-t border-ivory/10 lg:col-span-8"
          >
            {FAQ.map((item, i) => (
              <Item
                key={item.q}
                item={item}
                open={open === i}
                onToggle={() => setOpen(open === i ? null : i)}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
