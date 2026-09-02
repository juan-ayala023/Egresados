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

  /* ---- Bloque principal (hero). Texto entregado por el colegio. ----
     El título dejó de nombrar el evento, así que el nombre se movió al
     eyebrow: si no, el visitante no sabe a qué llegó. */
  eyebrowHero: 'Homecoming 80 Años · The Columbus School',
  /* Una línea por renglón: el hero las anima por separado, con máscara. */
  tituloHero: ['Volver a donde', 'las mejores historias', 'comenzaron.'],
  descripcion:
    '80 años de legado, amistades inolvidables y momentos compartidos. Este es el reencuentro de la gran familia Columbus School. ¿Vas a dejar que te lo cuenten?',
  ctaPrincipal: 'Asegura tu lugar en el Reencuentro',
  /* Lleva a #artistas: es donde está "lo que vamos a ofrecer" (los shows y
     sus horarios), no a la sección de concepto. */
  ctaSecundario: 'Ver detalles de la noche',
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
  /* YA NO SE PINTA en ninguna parte: salió del pie al rediseñarlo y el dato
     de vestuario lo da la pregunta frecuente, que sí viene del colegio
     ("Estilo Coctel"). Este valor venía del boceto y nadie lo validó. Se
     conserva por si el colegio quiere volver a mostrarlo, pero NO lo uses
     sin confirmar cuál de los dos es el bueno. */
  codigoVestuario: 'Elegante de noche',
};

export const historia = {
  /* La bajada del lockup del logo: es la que pidió el colegio para esta
     sección, en vez de un título de sección genérico. */
  eyebrow: 'To relive · To remember',
  titulo: 'Ocho décadas construyendo la comunidad TCS.',
  /* Subtitular: es la línea destacada, en cuerpo más alto que el resto. */
  entrada:
    'El tiempo pasa, pero lo que viviste en las aulas y campos de TCS te acompaña para siempre.',
  parrafos: [
    'Caminar de nuevo por el campus, escuchar la música de tu época y abrazar a las personas con las que creciste. Cumplir 80 años no pasa todos los días: esta noche celebramos nuestro pasado, nuestro presente y la huella que cada promoción dejó en la historia del colegio.',
  ],
  cierre: '¡Asegura tu boleta, invita a tus compañeros y celebremos juntos este gran legado!',
  /* Dejó de ser "Conoce más": la sección ahora cierra con la compra, no con
     otra invitación a seguir leyendo. */
  cta: 'Asegura tu lugar en la celebración',
  /* Las cifras 80 / 62 salieron de esta sección por pedido del colegio. De
     paso resuelve el pendiente: la de 62 promociones venía del boceto y
     nadie la había validado. */
};

/* ---- SECCIÓN 3: la noche. Texto entregado por el colegio. ----
   Cada bloque nombra su icono con una llave; el componente la traduce a un
   icono de lucide. data.ts no importa componentes: es un archivo de texto y
   tiene que poder editarlo alguien que no programa. Los iconos son de línea
   sin relleno, que es lo único que autoriza el manual de marca. */
export const noche = {
  eyebrow: 'La noche de celebración',
  titulo: 'Una noche para volver, reencontrarnos y celebrar',
  intro:
    'Prepárate para una celebración pensada para disfrutar, recordar y crear nuevos momentos junto a quienes hicieron parte de tu historia.',
  /* Cada bloque lleva una `etiqueta`: la palabra corta que va en el distintivo
     de la esquina. Es lo que diferencia de un vistazo los cuatro cuadros
     cuando el visitante no se detiene a leer los textos. */
  bloques: [
    {
      icono: 'bar' as const,
      titulo: 'Bar Abierto & Coctelería',
      etiqueta: 'Premium',
      texto:
        'Cócteles y bebidas cuidadosamente seleccionados para brindar y celebrar durante toda la noche.',
    },
    {
      icono: 'gastronomia' as const,
      titulo: 'Gastronomía Gourmet',
      /* El proveedor es "Marmoleo", confirmado por el colegio. El boceto de
         diseño lo escribía "Marmolejo": esa grafía es la equivocada. */
      etiqueta: 'Marmoleo',
      texto:
        'Una propuesta gastronómica impecable para disfrutar con amigos, de la mano de Marmoleo.',
    },
    {
      icono: 'musica' as const,
      titulo: 'Música & Shows en Vivo',
      etiqueta: 'En tarima',
      texto:
        'Banda completa en vivo con Felipe Ángel, un show de Jessi Uribe de "Yo Me Llamo" y las mejores canciones para bailar sin parar a cargo de DJ ALEX.',
    },
    {
      icono: 'sorpresas' as const,
      titulo: 'Sorpresas & Reencuentro',
      etiqueta: 'TCS 80',
      texto:
        'Espacios para fotos, diferentes experiencias y momentos especiales para recordar tu paso por el colegio.',
    },
  ],
  /* Antesala de las tarimas y cierre de la sección */
  eyebrowTarima: 'En tarima · Shows en vivo',
  ctaPregunta: '¿Listo para vivir la noche del año?',
  cta: 'Asegura tu lugar en la celebración',
};

