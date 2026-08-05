/* ============================================================================
   ARCHIVO ÚNICO DE CONTENIDO EDITABLE
   Todo lo que el cliente puede querer cambiar vive aquí. Ningún componente
   tiene texto quemado. Cambia esto y cambia todo el sitio.
   ========================================================================== */

export const evento = {
  colegio: 'Colegio San Bartolomé',
  aniversario: 80,
  fundacion: 1946,
  titulo: 'Homecoming 80 Años',
  bajada: 'Reencuentro de Egresados',
  fechaTexto: 'Sábado 14 de noviembre de 2026',
  // Formato ISO para el contador regresivo
  fechaISO: '2026-11-14T19:00:00-05:00',
  horaTexto: '7:00 p.m. — 3:00 a.m.',
  lugar: 'Hacienda El Roble',
  ciudad: 'Medellín, Antioquia',
  cuposTotales: 500,
  codigoVestuario: 'Elegante de noche',
};

export const historia = {
  eyebrow: 'El reencuentro',
  titulo: 'Ochenta años caben en una sola noche',
  parrafos: [
    'Ocho décadas de promociones que salieron por la misma puerta. Médicos, músicos, ingenieros, madres, abuelos. Todos con la misma historia de fondo.',
    'El 14 de noviembre volvemos a estar en el mismo lugar. Sin uniformes, con las mismas conversaciones que quedaron a medias.',
  ],
  stats: [
    { valor: 80, sufijo: '', label: 'Años de historia' },
    { valor: 500, sufijo: '', label: 'Cupos disponibles' },
    { valor: 62, sufijo: '', label: 'Promociones convocadas' },
  ],
};

export const artistas = [
  {
    nombre: 'Orquesta La Bartolina',
    genero: 'Salsa y son',
    descripcion: 'Doce músicos en tarima. Abren la noche con el repertorio que sonaba en los bailes de los ochenta.',
    horario: '9:00 p.m.',
    imagen: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=700&h=875&fit=crop&q=80',
  },
  {
    nombre: 'Grupo Marea Alta',
    genero: 'Crossover en vivo',
    descripcion: 'Del vallenato al pop de los 2000. La banda que hace que nadie se quede sentado.',
    horario: '11:30 p.m.',
    imagen: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=700&h=875&fit=crop&q=80',
  },
  {
    nombre: 'DJ Camilo Restrepo',
    genero: 'Electrónica y clásicos',
    descripcion: 'Cierra hasta las 3:00 a.m. Egresado de la promoción 2004, de vuelta en casa.',
    horario: '1:00 a.m.',
    imagen: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=700&h=875&fit=crop&q=80',
  },
];

export const galeria = {
  eyebrow: 'Edición anterior',
  titulo: 'Así estuvo la última vez',
  nota: 'Homecoming 2019 · 340 asistentes',
  fotos: [
    { src: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&h=1000&fit=crop&q=80', alt: 'Brindis de apertura', ratio: 'aspect-[4/5]' },
    { src: 'https://images.unsplash.com/photo-1508997449629-303059a039c0?w=800&h=600&fit=crop&q=80', alt: 'Salón principal montado', ratio: 'aspect-[4/3]' },
    { src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&h=800&fit=crop&q=80', alt: 'Promoción reunida', ratio: 'aspect-square' },
    { src: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=1100&fit=crop&q=80', alt: 'Orquesta en tarima', ratio: 'aspect-[8/11]' },
    { src: 'https://images.unsplash.com/photo-1478147427282-58a87a120781?w=800&h=700&fit=crop&q=80', alt: 'Pista de baile', ratio: 'aspect-[8/7]' },
    { src: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=900&fit=crop&q=80', alt: 'Egresados en el jardín', ratio: 'aspect-[8/9]' },
    { src: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&h=650&fit=crop&q=80', alt: 'Barra y coctelería', ratio: 'aspect-[8/6.5]' },
    { src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=1000&fit=crop&q=80', alt: 'Detalle de las mesas', ratio: 'aspect-[4/5]' },
    { src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=750&fit=crop&q=80', alt: 'Cierre con confeti', ratio: 'aspect-[8/7.5]' },
    { src: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800&h=850&fit=crop&q=80', alt: 'Última hora de la noche', ratio: 'aspect-[8/8.5]' },
  ],
};

export type Boleta = {
  id: string;
  nombre: string;
  precio: number;
  personas: number;
  descripcion: string;
  incluye: string[];
  cuposTotales: number;
  cuposVendidos: number;
  destacada: boolean;
};

export const boletas: Boleta[] = [
  {
    id: 'general',
    nombre: 'General',
    precio: 180000,
    personas: 1,
    descripcion: 'Entrada individual al evento',
    incluye: [
      'Ingreso a la fiesta',
      'Coctel de bienvenida',
      'Estación de comida nocturna',
      'Parqueadero incluido',
    ],
    cuposTotales: 300,
    cuposVendidos: 158,
    destacada: false,
  },
  {
    id: 'preferencial',
    nombre: 'Preferencial',
    precio: 250000,
    personas: 1,
    descripcion: 'Entrada con mesa asignada',
    incluye: [
      'Todo lo de General',
      'Mesa asignada por promoción',
      'Barra abierta las primeras 2 horas',
      'Acceso a terraza privada',
      'Ingreso preferencial sin fila',
    ],
    cuposTotales: 150,
    cuposVendidos: 97,
    destacada: true,
  },
  {
    id: 'mesa-vip',
    nombre: 'Mesa VIP',
    precio: 1800000,
    personas: 8,
    descripcion: 'Mesa completa para 8 personas',
    incluye: [
      'Todo lo de Preferencial',
      'Mesa ubicada frente a tarima',
      'Barra abierta toda la noche',
      'Mesero asignado',
      'Botella de cortesía',
    ],
    cuposTotales: 12,
    cuposVendidos: 12,
    destacada: false,
  },
];

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
  comite: 'Comité Organizador Homecoming 80',
  correo: 'homecoming80@colegio.edu.co',
  telefono: '+57 300 000 0000',
  instagram: '@homecoming80',
};

export const imagenes = {
  hero: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1920&h=1080&fit=crop&q=80',
  historia: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1200&h=1500&fit=crop&q=80',
  logo: 'https://placehold.co/200x200/0A0A0F/D4AF37?text=80',
  fallback: 'https://placehold.co/800x600/12121A/D4AF37?text=Homecoming',
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
