# Backend — Homecoming 80 Años

Implementación en **Node + Express + SQLite** de todo lo que pide
[BACKEND.md](BACKEND.md): venta de boletas, pago con Wompi, emisión de QR,
correo de confirmación, control en la puerta y panel administrativo.

No hay framework raro ni magia: JavaScript plano, una carpeta por
responsabilidad, y comentarios en el código explicando *por qué* está hecho así.

---

## Arrancar en 3 minutos

```bash
npm install
cp .env.example .env      # en PowerShell: copy .env.example .env
npm run dev
```

Queda en `http://localhost:4000`. Con la configuración por defecto arranca en
**modo simulación**: los pagos son de mentira y los correos se guardan como
archivos `.html` en `datos/correos/` en vez de enviarse. Se puede recorrer la
compra completa sin credenciales de Wompi ni servidor de correo.

```bash
npm test          # 30 pruebas: recorren la compra de punta a punta
npm run seed      # llena la base con órdenes de ejemplo para ver el panel
npm start         # producción

npm run generar-qr-secret              # llave para firmar los QR
npm run importar-egresados -- base.csv # base de egresados de mercadeo
npm run respaldo                       # copia verificada de la base
```

**En desarrollo pon `VENTA_APERTURA` en una fecha pasada.** Con la fecha real
(15 de septiembre de 2026) la venta está cerrada y el checkout no responde.

---

## Probar la compra completa desde la terminal

**1. Crear la orden** (esto es lo que hará `pagar()` en `Checkout.tsx`):

```bash
curl -X POST http://localhost:4000/api/ordenes \
  -H "Content-Type: application/json" \
  -d '{
    "tipoBoletaId": "homecoming-80",
    "cantidad": 2,
    "comprador": {
      "nombre": "Maria Fernanda Restrepo Gomez",
      "tipoDocumento": "CC",
      "cedula": "1020304050",
      "correo": "maria@correo.com",
      "celular": "3001234567",
      "direccion": "Cra 43A # 1-50 Apto 902",
      "ciudad": "Medellin",
      "promocion": "2004"
    },
    "asistentes": [
      {"nombre":"Maria Fernanda Restrepo Gomez","tipoDocumento":"CC","cedula":"1020304050","promocion":"2004"},
      {"nombre":"Andres Felipe Ossa Velez","tipoDocumento":"CC","cedula":"70123456","promocion":"2003"}
    ],
    "aceptaTratamientoDatos": true,
    "aceptaTerminos": true
  }'
```

Devuelve la referencia (`HC80-XXXXXX`), el total en centavos (**8000000** =
$80.000, sin tarifa) y el bloque `wompi` con la firma de integridad calculada
en el servidor.

**2. Simular que el pago se aprobó** (solo con `WOMPI_SIMULACION=true`):

```bash
curl -X POST http://localhost:4000/api/simulacion/pagar \
  -H "Content-Type: application/json" \
  -d '{"referencia":"HC80-XXXXXX","aprobar":true}'
```

**3. Consultar la orden** (esto es lo que hará el polling del front):

```bash
curl http://localhost:4000/api/ordenes/HC80-XXXXXX
```

Ya viene `"estado": "pagada"` con un QR y un PDF por asistente. El correo quedó
en `datos/correos/HC80-XXXXXX.html`: ábrelo en el navegador.

---

## Pruebas por dev tunnel (front y back en máquinas distintas)

Montaje actual para probar de verdad:

| Pieza | URL |
|---|---|
| Front | `https://s6zsm55b-3000.use2.devtunnels.ms` |
| Backend | `https://j43mdnh9-4000.use.devtunnels.ms` |

En el `.env` del backend eso se traduce en tres líneas:

```bash
PUBLIC_URL=https://j43mdnh9-4000.use.devtunnels.ms
CORS_ORIGINS=http://localhost:3000,https://s6zsm55b-3000.use2.devtunnels.ms
WOMPI_REDIRECT_URL=https://s6zsm55b-3000.use2.devtunnels.ms/pago/resultado
```

Y en el front, un `.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://j43mdnh9-4000.use.devtunnels.ms
```

Dos detalles que hacen que esto no se rompa cada vez que cambia un túnel:

