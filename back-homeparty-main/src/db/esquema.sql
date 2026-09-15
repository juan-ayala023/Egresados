-- -----------------------------------------------------------------------------
-- Esquema completo. Sigue el modelo de datos del BACKEND.md, seccion 4.
-- Todos los montos estan en CENTAVOS. Todas las fechas en texto ISO-8601 UTC.
-- -----------------------------------------------------------------------------

-- La orden es el centro de todo. Su "referencia" (HC80-XXXXXX) es la llave que
-- viaja a Wompi y vuelve en el webhook.
CREATE TABLE IF NOT EXISTS orden (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  referencia                TEXT    NOT NULL UNIQUE,
  estado                    TEXT    NOT NULL
    CHECK (estado IN ('pendiente','pagada','pagada_sin_cupo','rechazada','expirada','anulada')),
  tipo_boleta_id            TEXT    NOT NULL,
  cantidad                  INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario_centavos  INTEGER NOT NULL,
  tarifa_unitaria_centavos  INTEGER NOT NULL,
  total_centavos            INTEGER NOT NULL,
  metodo_pago               TEXT,             -- CARD | PSE | NEQUI | BANCOLOMBIA_TRANSFER
  franquicia                TEXT,             -- VISA | MASTERCARD | AMEX... solo en tarjeta
  ultimos_cuatro            TEXT,             -- de la tarjeta; SIESA lo exige en el recibo
  autorizacion_banco        TEXT,             -- codigo de aprobacion del banco (Wompi external_identifier)
  wompi_transaction_id      TEXT,
  creada_en                 TEXT    NOT NULL,
  expira_en                 TEXT    NOT NULL,
  pagada_en                 TEXT,
  cerrada_en                TEXT,             -- cuando paso a rechazada/expirada/anulada
  motivo_cierre             TEXT,
  correo_enviado_a          TEXT,
  correo_enviado_en         TEXT,          -- NULL = todavia no ha salido
  correo_intentos           INTEGER NOT NULL DEFAULT 0,
  correo_ultimo_error       TEXT,
  correo_proximo_intento    TEXT,          -- cuando reintentar (espera creciente)
  -- El pago entro despues de que la reserva vencio (ver BACKEND.md seccion 6).
  pagada_tarde              INTEGER NOT NULL DEFAULT 0,
  ip                        TEXT
);
CREATE INDEX IF NOT EXISTS idx_orden_estado ON orden (estado);
CREATE INDEX IF NOT EXISTS idx_orden_wompi  ON orden (wompi_transaction_id);

-- El comprador es el responsable financiero: es quien paga y a quien se le
-- factura. Las aceptaciones con timestamp son la evidencia legal.
CREATE TABLE IF NOT EXISTS comprador (
  orden_id        INTEGER PRIMARY KEY REFERENCES orden(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  tipo_documento  TEXT NOT NULL DEFAULT 'CC'
    CHECK (tipo_documento IN ('CC','CE','NIT','PP','TI')),
  cedula          TEXT NOT NULL,
  correo          TEXT NOT NULL,
  celular         TEXT NOT NULL,
  direccion       TEXT,
  ciudad          TEXT,
  fecha_nacimiento TEXT,           -- AAAA-MM-DD; SIESA la exige para crear el tercero
  promocion       TEXT NOT NULL,
  acepta_datos    INTEGER NOT NULL DEFAULT 0,
  acepta_terminos INTEGER NOT NULL DEFAULT 0,
  aceptado_en     TEXT,
  -- 1 = la cedula se encontro en la base de egresados que entrega mercadeo.
  -- 0 = no se pudo verificar (base sin cargar, o no aparece).
  egresado_verificado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comprador_cedula ON comprador (cedula);
CREATE INDEX IF NOT EXISTS idx_comprador_correo ON comprador (correo);

-- Un asistente por boleta. El indice 0 es siempre el titular de la compra.
CREATE TABLE IF NOT EXISTS asistente (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id    INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  indice      INTEGER NOT NULL,
  nombre      TEXT    NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'CC'
    CHECK (tipo_documento IN ('CC','CE','NIT','PP','TI')),
  cedula      TEXT,
  correo      TEXT,
  celular     TEXT,
  promocion   TEXT    NOT NULL,
  es_egresado INTEGER NOT NULL DEFAULT 0,
  UNIQUE (orden_id, indice)
);

-- Un registro por QR. El estado es lo que impide que un mismo codigo entre dos
-- veces por la puerta.
CREATE TABLE IF NOT EXISTS boleta (
  id            TEXT PRIMARY KEY,               -- ULID
  orden_id      INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  asistente_id  INTEGER NOT NULL REFERENCES asistente(id) ON DELETE CASCADE,
  token_firmado TEXT NOT NULL UNIQUE,
  estado        TEXT NOT NULL DEFAULT 'emitida'
    CHECK (estado IN ('emitida','usada','anulada')),
  emitida_en    TEXT NOT NULL,
  usada_en      TEXT,
  usada_por     TEXT,
  puerta        TEXT,
  anulada_en    TEXT,
  motivo_anulacion TEXT,
  reemplazada_por  TEXT REFERENCES boleta(id)
);
CREATE INDEX IF NOT EXISTS idx_boleta_orden ON boleta (orden_id);

-- Evita sobreventa mientras el usuario esta dentro de la pasarela. Se libera
-- sola al vencer (ver src/servicios/reservas.js).
CREATE TABLE IF NOT EXISTS reserva_cupo (
  orden_id  INTEGER PRIMARY KEY REFERENCES orden(id) ON DELETE CASCADE,
  cantidad  INTEGER NOT NULL,
  estado    TEXT    NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa','consumida','liberada')),
  creada_en TEXT    NOT NULL,
  expira_en TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reserva_estado ON reserva_cupo (estado, expira_en);

-- Idempotencia y auditoria: Wompi puede reenviar el mismo evento varias veces.
CREATE TABLE IF NOT EXISTS webhook_wompi (
  event_id    TEXT PRIMARY KEY,
  payload_raw TEXT NOT NULL,
  recibido_en TEXT NOT NULL,
  procesado_en TEXT,
  resultado   TEXT
);

-- Bitacora de acciones administrativas (anular, reemitir, reenviar). Sirve para
-- responder "quien hizo que" cuando algo se reclame.
CREATE TABLE IF NOT EXISTS auditoria (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ocurrio_en TEXT NOT NULL,
  actor     TEXT NOT NULL,
  accion    TEXT NOT NULL,
  detalle   TEXT
);

-- Base de egresados que entrega mercadeo. El acta del colegio exige que quien
-- COMPRA sea egresado ("doble check por cedula o ano de graduacion"); los
-- acompanantes pueden no serlo.
--
-- La tabla puede estar vacia: mientras mercadeo no entregue la base, el modo
-- VALIDAR_EGRESADO=advertir deja pasar la compra y solo la marca. Se llena con
--   npm run importar-egresados -- egresados.csv
CREATE TABLE IF NOT EXISTS egresado (
  cedula      TEXT PRIMARY KEY,
  nombre      TEXT,
  promocion   TEXT,               -- ano de grado
  cargado_en  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_egresado_promocion ON egresado (promocion);
