// -----------------------------------------------------------------------------
// Migraciones mínimas.
//
// esquema.sql es idempotente (CREATE TABLE IF NOT EXISTS), asi que crear tablas
// nuevas sale gratis. Lo que NO resuelve es agregar una columna a una tabla que
// ya existe: el CREATE no se vuelve a ejecutar y la columna nunca aparece.
//
// Esto es lo mas pequeño que arregla eso. No es Alembic ni pretende serlo:
// - cada migracion se aplica UNA vez y queda anotada en la tabla `migracion`
// - si falla, revienta al arrancar, que es cuando uno quiere enterarse
//
// LIMITE A TENER PRESENTE: SQLite deja ADD COLUMN, pero NO deja cambiar un
// CHECK ni quitar una columna sin reconstruir la tabla entera. Por eso el
// vocabulario de estados de `orden` se cerro antes de abrir la venta.
// -----------------------------------------------------------------------------

/**
 * Cada entrada corre una sola vez, en orden. El nombre es la llave: si se
 * cambia, la migracion se vuelve a correr. No renombrar las ya aplicadas.
 */
const MIGRACIONES = [
  {
    nombre: '001-correo-reintentos',
    // Sin esto, un correo que falla se pierde en silencio: la orden queda
    // pagada, correo_enviado_en en NULL, y nadie se entera.
    sql: [
      `ALTER TABLE orden ADD COLUMN correo_intentos INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE orden ADD COLUMN correo_ultimo_error TEXT`,
      `ALTER TABLE orden ADD COLUMN correo_proximo_intento TEXT`,
    ],
  },
  {
    nombre: '002-siesa-facturacion',
    // Los numeros que devuelve SIESA al emitir la factura y el recibo de caja.
    // Se guardan por dos razones: para no facturar dos veces la misma orden, y
    // porque son los consecutivos con los que contabilidad rastrea la venta en
    // el ERP. `siesa_error` guarda el ultimo fallo: sin el, una factura que no
    // salio queda invisible y alguien tiene que descubrirla cuadrando cajas.
    sql: [
      `ALTER TABLE orden ADD COLUMN siesa_factura TEXT`,
      `ALTER TABLE orden ADD COLUMN siesa_recibo TEXT`,
      `ALTER TABLE orden ADD COLUMN siesa_error TEXT`,
      `ALTER TABLE orden ADD COLUMN siesa_intentado_en TEXT`,
    ],
  },
  {
    nombre: '003-alertas-atendidas',
    // Las alertas se calculan de los datos, asi que una vez aparecen se quedan
    // para siempre aunque alguien ya las haya resuelto por fuera del sistema
    // (devolvio la plata, hablo con la persona, reviso el panel de Wompi).
    //
    // Un tablero que solo crece es un tablero que nadie mira, y entonces la
    // alerta que SI importa se pierde entre veinte viejas. Esta tabla guarda
    // lo ya atendido para poder esconderlo.
    //
    // No se borra la alerta: se anota quien la atendio y cuando. Si el problema
    // vuelve a pasar en esa misma orden, vuelve a salir.
    sql: [
      `CREATE TABLE IF NOT EXISTS alerta_atendida (
         tipo        TEXT NOT NULL,
         referencia  TEXT NOT NULL,
         atendida_en TEXT NOT NULL,
         atendida_por TEXT,
         nota        TEXT,
         PRIMARY KEY (tipo, referencia)
       )`,
    ],
  },
  {
    nombre: '004-correo-por-asistente',
    // CADA BOLETA A SU PROPIO DUENIO.
    //
    // Antes las boletas de una compra salian todas al correo de quien pago, y
    // el resto dependia de que esa persona las reenviara. El colegio pidio el
    // 11 de septiembre de 2026 que a cada asistente le llegue la suya.
    //
    // Esta columna es lo que evita mandarla dos veces: el barrido de reintentos
    // corre cada minuto y Wompi reenvia eventos. Sin marcar por asistente, un
    // reintento por UNO que fallo le reenviaria la boleta a los otros tres.
    sql: [
      `ALTER TABLE asistente ADD COLUMN correo_enviado_en TEXT`,
    ],
  },
  {
    nombre: '005-ultimos-cuatro',
    // SIESA NO ACEPTA UN RECIBO CON TARJETA SIN LOS ULTIMOS CUATRO DIGITOS.
    //
    // Se supo con el primer recibo real (14 de septiembre de 2026): la factura
    // salio y el recibo volvio con "el medio de pago debe tener numero de
    // tarjeta y fecha de vencimiento". Wompi manda los ultimos cuatro en
    // payment_method.extra.last_four; desde aqui se guardan con el pago.
    sql: [
      `ALTER TABLE orden ADD COLUMN ultimos_cuatro TEXT`,
    ],
  },
  {
    nombre: '006-autorizacion-banco',
    // EL CODIGO DE APROBACION DEL BANCO, PARA EL RECIBO DE CAJA.
    //
    // Contabilidad pidio el 14 de septiembre de 2026 que en Autorizacion del
    // recibo vaya el codigo que aprueba el banco (el del voucher), no el id
    // de Wompi. Wompi lo trae en payment_method.extra.external_identifier;
    // es lo mismo que manda la plataforma de eventos del colegio.
    sql: [
      `ALTER TABLE orden ADD COLUMN autorizacion_banco TEXT`,
    ],
  },
]

/** Columnas que ya existen en una tabla. */
function columnasDe(db, tabla) {
  return new Set(db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name))
}

/**
 * ¿Este ADD COLUMN ya esta aplicado?
 *
 * Se revisa ademas de la tabla `migracion` porque una base creada desde cero
 * con un esquema.sql que ya trae la columna no necesita la migracion, y
 * volverla a correr seria un error.
 */
function yaAplicada(db, sentencia) {
  const m = /ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(sentencia)
  if (!m) return false
  const [, tabla, columna] = m
  try {
    return columnasDe(db, tabla).has(columna)
  } catch {
    return false
  }
}

export function correrMigraciones(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migracion (
      nombre      TEXT PRIMARY KEY,
      aplicada_en TEXT NOT NULL
    )`)

  const registrada = db.prepare(`SELECT 1 FROM migracion WHERE nombre = ?`)
  const registrar = db.prepare(`INSERT INTO migracion (nombre, aplicada_en) VALUES (?, ?)`)

  const aplicadas = []
  for (const m of MIGRACIONES) {
    if (registrada.get(m.nombre)) continue

    const tx = db.transaction(() => {
      for (const sentencia of m.sql) {
        if (yaAplicada(db, sentencia)) continue
        db.exec(sentencia)
      }
      registrar.run(m.nombre, new Date().toISOString())
    })
    tx()
    aplicadas.push(m.nombre)
  }

  return aplicadas
}
