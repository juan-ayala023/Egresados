# Backend — Homecoming 80 Años

Documento de entrega para quien construya el backend de la venta de boletas.

El frontend está terminado como maqueta: recorre la compra completa, valida el
formulario y muestra la confirmación con QR. **Todo lo que toca dinero, cupos o
datos está simulado en el navegador.** Este documento es el inventario de lo que
existe, el contrato que el servidor debe cumplir y las decisiones de negocio que
siguen abiertas.

Fuentes: el código de este repositorio y el acta de la reunión del comité
organizador del 4 de agosto de 2026.

| Dato | Valor |
|---|---|
| Evento | Sábado 14 de noviembre de 2026, 7:00 p.m. |
| Lugar | The Columbus School, Alto de las Palmas, Medellín |
| Aforo | 500 asistentes |
| Precio boleta | $80.000 COP |
| Tarifa de servicio | $6.634 COP (⚠️ ver decisión abierta #1) |
| Total por boleta | $86.634 COP |
| Máximo por comprador | 4 boletas |
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
| **Tarifa de servicio** | $6.634 COP | El front cobra 6.634. En la reunión se habló de ~2.634 de costo oculto. Confirmar cuál va. | ❓ DECIDIR |
| **Total por boleta** | $86.634 COP | Es la cifra que ve el usuario y la que debe llegarle a Wompi. | ✅ LISTO |
| **Máximo por comprador** | 4 boletas | La reunión pidió bloquear la cédula tras la compra: el límite es **acumulado por cédula**, no por transacción. | 🔨 FALTA |
| **Aforo** | 500 | La venta se cierra automáticamente al llegar a 500. | 🔨 FALTA |
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

Fecha, lugar, aforo y `estadoVenta`: `abierta` · `agotada` · `cerrada`. El front
lo usa para deshabilitar la compra sin recompilar el sitio.

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
| 423 | `VENTA_CERRADA` | Aforo lleno o fecha de cierre pasada |

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

Lo mínimo que el comité pidió poder hacer. No necesita ser bonito, pero sí tiene
que existir antes de que abra la venta.

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

## 9. Decisiones abiertas — leer antes de programar

Estas son las preguntas que el backend **no puede responder solo**. Las primeras
cuatro afectan el esquema de base de datos o el formulario, así que conviene
cerrarlas antes de escribir código.

| # | Pregunta abierta | Impacto |
|---|---|---|
| 1 | **¿La tarifa de servicio es $6.634 o $2.634?** El front cobra la primera; en la reunión se estimó la segunda como costo oculto por boleta. | Cambia el monto que se le cobra a 500 personas. Estefanía quedó de calcular el costo exacto. |
| 2 | **Falta el campo de dirección.** La facturación electrónica lo exige y el formulario actual no lo pide. | Hay que agregarlo al front y al modelo. Igual con ciudad. |
| 3 | **Falta la aceptación de tratamiento de datos.** Se acordó incluirla y no está en el formulario. | Checkbox obligatorio más registro con timestamp. Requisito legal. |
| 4 | **¿Cuántos datos se piden por acompañante?** La reunión exigió nombre y condición de egresado; el front pide además cédula, correo y celular de cada uno. | Pedir menos sube la conversión; pedir la cédula facilita el control en la puerta. Decisión del comité. |
| 5 | **¿Se muestran los cupos restantes?** Se pidió no mostrarlos por estrategia de escasez, pero la tarjeta de boletería los muestra con barra y porcentaje. | Define si el endpoint expone un número o solo un booleano. |
| 6 | **El límite de 4 es por cédula, acumulado.** Confirmar que se bloquea la cédula del comprador para siempre, no solo dentro de una compra. | Sin esto una persona compra 4, vuelve a entrar y compra 4 más. |
| 7 | **Política de reembolsos.** El FAQ del sitio promete 80% de reembolso hasta 15 días antes y transferencia de la boleta después. Ese texto fue redactado para la maqueta y nunca se validó. | Es una promesa pública con efecto legal. Debe confirmarla el colegio. |
| 8 | **Fecha de cierre de la venta.** El FAQ dice 7 de noviembre; tampoco está confirmado. | El backend necesita una fecha para cerrar automáticamente. |
| 9 | **Términos y condiciones.** No existe el texto ni la página. | Se aceptan en el mismo checkbox del punto 3. |
| 10 | **Subdominio definitivo.** Se habló de un subdominio institucional pero no se eligió cuál. | Define CORS, certificado, remitente de correo y el enlace que se difunde por WhatsApp. |
| 11 | **¿El backend se integra con el sistema contable o solo entrega el reporte?** Se acordó crear un servicio contable para asignar los ingresos al centro de costos. | Es la diferencia entre una integración y un CSV. Cambia el estimado de trabajo. |
| 12 | **¿Quién emite la factura electrónica?** ¿El backend contra un proveedor DIAN, o el colegio la genera desde su sistema con los datos exportados? | Si la emite el backend, hay que elegir proveedor y firmar el contrato antes de empezar. |

### Además, sin confirmar por el colegio en el contenido actual

No bloquean el backend, pero sí la publicación del sitio:

- Qué incluye exactamente la boleta (la lista de «coctel de bienvenida, estación
  de comida, parqueadero» viene del boceto).
- El código de vestuario.
- Dos de las tres cifras del bloque de historia.
- El WhatsApp de soporte: hoy `contacto.whatsapp` tiene un número de relleno
  (`573000000000`) marcado como PROVISIONAL en `src/data.ts`.
