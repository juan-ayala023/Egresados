import { motion } from 'framer-motion'
import { Check, PartyPopper } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { PRICING, PRICING_NOTES, wa } from '../utils/data'
import { fadeUp, stagger, viewportOnce } from '../utils/animations'
import SectionHeading from '../components/ui/SectionHeading'
import Button from '../components/ui/Button'
import cn from '../utils/cn'

export default function Pricing() {
  return (
    <section id="tarifas" className="relative overflow-hidden bg-forest-deep py-28 sm:py-36">
      {/* Textura sutil de fondo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(176,141,87,0.16),transparent_45%)]" />

      <div className="container-luxe relative">
        <SectionHeading
          align="center"
          eyebrow="Tarifas"
          title="Precios claros, sin sorpresas."
          intro="Alquilas la cabaña completa para tu grupo. La tarifa depende del día de la semana — nada más."
        />

        {/* Tarjetas de precio */}
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PRICING.map((tier) => (
            <motion.div
              key={tier.id}
              variants={fadeUp}
              whileHover={{ y: -8 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'relative flex flex-col rounded-[1.5rem] border p-8',
                tier.featured
                  ? 'border-bronze bg-gradient-to-b from-bronze/20 to-ivory/[0.04] shadow-float'
                  : 'border-ivory/10 bg-ivory/[0.04] backdrop-blur-sm',
              )}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-bronze px-4 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-ink">
                  Más pedido
                </span>
              )}
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-bronze-soft">
                {tier.detail}
              </p>
              <h3 className="mt-1 font-serif text-2xl font-light text-ivory">
                {tier.label}
              </h3>

              <div className="mt-8 flex items-baseline gap-2">
                <span className="text-sm font-light text-ivory/50">desde</span>
                <span className="font-serif text-5xl font-light text-ivory">
                  {tier.price}
                </span>
              </div>
              <p className="mt-1 text-sm uppercase tracking-[0.12em] text-ivory/50">
                {tier.unit}
              </p>

              <div className="mt-auto pt-8">
                <Button
                  href={wa(`Hola, quiero reservar Cabaña Alpina Kudita — tarifa de ${tier.label.toLowerCase()}. ¿Tienen disponibilidad?`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant={tier.featured ? 'solid' : 'outline'}
                  className="w-full"
                >
                  Reservar
                </Button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Notas + eventos privados */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-12 grid gap-5 lg:grid-cols-[1.4fr_1fr]"
        >
          {/* Qué incluye */}
          <div className="rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.04] p-8">
            <p className="eyebrow mb-6">Qué incluye tu reserva</p>
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {PRICING_NOTES.map((note) => (
                <li key={note} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-bronze" strokeWidth={1.6} />
                  <span className="font-light leading-relaxed text-ivory/70">{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Eventos privados */}
          <div className="flex flex-col justify-center rounded-[1.5rem] border border-bronze/30 bg-gradient-to-br from-bronze/15 to-transparent p-8 text-center">
            <PartyPopper className="mx-auto mb-4 h-8 w-8 text-bronze" strokeWidth={1.4} />
            <h3 className="font-serif text-2xl font-light text-ivory">
              ¿Un cumpleaños o una reunión familiar?
            </h3>
            <p className="mt-3 font-light text-ivory/60">
              La cabaña recibe hasta 20 personas para eventos privados. Escríbenos
              y armamos la fecha a tu medida.
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                href={wa('Hola, quiero organizar un evento privado en Cabaña Alpina Kudita. ¿Cómo lo coordinamos?')}
                target="_blank"
                rel="noopener noreferrer"
                size="md"
              >
                <FaWhatsapp className="text-base" />
                Consultar por un evento
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
