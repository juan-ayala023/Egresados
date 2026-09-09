# Backend — Homecoming 80 Años

Documento de entrega para quien construya el backend de la venta de boletas.

El frontend está terminado como maqueta: recorre la compra completa, valida el
formulario y muestra la confirmación con QR. **Todo lo que toca dinero, cupos o
datos está simulado en el navegador.** Este documento es el inventario de lo que
existe, el contrato que el servidor debe cumplir y las decisiones de negocio que
siguen abiertas.

Fuentes: el código de este repositorio, el acta de la reunión del comité
organizador del 4 de agosto de 2026 y la **tabla de requerimientos del colegio**,
que es posterior y manda sobre las dos anteriores.

> **Actualizado con la tabla del colegio.** Lo que cambió respecto a la versión
> anterior de este documento: la tarifa de servicio la asume el colegio (el
> comprador paga $80.000 exactos), la venta abre sola el 15 de septiembre de
> 2026, para comprar hay que ser egresado, y se piden tipo y número de documento
> por persona. Las decisiones #1, #2, #3 y #6 quedaron cerradas; el aforo y la
> fecha de cierre siguen abiertos.

| Dato | Valor |
|---|---|
| Evento | Sábado 14 de noviembre de 2026, 7:00 p.m. |
| Lugar | The Columbus School, Alto de las Palmas, Medellín |
| Apertura de la venta | 15 de septiembre de 2026 (automática) |
| Aforo | 500 asistentes (cerrado por el comité) |
| Precio boleta | $80.000 COP |
| Tarifa de servicio | $0 — los ~$2.634 de costo financiero los asume el colegio |
| Total por boleta | $80.000 COP |
| Máximo por comprador | 4 boletas, acumuladas por cédula |
| Quién puede comprar | Solo egresados (se valida contra la base de mercadeo) |
| Pasarela | Wompi (Visa, Mastercard, PSE, Nequi, Bancolombia) |

**Convención de estado usada en todo el documento:**

- ✅ **LISTO** — el front ya lo resuelve, no hay que rehacerlo
- 🔨 **FALTA** — lo construye el backend
- ❓ **DECIDIR** — falta definición de negocio, no lo puede resolver el backend solo

---

## 1. Punto de partida

Aplicación **Next.js 14.2.5 (App Router) + React 18 + TypeScript**, una sola
página, 100% cliente. No hay API routes, ni base de datos, ni variables de
entorno, ni autenticación. El backend es un servicio aparte al que el front
llamará por HTTP.

| Pieza | Detalle |
|---|---|
| Framework | Next.js 14.2.5 · App Router · React 18.3 |
| Lenguaje | TypeScript 5.5 |
| Estilos | Tailwind 3.4 · tokens de color en `src/app/globals.css` |
| Animación | Framer Motion 11 · Lenis (scroll suave) |
| Iconos | lucide-react |
| Node mínimo | 18.17 |
| Correr local | `npm install` → `npm run dev` → `localhost:3000` |
| Repo | https://github.com/juan-ayala023/Egresados |

### Archivos que le importan al backend

| Archivo | Qué contiene |
|---|---|
| `src/data.ts` | Todo el contenido editable. Aquí viven `boletas` (precio, tarifa, cupos), `evento` (fecha, aforo) y los textos. Hoy es estático. |
| `src/components/Checkout.tsx` | El modal de 3 pasos. La función `pagar()` es el punto exacto donde entra la llamada real al servidor. |
| `src/components/Boletas.tsx` | Tarjeta de boletería, contador de cantidad y la constante `MAX_POR_COMPRA = 4`. |
| `src/components/CodigoQR.tsx` | QR decorativo. Se reemplaza por la imagen o el dato que devuelva el backend. |

### Recomendación de alcance

Que el backend sirva **solo lo transaccional**: precio, tarifa, disponibilidad,
estado de la venta y órdenes. El contenido editorial (artistas, galería, FAQ,
textos, imágenes) se queda en `src/data.ts` — no necesita CMS, y mantenerlo ahí
evita construir un admin de contenidos que nadie pidió.

### Acuerdos de infraestructura pendientes

- **URL base de la API** — el front la leerá de `NEXT_PUBLIC_API_URL`. Hay que definirla.
- **CORS** — el sitio vivirá en un subdominio institucional (pendiente de definir cuál). Ese origen debe estar en la lista blanca.
- **Dominio del remitente de correo** — SPF/DKIM configurados en el mismo dominio, o los correos con QR van a spam.

---

