// Datos reales de Cabaña Alpina Kudita.
// Centralizados aquí para mantener las secciones limpias y fáciles de mantener.
// Las fotos viven en /public/img — hay dos tamaños por imagen:
//   nombre.jpg      → 1920 px máx. (héroes, lightbox, fondos)
//   nombre-sm.jpg   → 900 px máx.  (tarjetas, galería, miniaturas)

import {
  Users,
  Waves,
  Bath,
  Flame,
  Beef,
  Umbrella,
  UtensilsCrossed,
  Tv,
  Wifi,
  Car,
  Trees,
  ShowerHead,
  Heart,
  PartyPopper,
  Briefcase,
  Camera,
  Sparkles,
  Anchor,
} from 'lucide-react'
import { FaWhatsapp, FaInstagram, FaFacebookF, FaAirbnb } from 'react-icons/fa'

// Helpers de rutas de imagen
export const img = (name) => `/img/${name}.jpg`
export const imgSm = (name) => `/img/${name}-sm.jpg`

// WhatsApp con mensaje pre-cargado — sube mucho la tasa de respuesta.
const WA_NUMBER = '59176046495'
export const wa = (msg = 'Hola, quiero consultar disponibilidad en Cabaña Alpina Kudita.') =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`

/* ────────────────────────────────────────────────────────────────
   ⚠️  COMPLETAR: pega aquí los enlaces cuando los tengas.
   Cada canal con enlace vacío ('') simplemente no se muestra en la
   web — no quedan botones rotos. En cuanto pegues la URL, aparece.
   ──────────────────────────────────────────────────────────────── */
export const LINKS = {
  airbnb: '',    // ej. 'https://www.airbnb.com/rooms/00000000'
  booking: '',   // ej. 'https://www.booking.com/hotel/bo/...'
  pitchup: '',   // ej. 'https://www.pitchup.com/campsites/...'
  facebook: '',  // ej. 'https://www.facebook.com/cabanakudita'
  instagram: '', // ej. 'https://www.instagram.com/cabanakudita'
}

export const BRAND = {
  name: 'Cabaña Alpina Kudita',
  short: 'Kudita',
  tagline: 'Desconéctate, comparte y crea recuerdos',
  location: 'Puerto Santa Cruz Yacht Club',
  city: 'Santa Cruz de la Sierra, Bolivia',
  distance: 'A 45 minutos del puente del Urubó',
  email: 'cesarpoma85@gmail.com',
  phone: '+591 76046495',
  whatsapp: '76046495',
  whatsappLink: wa(),
  maps: 'https://maps.app.goo.gl/QFsqWTv1negBy8V78',
  capacity: 'Hasta 8 huéspedes en camas · 20 personas para reuniones',
}

export const NAV_LINKS = [
  { label: 'La cabaña', href: '#la-cabana' },
  { label: 'Espacios', href: '#espacios' },
  { label: 'Experiencias', href: '#experiencias' },
  { label: 'Galería', href: '#galeria' },
  { label: 'Tarifas', href: '#tarifas' },
  { label: 'Ubicación', href: '#ubicacion' },
]

// Barra de confianza justo debajo del hero — respuestas rápidas a la duda inicial.
export const TRUST = [
  { value: '8', label: 'Huéspedes en camas' },
  { value: '20', label: 'Personas para eventos' },
  { value: '45 min', label: 'Del puente del Urubó' },
  { value: 'A-Frame', label: 'En madera Mara' },
]

// Bloques narrativos de pantalla completa — storytelling emocional
export const STORIES = [
  {
    id: 'arquitectura',
    kicker: 'Arquitectura alpina',
    title: 'Una A-Frame auténtica, poco común en Bolivia.',
    text: 'Kudita no es una cabaña más. Es una A-Frame de verdad, con su silueta triangular, su balcón elevado y una construcción íntegra en madera Mara — reconocida por su belleza, su calidad y su durabilidad. Se nota apenas te bajas del auto.',
    image: img('exterior-atardecer'),
    alt: 'Cabaña Alpina Kudita vista desde afuera al atardecer, con su estructura A-Frame de madera',
    align: 'left',
  },
  {
    id: 'interior',
    kicker: 'El interior',
    title: 'Madera noble, luz cálida y la laguna de fondo.',
    text: 'Adentro todo es madera: el piso, las paredes, el techo inclinado que sube hasta la punta. La sala se abre hacia el comedor y, al final, una ventana que devuelve la laguna al atardecer. Un espacio privado, cálido y acogedor para hasta 8 huéspedes.',
    image: img('sala-laguna-atardecer'),
    alt: 'Sala y comedor de madera dentro de la cabaña, con vista a la laguna al atardecer',
    align: 'right',
  },
  {
    id: 'noche',
    kicker: 'Cuando cae la noche',
    title: 'Cielo estrellado, fogata encendida y nadie más.',
    text: 'La cabaña se enciende, el fogatero se prende y el cielo se llena de estrellas. Sin ruido de ciudad, sin vecinos pegados. Sólo tu gente, el fuego y esa sensación de estar muy lejos — estando a 45 minutos de Santa Cruz.',
    image: img('exterior-noche'),
    alt: 'Cabaña Alpina Kudita iluminada de noche bajo un cielo estrellado',
    align: 'left',
  },
]

// Lo que hace única a Kudita — argumentos de venta directos
export const DIFFERENTIATORS = [
  'Arquitectura alpina A-Frame, poco común en Bolivia',
  'Construcción íntegra en madera Mara',
  'Laguna navegable, piscina y hidromasaje',
  'Fogatero y pérgola para reuniones',
  'Ambiente privado, cálido y acogedor',
  'Naturaleza y tranquilidad a minutos de la ciudad',
]

// Distribución real de la cabaña
export const LAYOUT = [
  { name: 'Habitación principal', note: 'Cama matrimonial y balcón propio' },
  { name: 'Segunda habitación', note: 'Camas adicionales' },
  { name: 'Colchones inflables', note: 'Disponibles para grupos grandes' },
  { name: 'Sala con TV Android', note: 'Streaming y descanso' },
  { name: 'Cocina equipada', note: 'Todo lo necesario para cocinar' },
  { name: 'Comedor', note: 'Mesa amplia para toda la mesa' },
  { name: 'Baño con agua caliente', note: 'Ducha y lavamanos' },
  { name: 'Garaje privado', note: 'Tu vehículo bajo techo' },
]

// Amenidades reales de la cabaña
export const AMENITIES = [
  { id: 'piscina', icon: Waves, name: 'Piscina', note: 'Para adultos y niños' },
  { id: 'hidromasaje', icon: Bath, name: 'Hidromasaje', note: 'Relájate bajo las estrellas' },
  { id: 'fogatero', icon: Flame, name: 'Fogatero', note: 'Noches alrededor del fuego' },
  { id: 'churrasquera', icon: Beef, name: 'Churrasquera', note: 'Parrilladas con los tuyos' },
  { id: 'pergola', icon: Umbrella, name: 'Pérgola', note: 'Sombra y reuniones al aire libre' },
  { id: 'cocina', icon: UtensilsCrossed, name: 'Cocina equipada', note: 'Completamente lista para usar' },
  { id: 'tv', icon: Tv, name: 'TV Android', note: 'Streaming en la sala' },
  { id: 'wifi', icon: Wifi, name: 'WiFi', note: 'Conectado si lo necesitas' },
  { id: 'garaje', icon: Car, name: 'Garaje privado', note: 'Estacionamiento seguro' },
  { id: 'bano', icon: ShowerHead, name: 'Agua caliente', note: 'Baño completo' },
  { id: 'verdes', icon: Trees, name: 'Áreas verdes', note: 'Jardín propio alrededor' },
  { id: 'capacidad', icon: Users, name: 'Hasta 20 personas', note: '8 en camas · 20 en reuniones' },
]

// Experiencias — cada una casi a pantalla completa
export const EXPERIENCES = [
  {
    id: 'parrillada',
    name: 'Parrilladas y churrasco',
    description:
      'Churrasquera lista, la carne al fuego y la mesa larga bajo la pérgola. El plan que nunca falla y que termina siendo el recuerdo del viaje.',
    image: imgSm('churrasco'),
    full: img('churrasco'),
    tag: 'Con los tuyos',
  },
  {
    id: 'piscina',
    name: 'Piscina para todos',
    description:
      'Piscina para adultos y otra para niños, con palapa y áreas verdes alrededor. Aquí el día se pasa solo.',
    image: imgSm('piscina-dia'),
    full: img('piscina-dia'),
    tag: 'Todo el día',
  },
  {
    id: 'hidromasaje',
    name: 'Hidromasaje al aire libre',
    description:
      'Agua caliente, burbujas y el cielo abierto encima. El cierre perfecto después de un día en la laguna.',
    image: imgSm('hidromasaje'),
    full: img('hidromasaje'),
    tag: 'Relax',
    // Foto vertical: anclamos al pie para que se vea el hidromasaje y no sólo el techo.
    position: 'object-[50%_88%]',
  },
  {
    id: 'fogata',
    name: 'Noches alrededor de la fogata',
    description:
      'Se enciende el fogatero, bajan las voces y aparecen las estrellas. Las mejores conversaciones pasan aquí.',
    image: imgSm('fogata'),
    full: img('fogata'),
    tag: 'Cada noche',
    // Igual que el hidromasaje: el fuego está abajo, no lo recortamos.
    position: 'object-[50%_88%]',
  },
  {
    id: 'laguna',
    name: 'Laguna navegable y bote a pedales',
    description:
      'Paseo en bote a pedales, jet ski o lancha propia — la laguna es navegable. Y al atardecer se pinta entera de naranja.',
    image: imgSm('laguna-atardecer-bote'),
    full: img('laguna-atardecer-bote'),
    tag: 'Naturaleza',
  },
  {
    id: 'pesca',
    name: 'Pesca en la laguna · circuito 4x4',
    description:
      'Pesca en la laguna, cuatrimotos y un circuito 4x4 dentro del complejo. Adrenalina y calma en el mismo lugar.',
    image: imgSm('cuatrimoto-pesca'),
    full: img('cuatrimoto-pesca'),
    tag: 'Aventura',
  },
]

// Tarifas por día. Datos oficiales.
export const PRICING = [
  {
    id: 'semana',
    label: 'Entre semana',
    detail: 'Lunes a jueves',
    price: '850',
    unit: 'Bs. / noche',
    featured: false,
  },
  {
    id: 'viernes',
    label: 'Viernes',
    detail: 'Arranca el fin de semana',
    price: '1.000',
    unit: 'Bs. / noche',
    featured: false,
  },
  {
    id: 'sabado',
    label: 'Sábados',
    detail: 'La fecha más pedida',
    price: '1.200',
    unit: 'Bs. / noche',
    featured: true,
  },
  {
    id: 'feriado',
    label: 'Feriados',
    detail: 'Y fechas especiales',
    price: '1.400',
    unit: 'Bs. / noche',
    featured: false,
  },
]

export const PRICING_NOTES = [
  'Cabaña completa para tu grupo — no se comparte con nadie',
  'Hasta 8 huéspedes en camas y hasta 20 personas para reuniones',
  'Acceso a piscina, hidromasaje, fogatero, pérgola y churrasquera',
  'Cocina equipada, WiFi, TV Android y garaje privado incluidos',
  'Colchones inflables disponibles para grupos grandes',
  'Feriados y fechas especiales sujetos a disponibilidad',
]

// Canales de reserva. Airbnb y WhatsApp son prioridad.
export const BOOKING_CHANNELS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    note: 'Respuesta directa y rápida',
    href: wa('Hola, quiero reservar Cabaña Alpina Kudita. ¿Qué fechas tienen disponibles?'),
    icon: FaWhatsapp,
    primary: true,
  },
  { id: 'airbnb', name: 'Airbnb', note: 'Reserva con garantía de la plataforma', href: LINKS.airbnb, icon: FaAirbnb },
  { id: 'facebook', name: 'Facebook', note: 'Fotos, videos y novedades', href: LINKS.facebook, icon: FaFacebookF },
  { id: 'instagram', name: 'Instagram', note: 'El día a día de la cabaña', href: LINKS.instagram, icon: FaInstagram },
  { id: 'booking', name: 'Booking', note: 'Disponibilidad en línea', href: LINKS.booking, icon: null },
  { id: 'pitchup', name: 'Pitchup', note: 'Para viajeros internacionales', href: LINKS.pitchup, icon: null },
]

// Galería — mosaico tipo Pinterest. `span` controla el alto en el masonry.
// 'tall' para fotos verticales, 'short' para horizontales: así se recorta lo mínimo.
export const GALLERY = [
  { id: 'g1', name: 'exterior-noche', alt: 'La cabaña A-Frame iluminada bajo un cielo estrellado', span: 'short' },
  { id: 'g2', name: 'habitacion-principal', alt: 'Habitación principal con cama matrimonial y ventana al balcón', span: 'tall' },
  { id: 'g3', name: 'sala-comedor', alt: 'Sala y comedor de madera con escalera al altillo', span: 'short' },
  { id: 'g4', name: 'piscina-atardecer', alt: 'Piscina al atardecer rodeada de árboles', span: 'short' },
  { id: 'g5', name: 'cocina', alt: 'Cocina completamente equipada en madera', span: 'tall' },
  { id: 'g6', name: 'fogata', alt: 'Fogatero encendido frente a la cabaña de noche', span: 'tall' },
  { id: 'g7', name: 'sala-laguna-atardecer', alt: 'Comedor interior con vista a la laguna al atardecer', span: 'short' },
  { id: 'g8', name: 'hidromasaje', alt: 'Hidromasaje al aire libre frente a la cabaña iluminada', span: 'tall' },
  { id: 'g9', name: 'laguna-atardecer-bote', alt: 'Laguna al atardecer con un bote y cancha de vóley de playa', span: 'short' },
  { id: 'g10', name: 'habitacion-dos', alt: 'Segunda habitación con camas adicionales bajo el techo a dos aguas', span: 'tall' },
  { id: 'g11', name: 'pergola', alt: 'Pérgola con mesa y sillas junto a la cabaña', span: 'tall' },
  { id: 'g12', name: 'exterior-atardecer', alt: 'La cabaña A-Frame y su deck a la hora dorada', span: 'short' },
  { id: 'g13', name: 'piscina-estrellas', alt: 'Piscina del club bajo un cielo estrellado', span: 'tall' },
  { id: 'g14', name: 'cabana-entre-arboles', alt: 'La cabaña vista a lo lejos entre los árboles', span: 'tall' },
]

// Para quién es Kudita — ayuda a que el visitante se reconozca y reserve.
export const GUESTS = [
  { id: 'familias', icon: Users, name: 'Familias', note: 'Piscina para niños, espacio de sobra y seguridad' },
  { id: 'parejas', icon: Heart, name: 'Parejas', note: 'Escapadas románticas con hidromasaje y fogata' },
  { id: 'amigos', icon: PartyPopper, name: 'Grupos de amigos', note: 'Parrillada, laguna y hasta 20 personas' },
  { id: 'ejecutivos', icon: Briefcase, name: 'Ejecutivos', note: 'Desconexión real a 45 minutos de la oficina' },
  { id: 'celebraciones', icon: Sparkles, name: 'Celebraciones privadas', note: 'Cumpleaños, aniversarios y retiros' },
  { id: 'creadores', icon: Camera, name: 'Fotografía y contenido', note: 'Amaneceres, atardeceres y una casa fotogénica' },
]

// Qué hay alrededor — refuerza el valor del entorno
export const SURROUNDINGS = [
  { icon: Anchor, name: 'Laguna navegable', note: 'Bote a pedales, jet ski o lancha' },
  { icon: Trees, name: 'Naturaleza y áreas verdes', note: 'Entorno abierto y arbolado' },
  { icon: Waves, name: 'Piscinas del club', note: 'Para adultos y para niños' },
  { icon: Users, name: 'Ambiente privado y seguro', note: 'Dentro del Puerto Santa Cruz Yacht Club' },
]

// Preguntas frecuentes — resuelven objeciones antes de que aparezcan
export const FAQ = [
  {
    q: '¿Cuántas personas entran en la cabaña?',
    a: 'Hasta 8 huéspedes en camas y hasta 20 personas para reuniones familiares o eventos privados. Tenemos colchones inflables disponibles para grupos grandes.',
  },
  {
    q: '¿Cómo llego desde Santa Cruz?',
    a: 'Estamos dentro del Puerto Santa Cruz Yacht Club, a 45 minutos del puente del Urubó. Te enviamos la ubicación exacta de Google Maps y las indicaciones de acceso al confirmar tu reserva.',
  },
  {
    q: '¿Qué está incluido en la tarifa?',
    a: 'La cabaña completa para tu grupo: piscina para adultos y niños, hidromasaje, fogatero, pérgola, churrasquera, cocina equipada, WiFi, TV Android, garaje privado y áreas verdes.',
  },
  {
    q: '¿Se pueden hacer eventos o celebraciones?',
    a: 'Sí. Es un espacio privado ideal para cumpleaños, aniversarios, reuniones familiares y pequeños retiros, hasta 20 personas. Escríbenos y coordinamos los detalles.',
  },
  {
    q: '¿Puedo llevar mi lancha o jet ski?',
    a: 'Sí. La laguna es navegable y puedes llegar con tu jet ski o lancha. También hay bote a pedales y pesca en la laguna, según disponibilidad.',
  },
  {
    q: '¿Cómo reservo?',
    a: 'Por Airbnb o por WhatsApp al 76046495 — son nuestros canales prioritarios. También estamos en Facebook, Instagram, Booking y Pitchup.',
  },
  {
    q: '¿Hay actividades para hacer en el lugar?',
    a: 'Parrilladas, noches de fogata, piscina, hidromasaje, pesca en la laguna, paseo en bote a pedales, cuatrimotos y un circuito 4x4 dentro del complejo.',
  },
  {
    q: '¿Tienen tarifas para feriados?',
    a: 'Sí, los feriados y fechas especiales tienen tarifa desde Bs. 1.400 y están sujetos a disponibilidad. Consúltanos con anticipación: son las fechas que más rápido se llenan.',
  },
]
