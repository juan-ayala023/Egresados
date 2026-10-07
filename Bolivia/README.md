# Cabaña Alpina Kudita — Landing de reservas

Landing page inmersiva y editorial para **Cabaña Alpina Kudita**: una auténtica
cabaña A-Frame en madera Mara dentro del Puerto Santa Cruz Yacht Club, a 45
minutos del puente del Urubó (Santa Cruz de la Sierra, Bolivia).

Está construida como un embudo de conversión, no como un folleto:
deseo → prueba → decisión → acción.

> _Desconéctate, comparte y crea recuerdos._

## ✨ Qué incluye

- **Hero a pantalla completa** con foto nocturna real, parallax y barra de datos
  (capacidad, distancia, material) para responder la duda inicial sin scroll.
- **Storytelling** en tres bloques: la arquitectura A-Frame, el interior en
  madera Mara y la noche estrellada.
- **Espacios** — distribución real de la cabaña + 12 amenidades incluidas.
- **Experiencias** — parrilladas, piscina, hidromasaje, fogata, laguna
  navegable, pesque y pague y circuito 4x4.
- **Para quién es** — perfiles de huésped, para que el visitante se reconozca.
- **Galería** tipo Pinterest con lightbox, pies de foto y navegación por teclado.
- **Tarifas** reales por noche + bloque de eventos privados (hasta 20 personas).
- **Ubicación** con mapa embebido, tiempo de viaje y entorno del club.
- **Preguntas frecuentes** en acordeón, que resuelven objeciones antes del CTA.
- **CTA de WhatsApp con mensaje pre-cargado** en navbar, cada sección y botón
  flotante que aparece al pasar el hero.
- **SEO** — meta tags, Open Graph, Twitter Cards, JSON-LD (`LodgingBusiness` +
  `FAQPage`), HTML semántico y `alt` descriptivo en todas las imágenes.
- **Rendimiento** — dos tamaños por foto, lazy loading, `preload` del hero.
- **Responsive** total y respeto por `prefers-reduced-motion`.

## 🧱 Stack

- React 18 · Vite 5
- Tailwind CSS 3
- Framer Motion 11
- Lucide React · React Icons

## 🚀 Cómo ejecutar

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (por defecto `http://localhost:5173`).

Para compilar producción:

```bash
npm run build
npm run preview
```

## 📁 Estructura

```
public/
└── img/             # Fotos optimizadas: nombre.jpg (1920px) y nombre-sm.jpg (900px)
src/
├── components/      # Componentes reutilizables
│   └── ui/          # Button, SectionHeading, LazyImage, Reveal
├── hooks/           # useScrolled, useLockBodyScroll, useParallax
├── layout/          # Navbar, Footer
├── pages/           # Home (orquesta las secciones)
├── sections/        # Hero, Story, Amenities, Experiences, Guests,
│                    # Gallery, Pricing, Location, Faq, FinalCTA
└── utils/           # data.js (todo el contenido), animations.js, cn.js
```

## ✏️ Personalización

- **Contenido**: todo vive en [`src/utils/data.js`](src/utils/data.js) — textos,
  tarifas, amenidades, experiencias, galería, FAQ y contacto.
- **Colores y tipografía**: [`tailwind.config.js`](tailwind.config.js).
- **Movimiento**: variantes en [`src/utils/animations.js`](src/utils/animations.js).
- **Imágenes**: en `public/img/`. Cada foto tiene dos versiones y se referencian
  con los helpers `img('nombre')` y `imgSm('nombre')`.

## ⚠️ Pendientes antes de publicar

1. **Enlaces de reserva** — pega las URLs en el objeto `LINKS` de
   [`src/utils/data.js`](src/utils/data.js): Airbnb, Booking, Pitchup, Facebook
   e Instagram. Los canales sin URL simplemente no se muestran, así que no
   quedan botones rotos; en cuanto pegues el enlace aparecen solos en el CTA
   final y en el footer.
2. **Dominio** — reemplaza `cabanakudita.com` en [`index.html`](index.html)
   (canonical, `og:url` y `og:image`) por el dominio real. Las vistas previas de
   WhatsApp y Facebook necesitan URLs absolutas para mostrar la foto.
3. **Reseñas** — la landing no incluye testimonios inventados a propósito.
   Cuando tengas reseñas reales de Airbnb, se pueden añadir como sección de
   prueba social.

## 📞 Contacto de la marca

- WhatsApp: **76046495** · +591 76046495
- Email: **cesarpoma85@gmail.com**
- Ubicación: Puerto Santa Cruz Yacht Club, Santa Cruz de la Sierra — a 45 min
  del puente del Urubó
- Google Maps: https://maps.app.goo.gl/QFsqWTv1negBy8V78