## 2. Qué es real y qué está simulado

La maqueta se ve completa de punta a punta, pero cinco cosas son teatro. Son
exactamente las que el backend tiene que volver reales.

| Comportamiento | Hoy | Estado |
|---|---|---|
| **Pago** | `setTimeout` de 2.200 ms en `Checkout.tsx`. Siempre aprueba. Wompi no está conectado. | 🔨 FALTA |
| **Número de orden** | Se genera en el navegador: `HC80-` + 6 dígitos aleatorios. No se guarda en ningún lado. | 🔨 FALTA |
| **Código QR** | SVG dibujado con un hash del número de orden. No codifica nada, no se puede escanear. | 🔨 FALTA |
| **Cupos vendidos** | `cuposVendidos: 158` escrito a mano en `data.ts`. La barra de progreso lo pinta. | 🔨 FALTA |
| **Descargar / reenviar boleta** | Botones visibles en el paso 3, sin ninguna función asociada. | 🔨 FALTA |
| **Formulario de asistentes** | Captura y valida nombre, cédula, celular, correo y promoción por cada persona. | ✅ LISTO |
| **Límite de 4 boletas** | El contador de la tarjeta no deja pasar de 4 *en esa compra*. No conoce compras anteriores. | ✅ LISTO |
| **Cálculo del total** | (precio + tarifa) × cantidad, con desglose visible antes de pagar. | ✅ LISTO |

### Validaciones que el front ya aplica

El backend debe repetirlas todas — nunca confiar en el cliente — pero estas son
las reglas exactas para que los mensajes de error coincidan:

| Campo | Regla |
|---|---|
| `nombre` | mínimo 5 caracteres |
| `cedula` | solo dígitos (se filtran al escribir), mínimo 6 |
| `correo` | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `celular` | mínimo 10 dígitos tras quitar todo lo que no sea número |
| `promocion` | obligatorio · año de grado entre 1948 y el año pasado, o el literal `no-egresado` |

---

## 3. Reglas de negocio

Consolidadas del acta de la reunión y contrastadas contra lo que el front
implementó. Donde las dos fuentes no coinciden queda marcado, porque el backend
no puede resolverlo solo.

| Regla | Valor | Nota | Estado |
|---|---|---|---|
| **Precio de la boleta** | $80.000 COP | Aprobado por la junta. Cubre solo el evento; comida y trago se pagan aparte. | ✅ LISTO |
| **Tarifa de servicio** | $0 | Los costos financieros (~$2.634/boleta) los asume el colegio. El comprador no los ve. | ✅ LISTO |
| **Total por boleta** | $80.000 COP | Es la cifra que ve el usuario y la que le llega a Wompi. | ✅ LISTO |
| **Apertura de la venta** | 15 sept 2026 | Automática. Antes de esa fecha `estadoVenta` es `proxima` y el checkout está deshabilitado. | ✅ LISTO |
| **Solo egresados** | Comprador | La tabla del colegio: "para poder avanzar con la compra DEBE ser egresado", con doble check por cédula o año de grado. Los acompañantes pueden no serlo. | ❓ DECIDIR (falta la base) |
| **Máximo por comprador** | 4 boletas | Confirmado por la tabla: "la cédula del comprador queda bloqueada para no comprar más". Es **acumulado por cédula**. | ✅ LISTO |
| **Aforo** | 500 | Sold Out automático al vender la última. La contradicción de la tabla del colegio (600 en una fila) quedó resuelta: son **500**. | ✅ LISTO |
| **Datos de facturación** | NIT/CC, nombre, dirección, teléfono, correo | Aprobados en la reunión con Estefanía. Exportables a contabilidad. | ✅ LISTO |
| **Cupos restantes visibles** | No | La reunión pidió no mostrarlos. El front hoy muestra «X de 500 disponibles» y un porcentaje. | ❓ DECIDIR |
| **Medios de pago** | Wompi | Visa, Mastercard y PSE. Sin efectivo. Pago directo a la cuenta del colegio. | 🔨 FALTA |
| **QR** | Uno por boleta | Individual, para que cada asistente entre por su cuenta sin depender del comprador. | 🔨 FALTA |
| **Datos de facturación** | Obligatorios | Nombre completo, cédula, dirección, correo y celular del comprador. Fecha de nacimiento opcional. | ❓ DECIDIR |
| **Datos de acompañantes** | Nombre + egresado | Mínimo exigido en la reunión. El front hoy pide además cédula, correo y celular de cada uno. | ❓ DECIDIR |
| **Tratamiento de datos** | Aceptación explícita | Debe quedar registrada. Hoy no existe el checkbox en el formulario. | 🔨 FALTA |

