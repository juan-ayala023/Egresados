import Navbar from '../layout/Navbar'
import Footer from '../layout/Footer'
import Hero from '../sections/Hero'
import Story from '../sections/Story'
import Amenities from '../sections/Amenities'
import Experiences from '../sections/Experiences'
import Guests from '../sections/Guests'
import Gallery from '../sections/Gallery'
import Pricing from '../sections/Pricing'
import Location from '../sections/Location'
import Faq from '../sections/Faq'
import FinalCTA from '../sections/FinalCTA'
import FloatingWhatsApp from '../components/FloatingWhatsApp'

// Página principal — orquesta las secciones en un embudo continuo:
// deseo (hero, historia) → prueba (espacios, experiencias, galería) →
// decisión (tarifas, ubicación, dudas) → acción (CTA final).
export default function Home() {
  return (
    <div className="relative bg-ink">
      <Navbar />
      <main>
        <Hero />
        <Story />
        <Amenities />
        <Experiences />
        <Guests />
        <Gallery />
        <Pricing />
        <Location />
        <Faq />
        <FinalCTA />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  )
}
