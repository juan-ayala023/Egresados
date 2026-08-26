/* ============================================================================
   ARCHIVO ÚNICO DE CONTENIDO EDITABLE
   Todo lo que el cliente puede querer cambiar vive aquí. Ningún componente
   tiene texto quemado. Cambia esto y cambia todo el sitio.
   ========================================================================== */

export const evento = {
  colegio: 'The Columbus School',
  aniversario: 80,
  fundacion: 1947,
  titulo: 'Homecoming Party 80 Años',
  bajada: 'Reencuentro de Egresados',
  /* Texto del bloque principal, entregado por el colegio. */
  descripcion:
    'Ocho décadas transformando vidas. Una noche exclusiva para que todas las generaciones vuelvan a encontrarse, revivir historias y crear nuevos recuerdos.',
  urgencia: '¡Cupos limitados! No te quedes por fuera',
  /* Tal cual lo entregó el colegio:
       Rango:  1947 – 2027  (fundacion + aniversario, sale en el hero)
       Fecha:  sábado 14 de noviembre de 2026  — verificado, sí es sábado
       Hora:   7:00 p.m. */
  fechaTexto: 'Sábado 14 de noviembre de 2026',
  // Formato ISO para el contador regresivo
  fechaISO: '2026-11-14T19:00:00-05:00',
  horaTexto: '7:00 p.m.',
  lugar: 'The Columbus School',
  direccion: 'Alto de las Palmas',
  ciudad: 'Medellín, Antioquia',
  // PENDIENTE: el aforo real no lo confirmó el colegio. 500 viene del boceto.
  cuposTotales: 500,
  // PENDIENTE: no está en el documento. Ojo, las fotos de la edición
  // anterior son de una fiesta temática, no de gala.
  codigoVestuario: 'Elegante de noche',
};

export const historia = {
  eyebrow: 'El reencuentro',
  titulo: '80 Años: Para revivir, recordar y volver a conectar.',
  entrada: '¡El gran reencuentro de los 80 años ya está aquí!',
  parrafos: [
    'Durante 8 décadas, TCS ha sido el espacio donde aprendimos a liderar, a conectar e inspirar. Más que un colegio, dejamos en sus pasillos risas, triunfos, grandes amistades y momentos imborrables.',
    'Es momento de volver a reunirnos, abrazar los recuerdos, reencontrarnos con viejos amigos y celebrar el orgullo de ser egresados de The Columbus School.',
  ],
  cierre: '¡Asegura tu boleta, invita a tus compañeros y celebremos juntos este gran legado!',
  cta: 'Conoce más',
  /* PENDIENTE: solo la primera cifra está confirmada. Las otras dos vienen
     del boceto y nadie las ha validado. */
  stats: [
    { valor: 80, sufijo: '', label: 'Años de historia' },
    { valor: 500, sufijo: '', label: 'Cupos disponibles' },
    { valor: 62, sufijo: '', label: 'Promociones convocadas' },
  ],
};

export const artistas = [
  /* Orden cronológico: cada tarjeta muestra su hora, así que listarlas
     desordenadas se lee como un error. El documento las mostraba con Pipe
     Ángel primero, pero ahí decía 2:00 P.M. — confirmado que es 2:00 a.m.,
     así que cierra la noche. */
  {
    nombre: 'DJ Alex',
    genero: 'Clásicos, reggaetón y crossover',
    descripcion:
      'La mezcla perfecta de clásicos, reggaetón y los hits de todas las épocas para bailar hasta el final de la madrugada.',
    horario: '11:30 p.m.',
    imagen: '/images/artistas/dj-alex.jpg',
  },
  {
    nombre: 'Yo Me Llamo Jessi Uribe',
    genero: 'Música popular y despecho',
    descripcion:
      'Los grandes éxitos de la música popular y despecho interpretados con la voz y el sentimiento del show tributo número uno del país.',
    horario: '1:00 a.m.',
    imagen: '/images/artistas/yo-me-llamo-jessi-uribe.jpg',
  },
  {
    nombre: 'Banda Pipe Ángel',
    genero: 'Show en vivo',
    descripcion:
      'Un show cargado de energía y los mejores éxitos en vivo para encender la pista y poner a cantar a todas las promociones.',
    horario: '2:00 a.m.',
    imagen: '/images/artistas/banda-pipe-angel.jpg',
  },
];

export const galeria = {
  eyebrow: 'Edición anterior',
  titulo: 'Así estuvo la última vez',
  nota: 'Homecoming · The Columbus School',
  /* Fotos reales del colegio. Todas vienen de cámara en 3:2, así que las
     proporciones de abajo se mantienen cerca de esa relación: forzar
     verticales recortaría medio encuadre. El orden cuenta la noche:
     llegada, disfraces, público, montaje, tarima, pista, cierre. */
  fotos: [
    { src: '/images/galeria/homecoming_01.jpg', alt: 'Zona lounge bajo carpa antes de que arranque la noche', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_02.jpg', alt: 'Grupo de egresados posando con disfraces de los setenta', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_03.jpg', alt: 'Público con los brazos arriba entre confeti', ratio: 'aspect-[4/3]' },
    { src: '/images/galeria/homecoming_04.jpg', alt: 'Muro de fotografías históricas junto a las mesas montadas', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_05.jpg', alt: 'Banda en vivo sobre la tarima', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_06.jpg', alt: 'La pista llena vista desde el fondo del salón', ratio: 'aspect-[4/3]' },
    { src: '/images/galeria/homecoming_07.jpg', alt: 'Dos asistentes tomándose una foto en la terraza', ratio: 'aspect-square' },
    { src: '/images/galeria/homecoming_08.jpg', alt: 'Egresados bailando entre globos', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_09.jpg', alt: 'Plano general del salón en el punto más alto de la noche', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_10.jpg', alt: 'Concierto en tarima, edición de 2017', ratio: 'aspect-[4/3]' },
  ],
};