---

## 4. Modelo de datos mínimo

Estructura sugerida, derivada de lo que el formulario captura y de lo que el
reporte administrativo tiene que poder exportar. **La separación entre comprador
y asistente es lo importante:** el comprador es el responsable financiero, los
asistentes son quienes entran.

| Tabla | Campos clave | Por qué |
|---|---|---|
| **orden** | `id`, `referencia` (HC80-XXXXXX, única), `estado`, `cantidad`, `precio_unitario`, `tarifa_unitaria`, `total_centavos`, `metodo_pago`, `wompi_transaction_id`, `creada_en`, `expira_en`, `ip` | La referencia es la llave que viaja a Wompi y vuelve en el webhook. `expira_en` sostiene la reserva de cupo. |
| **comprador** | `orden_id`, `nombre`, `cedula`, `correo`, `celular`, `direccion`, `ciudad`, `promocion`, `acepta_datos`, `acepta_terminos`, `aceptado_en` | Facturación electrónica DIAN. Las aceptaciones con timestamp son la evidencia legal. |
| **asistente** | `id`, `orden_id`, `indice`, `nombre`, `cedula`, `promocion`, `es_egresado` | Uno por boleta. El índice 0 es siempre el titular de la compra. |
| **boleta** | `id` (ULID), `asistente_id`, `token_firmado`, `estado` (emitida/usada/anulada), `usada_en`, `usada_por`, `puerta` | Un registro por QR. El estado es lo que impide que un mismo código entre dos veces. |
| **reserva_cupo** | `orden_id`, `cantidad`, `expira_en` | Evita sobreventa mientras el usuario está en la pasarela. Se libera sola al vencer. |
| **webhook_wompi** | `event_id` (único), `payload_raw`, `recibido_en`, `procesado_en` | Idempotencia y auditoría. Wompi puede reenviar el mismo evento varias veces. |

### Estados de la orden

```
pendiente → pagada | rechazada | expirada | anulada
```

Solo `pagada` emite QR, descuenta aforo definitivamente y dispara el correo.
`pendiente` mantiene la reserva viva; al expirar libera los cupos.

---

## 5. Contrato de API

Propuesta concreta, abierta a cambios de nombre o forma. Lo que sí importa que
se respete: **el front necesita poder consultar el estado de una orden por su
referencia**, porque después del redirect de Wompi no tiene otra forma de saber
si el pago pasó.

### `GET /api/evento`

Fecha, lugar, aforo y `estadoVenta`: `proxima` · `abierta` · `agotada` ·
`cerrada`. El front lo usa para deshabilitar la compra sin recompilar el sitio.
Devuelve también `apertura` (para la cuenta regresiva), `maxPorCompra` y los
enlaces de la política de datos y los términos.

`proxima` es antes del 15 de septiembre; `agotada` es el Sold Out automático.

### `GET /api/boletas`

Precio, tarifa de servicio y disponibilidad del tipo de boleta. Si se acata la
petición de no revelar cupos, devuelve un booleano `disponible` y no un conteo.

### `POST /api/ordenes`

Crea la orden en estado `pendiente`, valida cupo y límite por cédula, reserva los
cupos y devuelve los datos firmados para abrir Wompi. Es el reemplazo directo de
la función `pagar()` del front.

**Request:**

```json
{
  "tipoBoletaId": "homecoming-80",
  "cantidad": 3,
  "comprador": {
    "nombre": "María Fernanda Restrepo Gómez",
    "cedula": "1020304050",
    "correo": "maria@correo.com",
    "celular": "3001234567",
    "direccion": "Cra 43A # 1-50 Apto 902",
    "ciudad": "Medellín",
    "promocion": "2004"
  },
  "asistentes": [
    { "nombre": "María Fernanda Restrepo Gómez", "cedula": "1020304050", "promocion": "2004" },
    { "nombre": "Andrés Felipe Ossa Vélez",      "cedula": "70123456",   "promocion": "2003" },
    { "nombre": "Laura Jiménez Arango",          "cedula": "43987654",   "promocion": "no-egresado" }
  ],
  "aceptaTratamientoDatos": true,
  "aceptaTerminos": true
}
```

**201 Created:**