- **`qrUrl` y `pdfUrl` se arman con el host por el que entró la petición**, no con
  una constante (ver `src/lib/urls.js`). El mismo backend le responde enlaces de
  `localhost` a quien entra por localhost y enlaces del túnel a quien entra por el
  túnel. `PUBLIC_URL` solo se usa para los correos, que se leen después y en otro
  dispositivo.
- **En desarrollo, CORS acepta cualquier `*.devtunnels.ms` y cualquier localhost**
  además de la lista blanca. Cuando el túnel cambia de URL no hay que reiniciar el
  backend. En producción esto no aplica: solo vale `CORS_ORIGINS`.

Lo único que sí toca actualizar a mano si cambia la URL del front es
`WOMPI_REDIRECT_URL`.

---

## Endpoints

### Públicos

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/evento` | Fecha, lugar, aforo y `estadoVenta` (`abierta`/`agotada`/`cerrada`) |
| `GET` | `/api/boletas` | Precio, tarifa de servicio y disponibilidad |
| `POST` | `/api/ordenes` | Crea la orden, reserva cupos y firma la transacción de Wompi |
| `GET` | `/api/ordenes/:referencia` | Estado de la orden; si está pagada, las boletas con sus URLs |
| `POST` | `/api/ordenes/:referencia/reenviar` | Botón «Reenviar al correo» (máx. 3 cada 15 min) |
| `GET` | `/api/boletas/:id/qr.png` | Imagen del QR — reemplaza `CodigoQR.tsx` |
| `GET` | `/api/boletas/:id/pdf` | Botón «Descargar boleta» |
| `POST` | `/api/webhooks/wompi` | Receptor de eventos de Wompi |
| `GET` | `/salud` | Chequeo de vida para el hosting |

| `POST` | `/api/ordenes/:referencia/verificar` | Reconciliación reactiva. El front la llama al volver del redirect de Wompi con `{"idTransaccion": "..."}`. Le pregunta a Wompi cómo quedó el pago y devuelve la orden ya actualizada. |

### Puerta — `Authorization: Bearer <PUERTA_TOKEN>`

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/api/puerta/validar` | Valida el QR y lo marca usado en la misma operación |
| `GET` | `/api/puerta/tokens` | Lista de tokens válidos para trabajar **sin conexión** |
| `POST` | `/api/puerta/sincronizar` | Sube los escaneos hechos sin conexión |
| `GET` | `/api/puerta/estado` | Cuántos han entrado |

### Admin — `Authorization: Bearer <ADMIN_TOKEN>`

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/admin/alertas` | **Lo que se rompió y necesita a alguien.** La primera que hay que mirar cada día |
| `GET` | `/api/admin/aforo` | Vendidas, reservadas, disponibles y sobreventa, en tiempo real |
| `GET` | `/api/admin/ordenes?buscar=` | Busca por cédula, correo, referencia o nombre |
| `GET` | `/api/admin/ordenes/:referencia` | Ficha completa de una orden |
| `GET` | `/api/admin/ordenes.csv?estado=pagada` | Reporte para el comité (se abre en Excel) |
| `POST` | `/api/admin/ordenes/:referencia/reenviar` | Reenviar boletas |
| `POST` | `/api/admin/ordenes/:referencia/anular` | Devolución: libera cupos y anula sus boletas |
| `POST` | `/api/admin/boletas/:id/anular` | Anular una sola boleta |
| `POST` | `/api/admin/boletas/:id/reemitir` | Transferir a otra persona (mata el QR anterior) |
| `GET` | `/api/admin/ingresos` | Quién ha entrado la noche del evento |
| `GET` | `/api/admin/configuracion` | Con qué tarifa y qué decisiones está corriendo |

### Errores que el front tiene que pintar

Todos llegan con la forma `{ "error": { "codigo": "...", "mensaje": "..." } }`.

| HTTP | Código | Extra |
|---|---|---|
| 409 | `CUPO_INSUFICIENTE` | — |
| 409 | `LIMITE_CEDULA` | `max`, `yaCompradas` |
| 422 | `VALIDACION` | `campos`: `{ "comprador.correo": "Escribe un correo válido.", ... }` |
| 423 | `VENTA_CERRADA` | — |
| 429 | `DEMASIADAS_PETICIONES` | `reintentarEn` (segundos) |

Las llaves de `campos` usan la misma ruta del formulario (`comprador.cedula`,
`asistentes.2.nombre`) para marcar el campo en rojo sin traducir nada.

---

## Conectar el front

**1.** En el front, `NEXT_PUBLIC_API_URL=http://localhost:4000`.