export const artistas = [
  /* El colegio pidió dejar SOLO los nombres en las tarjetas: se quitaron el
     género y la descripción. `horario` sí se conserva aunque hoy no se pinte,
     porque es lo que justifica este orden: la noche va en orden cronológico y
     sin el dato nadie sabría por qué DJ Alex va primero. (El documento traía
     a Felipe Ángel de primero con "2:00 P.M." — confirmado que es 2:00 a.m.,
     así que cierra.) */
  {
    nombre: 'DJ Alex',
    etiqueta: 'Crossover',
    horario: '11:30 p.m.',
    imagen: '/images/artistas/dj-alex.jpg',
  },
  {
    nombre: 'Yo Me Llamo Jessi Uribe',
    etiqueta: 'Show especial',
    horario: '1:00 a.m.',
    imagen: '/images/artistas/yo-me-llamo-jessi-uribe.jpg',
  },
  {
    nombre: 'Banda Felipe Ángel',
    etiqueta: 'Banda completa',
    horario: '2:00 a.m.',
    imagen: '/images/artistas/felipe-angel-banda.jpg',
  },
];

export const galeria = {
  eyebrow: 'Recuerdos del Homecoming',
  titulo: 'Así se vive la experiencia Columbus',
  subtitulo:
    'Grandes momentos, risas e historias que se repiten en cada edición. Este año, la foto no está completa sin ti.',
  /* El cierre de la galería es pregunta + botón, en una línea: la pregunta
     es la que empuja, el botón solo dice qué pasa al hacer clic. */
  ctaPregunta: '¿Listo para reencontrarte?',
  cta: 'Quiero estar en la foto de este año',
  /* Pie del carrusel: sin esto nadie descubre que hay más fotos a la
     derecha, porque en escritorio no hay barra de desplazamiento. */
  pistaCarrusel: 'Desliza para ver más recuerdos de ediciones anteriores',
  /* Fotos reales del colegio. Todas vienen de cámara en 3:2, así que las
     proporciones de abajo se mantienen cerca de esa relación: forzar
     verticales recortaría medio encuadre. El orden cuenta la noche:
     llegada, disfraces, público, montaje, tarima, pista, cierre.

     La PRIMERA es la destacada: ocupa el doble de alto y de ancho en la
     retícula, así que conviene que sea la de más escala. */
  fotos: [
    { src: '/images/galeria/homecoming_09.jpg', alt: 'Plano general del salón en el punto más alto de la noche', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_02.jpg', alt: 'Grupo de egresados posando con disfraces de los setenta', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_03.jpg', alt: 'Público con los brazos arriba entre confeti', ratio: 'aspect-[4/3]' },
    { src: '/images/galeria/homecoming_04.jpg', alt: 'Muro de fotografías históricas junto a las mesas montadas', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_05.jpg', alt: 'Banda en vivo sobre la tarima', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_06.jpg', alt: 'La pista llena vista desde el fondo del salón', ratio: 'aspect-[4/3]' },
    { src: '/images/galeria/homecoming_07.jpg', alt: 'Dos asistentes tomándose una foto en la terraza', ratio: 'aspect-square' },
    { src: '/images/galeria/homecoming_08.jpg', alt: 'Egresados bailando entre globos', ratio: 'aspect-[3/2]' },
    { src: '/images/galeria/homecoming_01.jpg', alt: 'Zona lounge bajo carpa antes de que arranque la noche', ratio: 'aspect-[3/2]' },
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
  destacada: boolean;
};

/* Encabezado de la sección de boletería. Estaba quemado en el componente,
   contra la regla de este archivo: todo lo que el cliente puede querer
   cambiar vive aquí. */
export const boleteria = {
  eyebrow: 'Boletería oficial',
  titulo: 'Asegura tu lugar en la Celebración de los 80 Años',
  /* {max} lo reemplaza el componente con el tope por compra que manda el
     backend, que es quien manda sobre ese número. */
  nota: 'Máximo {max} boletas por compra. Registro personal con nombre y cédula para garantizar un acceso ágil el día del evento.',
};

export const boletas: Boleta[] = [
  {
    id: 'homecoming-80',
    nombre: 'Pase Individual Homecoming 80 Años',
    precio: 80000,
    /* El comprador paga la tarifa de servicio: $80.000 + $6.634 = $86.634.
       (Antes iba en 0 porque el acta del comite decia que el colegio asumia
       los costos financieros; se cambio por pedido del colegio.)
       Este valor es solo el respaldo que se pinta mientras responde la API; si
       no coincide con BOLETA_TARIFA_COP del backend, el usuario ve un precio
       y despues otro. */
    tarifaServicio: 6634,
    personas: 1,
    descripcion: 'Experiencia completa de reencuentro y celebración',
    /* Lista validada por el colegio. Se cayeron a propósito el coctel de
       bienvenida y la estación de comida nocturna, que venían del boceto:
       la boleta no promete consumo. */
    incluye: [
      'Acceso exclusivo a la Gran Fiesta Homecoming 80 Años',
      'Música en vivo & DJ Set (Hits generacionales de tus años escolares)',
      'Parqueadero interno en el campus incluido',
    ],
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

/* Preguntas entregadas por el colegio, agrupadas tal como las mandó.
   Reemplazan por completo la lista del boceto. Traen dos cambios de fondo,
   no de redacción:
     · Las boletas ya NO son reembolsables. Antes se ofrecía 80% hasta 15
       días antes del evento.
     · La respuesta de vestuario dice "Estilo Coctel". Era la contradicción
       con "Elegante de noche" del pie; se resolvió sola al rediseñar el pie,
       que ya no pinta evento.codigoVestuario. Esta respuesta es ahora la
       única fuente de vestuario del sitio. */
/* Cada categoría nombra su icono con una llave, igual que los bloques de la
   noche: data.ts no importa componentes. Son iconos de línea, no emoji: el
   manual de marca no autoriza pictogramas de relleno. */
export const faq = [
  {
    categoria: 'Alimentos y Bebidas',
    icono: 'bebidas' as const,
    preguntas: [
      {
        pregunta: '¿Habrá venta de comida y bebidas durante el evento?',
        respuesta:
          '¡Sí! Para tu comodidad, contaremos con una variada oferta gastronómica y barras de licores preparadas especialmente para la noche. Por logística y seguridad del campus, no estará permitido el ingreso de alimentos o bebidas externos.',
      },
      {
        pregunta: '¿Qué métodos de pago se aceptarán en el evento?',
        respuesta:
          'Aceptaremos tarjetas de crédito, débito y transferencias electrónicas. Te recomendamos contar con métodos de pago digitales para mayor agilidad al comprar tus consumos.',
      },
    ],
  },
  {
    categoria: 'Boletas y Registro',
    icono: 'boletas' as const,
    preguntas: [
      {
        pregunta: '¿Quiénes pueden asistir al evento?',
        respuesta:
          'El evento es exclusivo para la comunidad de egresados de The Columbus School.',
      },
      {
        pregunta: '¿Qué incluye el valor de mi boleta?',
        respuesta:
          'Tu entrada incluye el acceso general a la fiesta, parqueadero en el campus, shows y la presentación de la orquesta en vivo para celebrar nuestros 80 años.',
      },
      {
        pregunta: '¿Puedo comprar la boleta en la entrada el día del evento?',
        respuesta:
          'No. Para garantizar la seguridad y la logística del aforo, las boletas se venden exclusivamente de forma anticipada a través de esta plataforma digital.',
      },
      {
        pregunta: '¿Puedo transferir mi boleta si no puedo asistir?',
        respuesta:
          'Las boletas no son reembolsables. Sin embargo, si necesitas transferir tu entrada a otro egresado, puedes contactar al equipo de soporte oficial con anticipación para actualizar los datos de ingreso.',
      },
    ],
  },
  {
    categoria: 'Logística y Acceso',
    icono: 'acceso' as const,
    preguntas: [
      {
        pregunta: '¿Cuál es el código de vestimenta (Dress Code)?',
        respuesta: 'Estilo Coctel. ¡Ven cómodo y listo para bailar toda la noche!',
      },
      {
        pregunta: '¿Qué debo presentar en la entrada para ingresar?',
        respuesta:
          'Debes presentar tu cédula de ciudadanía (o documento de identidad oficial) junto con el código QR de tu boleta digital.',
      },
    ],
  },
];

/* ---- Cierre del sitio (pie). Texto entregado por el colegio. ---- */
export const cierre = {
  titulo: 'Hay lugares a los que siempre vale la pena regresar.',
  subtitulo:
    'No dejes que te lo cuenten por fotos. Vuelve a vivir la experiencia The Columbus School.',
  cta: 'Comprar mi boleta ahora',
};

export const contacto = {
  comite: 'Comité Organizador Homecoming 80 Años',
  /* Instagram y sitio salen del manual de marca. Correo y WhatsApp de soporte
     al comprador NO están en ningún documento entregado: quedan vacíos a
     propósito. El Footer oculta solo las filas vacías, así que nadie ve un
     dato de contacto inventado. */
  correo: '',
  telefono: '',
  /* WhatsApp del botón flotante. Formato internacional, solo dígitos, con
     indicativo y sin el '+': para Colombia es 57 + el celular.
     Vacío = el botón no se pinta.

     PROVISIONAL: número de relleno para poder ver el botón mientras el comité
     define el WhatsApp de soporte. Es una secuencia de ceros a propósito, no
     un celular real: WhatsApp responde "número no válido" en vez de abrirle
     el chat a un desconocido. REEMPLAZAR antes de publicar. */
  whatsapp: '573000000000',
  instagram: '@thecolumbusschool',
  web: 'thecolumbus.school',
};

export const imagenes = {
  /* PROVISIONAL: recorte de una foto de la galería mientras llega la portada
     definitiva (2560x1440, sin texto ni logos quemados encima). */
  hero: '/images/portada/portada-desktop-provisional.jpg',
  /* La foto de la sección de historia sale de la galería: es la misma
     imagen del público con los brazos arriba. El marco de esa sección es
     4/5 (vertical) y esta es 3/2, así que se recorta por los lados. */
  historia: '/images/galeria/homecoming_03.jpg',
  /* Logo del evento, versión blanca sobre transparente. La horizontal va en
     el menú; la vertical en el pie. Las dos traen el lockup completo:
     80 Years · To Relive Remember · The Columbus School. */
  /* Lettering de egresados. Va sobre fondo CLARO: su azul es el 280C, que
     sobre el navy del sitio da 2.0:1 de contraste y se apaga. */
  fraseTiger: '/images/piezas/frase-tiger.png',
  /* Sello del evento en forma de boleta (TCS · Homecoming Party). Trae el
     nombre quemado, así que sirve de sello y no de portada. La blanca es la
     que sobrevive sobre la foto oscura del hero; la dorada queda para
     fondos claros. */
  selloBlanco: '/images/piezas/sello-tcs-blanco.png',
  selloDorado: '/images/piezas/sello-tcs-dorado.png',
  logoHorizontal: '/images/logos/logo_horizontal.png',
  logoVertical: '/images/logos/logo_vertical.png',
  fallback: 'https://placehold.co/800x600/002E5C/C88A12?text=Homecoming',
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