export type Boleta = {
  id: string;
  nombre: string;
  precio: number;
  /* Tarifa de servicio POR BOLETA. Se cobra junto con el precio, así que el
     usuario ve el total real antes de pagar y no se lleva sorpresas en la
     pasarela. Ponla en 0 y la fila desaparece sola del desglose. */
  tarifaServicio: number;
  personas: number;
  descripcion: string;
  incluye: string[];
  cuposTotales: number;
  cuposVendidos: number;
  destacada: boolean;
};

export const boletas: Boleta[] = [
  {
    id: 'homecoming-80',
    nombre: 'Boleta Homecoming 80 Años',
    precio: 80000,
    tarifaServicio: 6634,
    personas: 1,
    descripcion: 'Entrada individual al evento',
    /* PENDIENTE: el documento no dice qué incluye la boleta. Esta lista es
       la del boceto y no está validada por el colegio. */
    incluye: [
      'Ingreso a la fiesta',
      'Coctel de bienvenida',
      'Estación de comida nocturna',
      'Parqueadero incluido',
    ],
    cuposTotales: 500,
    cuposVendidos: 158,
    destacada: true,
  },
];

/* Precio final por boleta, tarifa incluida. Una sola función para que el
   desglose de la tarjeta y el total del checkout no se puedan desincronizar. */
export const totalPorBoleta = (b: Boleta) => b.precio + b.tarifaServicio;

export const metodosPago = [
  { id: 'pse', nombre: 'PSE', detalle: 'Débito desde tu banco' },
  { id: 'tarjeta', nombre: 'Tarjeta', detalle: 'Débito o crédito' },
  { id: 'nequi', nombre: 'Nequi', detalle: 'Pago desde la app' },
  { id: 'bancolombia', nombre: 'Bancolombia', detalle: 'Botón Bancolombia' },
];

export const faq = [
  {
    pregunta: '¿Puedo llevar acompañante si no es egresado?',
    respuesta:
      'Sí. Cada egresado puede comprar hasta 4 boletas. Solo pedimos que registres el nombre completo y la cédula de cada acompañante para el control de ingreso.',
  },
  {
    pregunta: '¿Cuál es el código de vestuario?',
    respuesta:
      'Elegante de noche. Vestido largo o corto para ellas, traje oscuro para ellos. La corbata es opcional.',
  },
  {
    pregunta: '¿Cómo recibo mi boleta?',
    respuesta:
      'Apenas se confirma el pago te llega un correo con tu boleta digital y un código QR único por persona. Ese QR se escanea en la entrada. No necesitas imprimir nada.',
  },
  {
    pregunta: '¿Hay reembolsos?',
    respuesta:
      'Aceptamos cancelaciones hasta 15 días antes del evento con reembolso del 80%. Después de esa fecha la boleta es transferible a otra persona escribiéndonos al correo del comité.',
  },
  {
    pregunta: '¿Hasta cuándo puedo comprar?',
    respuesta:
      'La venta cierra el 7 de noviembre o cuando se agoten los 500 cupos, lo que ocurra primero. En la edición anterior se agotó tres semanas antes.',
  },
];

export const contacto = {
  comite: 'Comité Organizador Homecoming 80 Años',
  /* Instagram y sitio salen del manual de marca. Correo y WhatsApp de soporte
     al comprador NO están en ningún documento entregado: quedan vacíos a
     propósito. El Footer oculta solo las filas vacías, así que nadie ve un
     dato de contacto inventado. */
  correo: '',
  telefono: '',
  instagram: '@thecolumbusschool',
  web: 'thecolumbus.school',
};

export const imagenes = {
  /* PROVISIONAL: recorte de una foto de la galería mientras llega la portada
     definitiva (2560x1440, sin texto ni logos quemados encima). */
  hero: '/images/portada/portada-desktop-provisional.jpg',
  historia: '/images/historia.jpg',
  /* Logo del evento, versión blanca sobre transparente. La horizontal va en
     el menú; la vertical en el pie. Las dos traen el lockup completo:
     80 Years · To Relive Remember · The Columbus School. */
  /* Lettering de egresados. Va sobre fondo CLARO: su azul es el 280C, que
     sobre el navy del sitio da 2.0:1 de contraste y se apaga. */
  fraseTiger: '/images/piezas/frase-tiger.png',
  logoHorizontal: '/images/logos/logo_horizontal.png',
  logoVertical: '/images/logos/logo_vertical.png',
  fallback: 'https://placehold.co/800x600/00203A/C88A12?text=Homecoming',
};

/* Años de graduación para el formulario: de la fundación al año pasado */
export const anosGraduacion = Array.from(
  { length: new Date().getFullYear() - evento.fundacion },
  (_, i) => new Date().getFullYear() - 1 - i
);

export const formatoCOP = (valor: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