**2.** En `src/components/Checkout.tsx`, la función `pagar()` deja de ser un
`setTimeout` y queda así:

```ts
async function pagar() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ordenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipoBoletaId: 'homecoming-80',
      cantidad,
      comprador,
      asistentes,
      aceptaTratamientoDatos: true,   // hay que agregar el checkbox (decisión #3)
      aceptaTerminos: true,
    }),
  })

  const datos = await res.json()

  if (!res.ok) {
    // datos.error.codigo: CUPO_INSUFICIENTE | LIMITE_CEDULA | VALIDACION | VENTA_CERRADA
    if (datos.error.codigo === 'VALIDACION') marcarCamposEnRojo(datos.error.campos)
    else mostrarMensaje(datos.error.mensaje)
    return
  }

  // Abrir Wompi con los datos ya firmados por el servidor.
  // El front NO calcula la firma: solo copia lo que llegó en datos.wompi.
  abrirCheckoutDeWompi(datos.wompi)
}
```

**3.** La página `/pago/resultado` (a donde vuelve Wompi) hace polling —el
redirect **no** confirma nada:

```ts
const r = await fetch(`${API}/api/ordenes/${referencia}`)
const orden = await r.json()
if (orden.estado === 'pagada') mostrarPaso3(orden.boletas)  // qrUrl y pdfUrl listos
```

**4.** El paso 3 usa `boletas[i].qrUrl` como `<img src>` en vez de
`CodigoQR.tsx`, y `boletas[i].pdfUrl` en el botón «Descargar boleta».

**5.** «Reenviar al correo» llama a `POST /api/ordenes/:referencia/reenviar`.

**6.** Al cargar la página, `GET /api/evento` dice si hay que deshabilitar la
compra (`estadoVenta !== 'abierta'`).

---

## Cómo está organizado

```
src/
  config.js            Toda la configuración y las decisiones abiertas
  app.js               Arma Express (separado para poder probarlo)
  server.js            npm start: escucha, limpia reservas, apaga ordenado
  db/
    esquema.sql        Las 7 tablas del modelo de datos
    index.js           Conexión SQLite y transacciones IMMEDIATE
  lib/                 Piezas sin estado
    validaciones.js    Las mismas reglas del formulario del front
    wompi.js           Firma de integridad y checksum del webhook
    qr.js              Token firmado (ULID + HMAC) e imagen del QR
    pdf.js             Boleta descargable
    correo.js          Correo con los QR embebidos
    errores.js         Los códigos que el front sabe pintar
    referencia.js      HC80-XXXXXX
    fechas.js          ISO-8601 y formatos en español
  servicios/           Reglas de negocio
    aforo.js           Cupos, reservas y estado de la venta
    ordenes.js         Crear, confirmar y emitir boletas
    boletas.js         Puerta, anulación y reemisión
    reportes.js        Búsqueda, CSV y auditoría
  rutas/               Un archivo por grupo de endpoints
  middleware/          Auth, rate limit, manejo de errores
tests/api.test.js      Recorre la compra completa
scripts/seed.js        Datos de ejemplo
```

### Las tres cosas que el documento advertía que se rompen fácil

1. **Los montos van en centavos.** $86.634 COP es `8663400`. El precio se
   escribe en pesos una sola vez, en el `.env`, y `config.js` lo multiplica.
   Nada más en el código vuelve a hacer esa conversión.

2. **La confirmación viene del webhook, no del redirect.** Solo
   `confirmarPago()` marca una orden como pagada, y solo el webhook la llama. El
   webhook además compara el monto aprobado contra el de la orden: si no
   coincide, no emite boletas.

3. **El descuento de aforo es atómico.** Verificar cupo, verificar el límite por
   cédula, crear la orden y reservar los cupos pasan dentro de una sola
   transacción `BEGIN IMMEDIATE`. Dos compras simultáneas por el último cupo no
   pueden ganar las dos: la prueba `CUPO_INSUFICIENTE` lo verifica.

---

## Las 12 decisiones abiertas

