# Homecoming 80 Años — Maqueta de venta de boletas

Prototipo **solo frontend** para presentación al cliente. No hay backend, base de datos
ni conexión real a Wompi: todos los estados se simulan desde `src/data.ts`.

---

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:3000

Requiere Node 18.17 o superior.

---

## Qué se puede demostrar en vivo

| Momento | Qué mostrar |
|---|---|
| Hero | Contador regresivo real hacia la fecha del evento |
| El evento | Contadores animados y la franja de promociones (1964–2026) |
| Galería | Clic en cualquier foto → lightbox con flechas y tecla ESC |
| Boletas | Barras de cupos. **Mesa VIP aparece agotada** para mostrar el control de aforo |
| Compra | Flujo de 3 pasos: registro por asistente → pago → QR de confirmación |
| Validación | Deja campos vacíos y presiona Continuar: los marca en rojo |

El pago simula 2.2 segundos de procesamiento antes de emitir la orden.

---

## Dónde se edita el contenido

**Todo está en un solo archivo: `src/data.ts`.** Ningún componente tiene texto quemado.

| Quiero cambiar... | Objeto en `data.ts` |
|---|---|
| Nombre del colegio, fecha, lugar, aforo | `evento` |
| Textos de la sección "El evento" y las 3 cifras | `historia` |
| Artistas, géneros, horarios | `artistas` |
| Fotos de la galería | `galeria.fotos` |
| Precios, qué incluye cada boleta, cupos vendidos | `boletas` |
| Preguntas frecuentes | `faq` |
| Correo, teléfono, Instagram | `contacto` |
| Imágenes de hero, historia y logo | `imagenes` |

### Cambiar la fecha del contador

```ts
fechaISO: '2026-11-14T19:00:00-05:00',  // zona horaria de Colombia
```

### Marcar una boleta como agotada

Iguala `cuposVendidos` a `cuposTotales`. La tarjeta se atenúa y el botón se deshabilita solo.

### Cambiar cuál boleta sale destacada

`destacada: true` en la que corresponda (solo una).

---

## Reemplazar las fotos por las reales

Las imágenes actuales son fotos de Unsplash escogidas una por una para que coincidan
con lo que dice cada sección (orquesta, DJ, brindis, salón montado, pista de baile).
Son libres de uso. Para poner las del colegio:

1. Guarda los archivos en `public/images/`
2. Cambia la ruta en `src/data.ts`:

```ts
{ src: '/images/homecoming-2019-01.jpg', alt: 'Brindis de apertura', ratio: 'aspect-[4/5]' }
```

El filtro visual (desaturado parcial + tinte dorado) se aplica solo, así que fotos de
distintas cámaras se ven cohesivas entre sí.

**Recomendación para la reunión:** reemplaza mínimo 3 fotos de la galería por imágenes
reales del último Homecoming antes de presentar. El efecto sobre el comité es
desproporcionado — dejan de evaluar un producto genérico y empiezan a evaluar su evento.

---

## Sistema de movimiento

Todas las curvas y duraciones viven en `src/lib/motion.ts`. Una sola física para
todo el sitio: por eso el movimiento se lee como intencional y no como efectos sueltos.

| Pieza | Qué hace |
|---|---|
| `Preloader` | Cuenta 00→80 y abre un telón en dos hojas. Es el único momento maximalista |
| `SmoothScroll` | Lenis. Da inercia al scroll — de ahí hereda todo lo demás |
| `ScrollProgress` | Hilo dorado de avance, continúa el hilo del preloader |
| `RevealText` | Titulares que suben palabra por palabra desde una máscara |
| `Reveal` | Cortina que descubre fotos mientras bajan de escala |
| `Magnetic` | Botones que se inclinan hacia el cursor |
| Hero | Parallax de fondo, contenido que se desvanece al bajar, dígitos que rotan |
| Historia | Cinta infinita de promociones en dos direcciones (se pausa al pasar el cursor) |
| Artistas | Cada tarjeta se desplaza a distinta velocidad + barrido de luz en hover |
| Galería | Revelado escalonado, lightbox con deslizamiento direccional |
| Boletas | Entrada escalonada, elevación en hover, barras de cupo animadas |
| Checkout | Los pasos entran desde la dirección del avance |
| Navbar | Se oculta al bajar, reaparece al subir |

**Accesibilidad:** todo respeta `prefers-reduced-motion`. Con esa preferencia activa
el preloader no aparece, el scroll vuelve a nativo y las animaciones se desactivan.

**Para ajustar la intensidad:** cambia `dur` y `ease` en `src/lib/motion.ts`. Bajar
`dur.reveal` acelera todos los revelados a la vez.

---

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Framer Motion (movimiento)
- Lenis (scroll con inercia)
- Lucide React
- Playfair Display + Inter (`next/font`)

## Estructura

```
src/
├── data.ts              ← TODO el contenido editable
├── app/
│   ├── layout.tsx       fuentes y metadata
│   ├── page.tsx         orquesta las secciones y el estado del checkout
│   └── globals.css      tokens, utilidades, tratamiento de fotografía
├── lib/
│   └── motion.ts        curvas, duraciones y variantes compartidas
└── components/
    ├── Preloader.tsx    secuencia de carga
    ├── SmoothScroll.tsx Lenis
    ├── ScrollProgress.tsx
    ├── RevealText.tsx   titulares con máscara
    ├── Reveal.tsx       cortina para fotografía
    ├── Magnetic.tsx     botones magnéticos
    ├── Navbar.tsx
    ├── Hero.tsx         contador regresivo
    ├── Historia.tsx     stats animados + franja de promociones
    ├── Artistas.tsx
    ├── Galeria.tsx      masonry + lightbox
    ├── Boletas.tsx      cupos y selector de cantidad
    ├── Checkout.tsx     modal de 3 pasos
    ├── CodigoQR.tsx     QR visual determinístico (no codifica datos)
    ├── FAQ.tsx
    ├── Footer.tsx
    └── Photo.tsx        imagen con fallback y tratamiento
```

---

## Qué falta para producción

Esta maqueta cubre la experiencia. Al aprobarse, lo que se construye encima:

1. **Base de datos** (Supabase/Postgres) — órdenes, asistentes, cupos con bloqueo transaccional
2. **Integración Wompi** — creación de transacción, webhook de confirmación, firma de integridad
3. **QR firmado** — token único por asistente, verificable, de un solo uso
4. **Envío de correo** — boleta digital automática al confirmar el pago
5. **Panel de control** — cupos en vivo, exportación de asistentes, reporte de ventas
6. **App de ingreso** — escáner de QR con validación en tiempo real para la noche del evento

---

## Nota técnica

El componente `CodigoQR` genera un patrón visual determinístico, no un QR funcional.
En producción lo reemplaza un QR real firmado en el backend. Escanearlo ahora no
devuelve nada — es intencional, no es un error.