```json
{
  "referencia": "HC80-4F9K2A",
  "totalCentavos": 25990200,
  "expiraEn": "2026-08-26T20:15:00-05:00",
  "wompi": {
    "publicKey": "pub_prod_xxx",
    "currency": "COP",
    "amountInCents": 25990200,
    "reference": "HC80-4F9K2A",
    "signatureIntegrity": "a4f2...",
    "redirectUrl": "https://.../pago/resultado"
  }
}
```

**Errores que el front tiene que saber pintar:**

| HTTP | Código | Qué le decimos al usuario |
|---|---|---|
| 409 | `CUPO_INSUFICIENTE` | Quedan menos boletas de las que pidió |
| 409 | `LIMITE_CEDULA` | Esa cédula ya compró su máximo de 4 boletas |
| 422 | `VALIDACION` | Campo por campo, para marcarlo en rojo como ya hace el front |
| 409 | `NO_ES_EGRESADO` | Esa cédula no está en la base de egresados del colegio |
| 423 | `VENTA_CERRADA` | La venta no ha abierto, el aforo está lleno o pasó la fecha de cierre |

### `GET /api/ordenes/:referencia`

Estado de la orden y, si está pagada, la lista de boletas con la URL de cada QR
y del PDF. El front hace polling contra esto al volver de Wompi hasta que el
estado deja de ser `pendiente`.

```json
{
  "referencia": "HC80-4F9K2A",
  "estado": "pagada",
  "pagadaEn": "2026-08-26T19:58:11-05:00",
  "correoEnviadoA": "maria@correo.com",
  "boletas": [
    {
      "id": "01J9XYZ...",
      "asistente": "María Fernanda Restrepo Gómez",
      "qrUrl": "https://.../qr/01J9XYZ.png",
      "pdfUrl": "https://.../boleta/01J9XYZ.pdf"
    }
  ]
}
```

### `POST /api/webhooks/wompi`

Receptor de eventos. Valida el `checksum`, es idempotente por `event.id` y es la
**única** fuente de verdad sobre si un pago se aprobó.

### `POST /api/ordenes/:referencia/reenviar`

Reenvía el correo con las boletas. Conecta el botón «Reenviar al correo» del
paso 3. Con rate limit — si no, es un vector de spam gratuito.

### `GET /api/boletas/:id/pdf`

Boleta descargable. Conecta el botón «Descargar boleta».

### `POST /api/puerta/validar`

Autenticado. Recibe el token del QR escaneado y responde:

| HTTP | Respuesta |
|---|---|
| 200 | `{"resultado":"VALIDA","asistente":"...","promocion":"2004"}` |
| 409 | `{"resultado":"YA_USADA","usadaEn":"...","puerta":"Ingreso 1"}` |
| 404 | `{"resultado":"INVALIDA"}` |

Marca la boleta como usada en la misma operación, de forma atómica.

### `GET /api/admin/ordenes.csv`

Autenticado. Reporte completo de compradores y acompañantes.

---

## 6. Flujo de pago con Wompi

El orden importa: cada paso depende del anterior y **el punto 6 es donde se
decide si hubo venta.** Todo lo que ocurra antes es reversible; todo lo que
ocurra después ya cuenta contra el aforo.

0. **La venta tiene que estar abierta** *(back)* — `GET /api/evento` devuelve
   `proxima` antes del 15 de septiembre de 2026 y el front no deja llegar al
   checkout. `POST /api/ordenes` lo vuelve a revisar, porque el front no es
   de fiar.

1. **El usuario completa el formulario** *(front)* — Tres pasos: datos de cada
   asistente, resumen con desglose de tarifa, y confirmación. El botón «Pagar»
   dispara `POST /api/ordenes`.

2. **El backend valida y reserva** *(back)* — Verifica cupo disponible, límite
   acumulado por cédula y que la venta esté abierta. Crea la orden `pendiente` y
   reserva los cupos con vencimiento (sugerido: 20 minutos).

3. **El backend firma la transacción** *(back)* — Firma de integridad:
   `SHA256(referencia + montoEnCentavos + "COP" + integrity_secret)`. El secreto
   nunca sale del servidor.

4. **El navegador abre el checkout de Wompi** *(front)* — Con `public-key`,
   `currency`, `amount-in-cents`, `reference`, `signature:integrity` y
   `redirect-url`. El usuario elige PSE, tarjeta, Nequi o botón Bancolombia
   dentro de Wompi.

5. **Wompi devuelve al usuario** *(front)* — Redirect a
   `/pago/resultado?id=<transaction_id>`. Esta pantalla **no** confirma nada:
   solo empieza a consultar el estado de la orden.