Ninguna bloquea el código: todas quedaron como configuración con un valor por
defecto. Cambiarlas es editar el `.env` y reiniciar, salvo las que además
necesitan tocar el front.

| # | Decisión | Cómo quedó | Dónde se cambia |
|---|---|---|---|
| 1 | Tarifa $6.634 o $2.634 | **6.634** (lo que cobra el front hoy) | `BOLETA_TARIFA_COP` |
| 2 | Falta dirección de facturación | Se **exige**; el front todavía no la pide | `EXIGIR_DIRECCION_FACTURACION` |
| 3 | Aceptación de tratamiento de datos | **Obligatoria**, se guarda con timestamp | Ya implementado — falta el checkbox en el front |
| 4 | Cuántos datos por acompañante | **completo** (nombre, cédula, correo, celular) | `DATOS_ASISTENTE=minimo` |
| 5 | ¿Mostrar cupos restantes? | **No** se muestran | `MOSTRAR_CUPOS_RESTANTES` |
| 6 | Límite de 4 acumulado por cédula | **Sí**, acumulado | `LIMITE_POR_CEDULA_ACUMULADO` |
| 7 | Política de reembolsos | Sin implementar — hay `POST /api/admin/ordenes/:ref/anular`, que libera cupos pero **no devuelve la plata** | — |
| 8 | Fecha de cierre de la venta | **7 de noviembre de 2026** (lo que dice el FAQ) | `EVENTO_CIERRE_VENTA` |
| 9 | Términos y condiciones | Se aceptan en el mismo checkbox; **falta el texto** | — |
| 10 | Subdominio definitivo | `localhost:3000` | `CORS_ORIGINS`, `PUBLIC_URL` |
| 11 | ¿Integrar con contabilidad? | Solo **CSV**, sin integración | — |
| 12 | ¿Quién emite la factura DIAN? | El backend **no** la emite; guarda todos los datos y los exporta | — |

Las decisiones #1, #2, #3 y #4 son las que hay que cerrar antes de abrir la
venta: la #1 cambia lo que se le cobra a 500 personas y las otras tres exigen
tocar el formulario del front.

### Lo que le falta al front para conectarse

- Campos **dirección** y **ciudad** del comprador (decisión #2). Mientras
  tanto, `EXIGIR_DIRECCION_FACTURACION=false` deja pasar las compras sin ellos.
- Checkbox de **tratamiento de datos y términos** (decisiones #3 y #9). El
  backend lo exige: sin `aceptaTratamientoDatos: true` la compra falla con 422.

---

## Antes de abrir la venta

Checklist de producción. El servidor **se niega a arrancar** con
`NODE_ENV=production` si falta algo de esto:

- [ ] `WOMPI_SIMULACION=false`
- [ ] `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` reales
- [ ] `QR_SECRET` generado al azar:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] `ADMIN_TOKEN` y `PUERTA_TOKEN` propios
- [ ] `SMTP_HOST` configurado, con **SPF y DKIM** en el dominio del remitente
      (sin esto, los correos con QR se van a spam)
- [ ] `CORS_ORIGINS` y `PUBLIC_URL` con el subdominio institucional
- [ ] La URL del webhook registrada en el panel de Wompi:
      `https://<subdominio>/api/webhooks/wompi`
- [ ] `EVENTO_CIERRE_VENTA` confirmada por el colegio
- [ ] `BOLETA_TARIFA_COP` confirmada por el comité

### Respaldos

```bash
npm run respaldo                        # a datos/respaldos/
npm run respaldo -- --carpeta D:/copias # a otro lado
```

**No copies el archivo con `cp`.** Con WAL activado la base son tres archivos
(`.db`, `.db-wal`, `.db-shm`), y copiar solo el primero mientras el servidor
escribe deja un respaldo incompleto — peor que no tenerlo, porque uno cree que
está cubierto. El script usa la API de backup en línea de SQLite, que es segura
con el servidor corriendo.

Además **verifica** la copia: la abre y cuenta órdenes y boletas. Un archivo que
no se puede abrir no es un respaldo. Conserva los últimos 30 y borra los viejos.

Prográmalo a diario desde que abra la venta, y haz una copia extra el día antes
del evento. Para restaurar: apaga el servidor, reemplaza el archivo de
`DB_PATH`, y borra los `.db-wal` y `.db-shm` que hubiera al lado.

### La noche del evento

El wifi del sitio puede fallar. Descarga la lista de tokens **antes** de salir:

```bash
curl -H "Authorization: Bearer $PUERTA_TOKEN" \
  https://<subdominio>/api/puerta/tokens > boletas-validas.json
```

Con eso la app de puerta verifica las firmas sin conexión, y al terminar sube
los escaneos con `POST /api/puerta/sincronizar`. Los duplicados salen reportados
como `YA_USADA` en vez de colarse.

---

## Que el QR llegue: reintentos y alertas

El correo con los QR se manda fuera del ciclo de la petición, para no hacer
esperar a Wompi. Si fallaba, antes se perdía: quedaba un `console.error`, la
orden pagada y `correo_enviado_en` en NULL. Nadie se enteraba.

Ahora cada fallo se cuenta, se guarda el motivo y se reagenda:

| Intento | Espera |
|---|---|
| 1 | 1 min |
| 2 | 5 min |
| 3 | 15 min |
| 4 | 1 h |
| 5 | 4 h |

Al agotarlos, la orden aparece en `GET /api/admin/alertas` como **crítica**, con
el correo y el celular del comprador y el botón que hay que apretar. Un trabajo
de fondo revisa los pendientes cada minuto.

**El correo no es el único canal.** El comprador ve sus QR en pantalla en el
paso 3, porque `GET /api/ordenes/:referencia` devuelve las boletas con su
`qrUrl`. Esto es el respaldo.

### El panel de alertas

`GET /api/admin/alertas` junta todo lo que necesita un humano, ordenado por
gravedad y con la acción concreta al lado:

| Tipo | Nivel | Qué pasó |
|---|---|---|
| `CORREO_NO_ENVIADO` | crítico al agotar intentos | Pagó y no le llegaron las boletas |
| `EXPIRO_CON_TRANSACCION` | crítico | La orden venció y la pasarela nunca confirmó. Puede haber pagado |
| `PAGADA_SIN_BOLETAS` | crítico | Canario: no debería pasar nunca |
| `PAGADA_SIN_CUPO` | crítico | Entró un pago sin cupo (reservado para el Bloque 4) |
| `SOBREVENTA` | crítico | Hay más vendidas que el aforo |
| `FRANQUICIA_NO_ACEPTADA` | aviso | Entró un AMEX o DINERS. La boleta se emitió igual |

Sobre la sobreventa: `disponibles` se recorta en 0 para no mostrar negativos, y
eso **escondía** el problema. Ahora `disponibilidad()` reporta `sobreventa`
aparte, y se ve el mismo día en vez de en la puerta.

## Migraciones

`esquema.sql` es idempotente, así que crear tablas nuevas sale gratis. Lo que no
resuelve es agregar una columna a una tabla que ya existe en una base
desplegada. Para eso está [src/db/migraciones.js](src/db/migraciones.js): cada
migración corre una vez, queda anotada, y si falla el servidor no arranca.

Es deliberadamente mínimo. **Ojo con el límite de SQLite:** deja `ADD COLUMN`,
pero no cambiar un `CHECK` ni quitar una columna sin reconstruir la tabla. Por
eso el vocabulario de estados de `orden` se cerró antes de abrir la venta.

## Las dos pantallas internas

Viven en el front (mismo Next.js del sitio público), y se protegen con los
tokens del `.env` de este backend. Las dos van con `noindex`.

| Ruta | Token | Para qué |
|---|---|---|
| `/admin` | `ADMIN_TOKEN` | Aforo, alertas, buscar órdenes, reenviar, anular, CSV |
| `/puerta` | `PUERTA_TOKEN` | Escanear la noche del evento, **con modo sin conexión** |

`/puerta` está pensada para el portátil de la entrada con un escáner USB: el
escáner se comporta como un teclado, así que no hace falta cámara ni permisos.
La pantalla se pone verde, ámbar o roja de lado a lado — se lee a un metro y de
noche, que es la única lectura que importa con 200 personas en la fila.

**Antes del evento hay que apretar "Descargar lista"** con wifi. Si la red se
cae, la pantalla sigue validando contra esa lista y guarda los escaneos en cola;
cuando vuelva la conexión, el botón "Subir escaneos" los sincroniza y los
duplicados salen reportados como `YA_USADA` en vez de colarse.

Lo que no se puede hacer sin conexión es verificar la firma HMAC: eso exigiría
el `QR_SECRET` en el navegador, y un secreto en un portátil de la entrada es un
secreto perdido. Se compara contra la lista descargada, que alcanza.

## Reconciliación: qué pasa si el webhook se pierde

El webhook es la fuente principal, pero no es infalible: si el servidor está
caído, en pleno despliegue, o la red falla en ese minuto, el evento se pierde.
Sin nada más, esa orden se queda `pendiente`, la reserva vence, y **alguien pagó
y no tiene boleta**. Nadie se entera hasta la puerta.

Por eso hay dos caminos más, y los tres terminan en la misma función
(`aplicarPago()` en [src/servicios/pagos.js](src/servicios/pagos.js)):

| Camino | Cuándo | Qué hace |
|---|---|---|
| **Webhook** | Wompi lo manda solo | Valida el checksum, descarta duplicados, aplica |
| **Reactivo** | El usuario vuelve del redirect | El front manda el `?id=` a `/verificar`; se le pregunta a Wompi de una |
| **Proactivo** | Cada 5 minutos | Revisa las órdenes pendientes de más de 10 minutos y pregunta por cada una |

Detalles que importan:

- **`PENDING` extiende la reserva, no la deja vencer.** PSE se demora con
  frecuencia más de 20 minutos. Si el cupo se liberara mientras el usuario sigue
  en el banco, otro comprador se lo lleva y cuando el pago entra hay sobreventa
  cobrada.
- **Un problema de red nunca rechaza un pago.** Si Wompi no responde, la orden
  se deja quieta y el barrido vuelve en 5 minutos.
- **Se verifica que la transacción sea de esa orden.** Mandar el `id` de la
  compra de otro no sirve para que te emitan boletas.
- **El monto se revisa también aquí**, no solo en el webhook.

### La limitación que hay que conocer

La API de Wompi **solo deja consultar por id de transacción**. No existe un
endpoint para buscar por nuestra referencia — lo verifiqué contra la
documentación. Consecuencia: si nunca supimos el id (el usuario cerró el
navegador antes del redirect **y** el webhook se perdió), no hay a quién
preguntarle.

Esas órdenes se expiran por reloj, pero **no en silencio**: quedan con
`motivo_cierre` distinto y una línea en el log pidiendo revisarlas en el panel
de Wompi. Es el único caso que necesita un humano.

Por eso el camino reactivo importa tanto: es lo que captura el id para que el
barrido pueda trabajar después.

## Despliegue: UN SOLO PROCESO

Esto no es una preferencia, es un requisito del diseño:

- **`better-sqlite3` es un archivo, no un servidor.** Dos procesos escribiendo
  la misma base pelean por el candado de escritura. El aforo atómico (`BEGIN
  IMMEDIATE`) deja de garantizar nada si hay varias instancias.
- **Los límites de peticiones viven en memoria.** Con N procesos, el límite real
  es N veces el configurado, porque cada uno lleva su propia cuenta.
- **El job que libera reservas vencidas corre cada minuto por proceso.** Con
  varios, se pisan.

Entonces:

```bash
npm start                      # bien
pm2 start src/server.js        # bien (modo fork, una instancia)

pm2 start src/server.js -i 4   # MAL: cuatro procesos, sobreventa posible
pm2 start src/server.js -i max # MAL
```

Lo mismo aplica a cualquier hosting que escale a varias réplicas. Si algún día
hace falta escalar de verdad, primero hay que mover la base a Postgres o SQL
Server y los límites a Redis. Para 500 boletas no hace falta.

## Sobre SQLite

Se eligió porque no hay que instalar ni administrar nada, las transacciones son
suficientes para 500 boletas, y el respaldo es copiar un archivo.

El límite real: **un solo proceso escribiendo**. Si algún día el backend corre
en varias instancias detrás de un balanceador, hay que migrar a PostgreSQL. El
esquema (`src/db/esquema.sql`) es SQL estándar y el cambio se concentra en
`src/db/index.js`; el rate limit en memoria de `src/middleware/index.js` también
tendría que moverse a Redis.

Para este evento, un proceso sobra.