6. **Llega el webhook** *(back)* — Evento `transaction.updated`. Se valida el
   checksum `SHA256(properties + timestamp + events_secret)` y se descarta si el
   `event.id` ya se procesó. Estado `APPROVED` → orden pagada.

7. **Se emiten las boletas** *(back)* — Se consume la reserva, se genera un QR
   firmado por asistente, se registra la factura en el servicio contable del
   colegio y se envía el correo.

8. **El front muestra la confirmación** *(front)* — El polling detecta `pagada` y
   pinta el paso 3 con el QR real, el número de orden y los datos del asistente.
   Con `DECLINED`, `VOIDED` o `ERROR` se libera la reserva y se muestra el fallo.

### El webhook no es infalible: hay que preguntar

El punto 6 es el que decide si hubo venta, pero un webhook se puede perder —
servidor caído, despliegue en ese minuto, corte de red. Si nadie pregunta, esa
orden se queda `pendiente`, la reserva vence, y **alguien pagó y no tiene
boleta**. Nadie se entera hasta la puerta.

Por eso hay dos caminos más hacia el mismo sitio:

- **Reactivo** — Wompi devuelve al usuario a `/pago/resultado?id=<transacción>`.
  El front manda ese id a `POST /api/ordenes/:referencia/verificar` y el
  backend le pregunta a Wompi de una. Además guarda el id, que es lo que hace
  posible el camino siguiente.
- **Proactivo** — cada 5 minutos se revisan las órdenes pendientes de más de 10
  minutos y se pregunta por cada una.

Reglas que sostienen esto:

- `PENDING` **extiende la reserva**, no la deja vencer. PSE se demora con
  frecuencia más de 20 minutos; si el cupo se liberara mientras el usuario sigue
  en el banco, otro se lo lleva y cuando el pago entra hay sobreventa cobrada.
- Un fallo de red **nunca** rechaza un pago: la orden se deja quieta.
- Se verifica que la transacción consultada sea de esa orden, y el monto se
  revisa igual que en el webhook.

**Limitación de la API:** Wompi solo deja consultar por id de transacción; no
hay endpoint para buscar por nuestra referencia. Si nunca supimos el id (el
usuario cerró el navegador antes del redirect *y* el webhook se perdió) no hay a
quién preguntarle. Esas órdenes expiran por reloj con un `motivo_cierre`
distinto y una alerta en el log, para revisarlas a mano en el panel de Wompi.

### ⚠️ Tres cosas que rompen esto si se hacen mal

- **Los montos van siempre en centavos.** $86.634 COP es `8663400`, no `86634`.
- **La confirmación viene del webhook, nunca del redirect.** El usuario puede
  cerrar el navegador y el pago igual se aprueba.
- **El descuento de aforo tiene que ser atómico**, o dos compras simultáneas
  venden el mismo último cupo.

---

## 7. QR, correos y control en la puerta

### Qué lleva el QR

- **Nada de datos personales.** Un QR se fotografía y se comparte; no puede
  contener cédulas ni nombres.
- **Un identificador opaco y firmado.** Un ULID más HMAC, o un JWT corto. Debe
  ser imposible fabricar uno válido sin la llave del servidor.
- **Un QR por asistente**, como se pidió en la reunión, para que cada quien entre
  por su lado.
- **Un solo uso.** El primer escaneo marca la boleta como usada; el segundo
  devuelve 409 con la hora del primero.

### Correo de confirmación

Se dispara al confirmar el pago y va al correo del comprador. Debe incluir los N
códigos QR (imágenes embebidas, no adjuntos que el cliente de correo bloquee), el
número de orden, fecha, hora y lugar. Vale la pena adjuntar también el PDF por si
alguien quiere imprimirlo.

### Conectividad en la puerta

En la reunión se habló de un portátil y un escáner en el ingreso. **Si el wifi
del sitio falla esa noche, la validación en línea se cae con él.** Conviene que
la app de puerta descargue la lista de tokens válidos antes del evento y
sincronice los escaneos después, o al menos que degrade a un modo local en vez de
bloquear la fila.

---

## 8. Panel administrativo y reportes

Lo mínimo que el comité pidió poder hacer. **Ya existe**, en `/admin` del sitio
(protegido con `ADMIN_TOKEN`), y el control de ingreso en `/puerta` (con
`PUERTA_TOKEN`). No son bonitas a propósito: son herramientas internas para
cinco personas.

- **Exportar el reporte completo** — compradores con todos sus datos de
  facturación, acompañantes con nombre y condición de egresado, estado de pago,
  referencia y fecha. Formato CSV o Excel.
- **Ver el aforo en tiempo real** — vendidas, reservadas y disponibles, aunque el
  sitio público no lo muestre.
- **Buscar una orden** por cédula, correo o referencia, para atender a quien no
  recibió el correo.
- **Reenviar boletas** desde el panel.
- **Anular o reemitir** una boleta, para devoluciones y transferencias a otra
  persona.
- **Ver los ingresos escaneados** durante la noche del evento.

---

## 9. Decisiones — cerradas y abiertas

### Ya cerradas (no volver a discutirlas)

| # | Decisión | Cómo quedó |
|---|---|---|
| 1 | Tarifa de servicio | **$0.** Los ~$2.634 de costo financiero los asume el colegio. `BOLETA_TARIFA_COP=0`. El front oculta el desglose solo cuando la tarifa es 0. |
| 2 | Datos de facturación | **NIT/CC, nombre, dirección, teléfono, correo.** Aprobados con Estefanía. El tipo de documento se guarda en `comprador.tipo_documento`. |
| 3 | Tratamiento de datos | **Casilla obligatoria**, se guarda con timestamp. Falta solo el enlace a la política. |
| — | Aforo | **500.** La tabla del colegio decía 600 en una fila y 500 en otra; el comité cerró en 500. `EVENTO_AFORO=500`. |
| 6 | Límite por cédula | **Acumulado.** "La cédula del comprador queda bloqueada para no comprar más". `LIMITE_POR_CEDULA_ACUMULADO=true`. |
| — | Franquicias | **Sin AMEX ni DINERS.** No se puede bloquear desde el código: el Web Checkout muestra lo que el comercio tenga habilitado. Se pide a Wompi. El backend registra la franquicia y alerta si entra una bloqueada. |

### Bloqueantes: la venta no puede abrir sin esto

| # | Pendiente | De quién depende |
|---|---|---|
| 2 | **Base de datos de egresados.** Sin ella no se puede validar quién compra. Mientras tanto el sistema corre en modo `advertir`: marca pero deja pasar. | Mercadeo |
| 3 | **Enlace de la política de tratamiento de datos.** | Colegio |
| 4 | **Texto de los términos y condiciones.** | Mercadeo |
| 5 | **Llaves de Wompi** (Sandbox primero, producción después). | Colegio |
| 6 | **Deshabilitar AMEX y DINERS** a nivel de comercio. | Wompi + colegio |
| 7 | **Subdominio definitivo y certificado.** Define CORS, `PUBLIC_URL` y el remitente del correo. | TI del colegio |
| 8 | **SPF y DKIM** del dominio remitente, o los correos con QR se van a spam. | TI del colegio |
| 9 | **Fecha de cierre si no se agota.** El FAQ dice 7 de noviembre, sin confirmar. | Comité |
| 10 | **Política de reembolsos.** El FAQ promete 80% hasta 15 días antes; nunca se validó y es una promesa pública con efecto legal. | Colegio |

### Abiertas, no bloqueantes

| # | Pregunta | Impacto |
|---|---|---|
| 4 | **¿Cuántos datos por acompañante?** La tabla pide nombre, tipo y número de documento, y si es egresado. El front hoy pide además correo y celular. Configurable con `DATOS_ASISTENTE`; hoy en `acta`. | Pedir menos sube la conversión |
| 5 | **¿Se muestran los cupos restantes?** Se pidió no mostrarlos. `MOSTRAR_CUPOS_RESTANTES=false`. | El front todavía pinta la barra de progreso |
| 11 | **¿Integración con el sistema contable o solo reporte?** El colegio ya postea a **SIESA** en su plataforma de eventos (factura + recibo de caja por SOAP). Este backend no lo hace todavía. | Es la diferencia entre una integración y un CSV |
| 12 | **¿Quién emite la factura electrónica?** Si es SIESA, hay que conectarse como lo hace la plataforma existente. | Cambia el estimado de trabajo |

### Además, sin confirmar por el colegio en el contenido actual

No bloquean el backend, pero sí la publicación del sitio:

- Qué incluye exactamente la boleta (la lista de «coctel de bienvenida, estación
  de comida, parqueadero» viene del boceto).
- El código de vestuario.
- Dos de las tres cifras del bloque de historia.
- El WhatsApp de soporte: hoy `contacto.whatsapp` tiene un número de relleno
  (`573000000000`) marcado como PROVISIONAL en `src/data.ts`.
