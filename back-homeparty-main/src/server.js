// -----------------------------------------------------------------------------
// Punto de entrada: npm start
// -----------------------------------------------------------------------------
import { crearApp } from './app.js'
import { config, revisarConfiguracion } from './config.js'
import { cerrar as cerrarBaseDatos } from './db/index.js'
import { liberarReservasVencidas, disponibilidad, estadoVenta } from './servicios/aforo.js'
import { totalEgresados } from './servicios/egresados.js'
import { barrer } from './servicios/reconciliacion.js'
import { reintentarPendientes } from './servicios/correos.js'
import { despacharCorreo, despacharFactura } from './servicios/pagos.js'
import { reintentarFacturasDeRed } from './servicios/facturacion.js'
import { replicar, replicaActiva } from './servicios/replica.js'
import { facturacionActiva } from './servicios/facturacion.js'

// Se revisa ANTES de abrir el puerto: mas vale no arrancar que arrancar mal.
revisarConfiguracion()

const app = crearApp()
const servidor = app.listen(config.puerto, () => {
  const d = disponibilidad()
  console.log('')
  console.log(`  ${config.evento.nombre} - backend de boletas`)
  console.log(`  Escuchando en   ${config.urlPublica}`)
  console.log(`  Entorno         ${config.entorno}`)
  console.log(`  Base de datos   ${config.baseDatos}`)
  console.log(`  Venta           ${estadoVenta()} (${d.vendidas} vendidas, ${d.reservadas} reservadas, ${d.disponibles} disponibles de ${d.aforo})`)
  const tarifa = config.boleta.tarifaCentavos
  console.log(`  Boleta          $${(config.boleta.precioCentavos / 100).toLocaleString('es-CO')}`
    + (tarifa > 0 ? ` + $${(tarifa / 100).toLocaleString('es-CO')} de servicio` : ' (sin tarifa: la asume el colegio)'))
  console.log(`  Apertura        ${config.evento.apertura}`)
  console.log(`  Egresados       modo ${config.validarEgresado}, ${totalEgresados()} en la base`)
  if (config.validarEgresado !== 'apagado' && totalEgresados() === 0) {
    console.log('                  (mercadeo no ha entregado la base todavia)')
  }
  // Que se vea de una: el 14 de septiembre de 2026 el API corrio un dia
  // entero en ensayo sin que nadie lo notara, porque el arranque no lo decia.
  console.log(`  Replica SQL     ${replicaActiva() ? `activa: ${config.replica.baseDatos}.dbo.${config.replica.prefijo}* cada minuto` : 'apagada'}`)
  console.log(`  SIESA           ${!facturacionActiva() ? 'sin configurar (no se factura)'
    : config.siesa.ensayo ? 'ENSAYO: los documentos se arman pero NO se envian al ERP'
    : 'REAL: factura y recibo se emiten en el ERP al confirmar cada pago'}`)
  if (config.wompi.simulacion) {
    console.log('')
    console.log('  ADVERTENCIA: WOMPI_SIMULACION=true.')
    console.log('  Los pagos no son reales y POST /api/simulacion/pagar esta habilitado.')
  }
  console.log('')
})

// Cada minuto se devuelven al inventario los cupos de quienes abandonaron el
// checkout. Tambien se hace al crear cada orden; esto es la red de seguridad
// para cuando no hay trafico.
const limpieza = setInterval(() => {
  try {
    const liberadas = liberarReservasVencidas()
    if (liberadas > 0) console.log(`[reservas] ${liberadas} reserva(s) vencida(s) liberada(s)`)
  } catch (e) {
    console.error('[reservas] Fallo la limpieza:', e.message)
  }
}, 60_000)

// -----------------------------------------------------------------------------
// Reconciliacion proactiva.
//
// Cada 5 minutos se le pregunta a la pasarela por las ordenes que llevan mas de
// 10 minutos pendientes. Es la red para cuando el webhook se pierde: sin esto,
// alguien puede pagar y quedarse sin boleta sin que nadie se entere.
//
// UN MINUTO, no cinco, y un minuto de gracia en vez de diez.
//
// Antes daba hasta 15 minutos de espera. El colegio lo puso claro: la gente
// paga, ve "aprobado" y espera su boleta AHI MISMO -- nadie le da a "volver al
// comercio", y quince minutos en blanco se leen como que algo fallo.
//
// Con esto la boleta llega en uno o dos minutos aunque cierren la pestana.
// Instantaneo solo lo da el webhook, y esa URL la tiene la plataforma del
// colegio; mientras tanto, esto es lo mas cerca que se puede estar.
//
// El costo es alguna consulta de mas a Wompi mientras alguien todavia escribe
// su tarjeta: la orden sale PENDING y no se hace nada. Con 500 boletas eso no
// se nota en ninguna cuota.
// -----------------------------------------------------------------------------
const CADA_MINUTO = 60_000
const MINUTOS_DE_GRACIA = 1

async function correrBarrido() {
  try {
    const c = await barrer({ minutosDeGracia: MINUTOS_DE_GRACIA })
    if (!c.revisadas) return

    console.log(
      `[reconciliacion] ${c.revisadas} revisada(s): `
      + `${c.pagadas} pagada(s), ${c.rechazadas} rechazada(s), `
      + `${c.siguenPendientes} sigue(n) en la pasarela, `
      + `${c.sinTransaccion} sin id de transaccion, ${c.errores} con error`,
    )
    for (const ordenId of c.correos) {
      despacharCorreo(ordenId)
      despacharFactura(ordenId)
    }
  } catch (e) {
    // Nunca puede tumbar el servidor: es una tarea de fondo.
    console.error('[reconciliacion] Fallo el barrido:', e.message)
  }
}

/* Una pasada al arrancar: si el servidor se cayo o se reinicio mientras
   alguien pagaba, esa orden no espera al primer intervalo. */
correrBarrido()

const barrido = setInterval(correrBarrido, CADA_MINUTO)
barrido.unref?.()

// -----------------------------------------------------------------------------
// Reintento de correos.
//
// Cada minuto se revisan las ordenes pagadas a las que no les ha salido el
// correo y ya cumplieron su espera. Corre aparte del barrido porque la primera
// espera es de un minuto: un fallo pasajero de SMTP se resuelve solo, rapido.
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Reintento de facturas que fallaron por red (Pangea o SQL Server caidos en
// el momento del pago). Cada 10 minutos, una a la vez. Los rechazos de SIESA
// no se reintentan solos: esos necesitan a alguien (ver el panel).
// -----------------------------------------------------------------------------
const facturas = setInterval(() => {
  reintentarFacturasDeRed()
    .then((c) => {
      if (c.reintentadas) console.log(`[siesa] reintento por red: ${c.facturadas}/${c.reintentadas} facturada(s)`)
    })
    .catch((e) => console.error('[siesa] Fallo el reintento de facturas:', e.message))
}, 10 * CADA_MINUTO)
facturas.unref?.()

// -----------------------------------------------------------------------------
// Replica al SQL Server del colegio (Don Luis). Cada minuto, lo que cambio.
// Si esta apagada (REPLICA_SQLSERVER=false) no hace nada.
// -----------------------------------------------------------------------------
if (replicaActiva()) {
  const replica = setInterval(() => {
    replicar()
      .then((c) => {
        if (c.enviadas || c.errores) console.log(`[replica] ${c.enviadas} fila(s) enviada(s), ${c.errores} con error`)
      })
      .catch((e) => console.error('[replica] Fallo el barrido:', e.message))
  }, CADA_MINUTO)
  replica.unref?.()
}

const correos = setInterval(() => {
  reintentarPendientes()
    .then((c) => {
      if (c.enviados || c.agotados) {
        console.log(
          `[correo] ${c.enviados} reenviado(s), ${c.fallidos} pendiente(s), `
          + `${c.agotados} sin intentos`,
        )
      }
    })
    .catch((e) => console.error('[correo] Fallo el reintento:', e.message))
}, 60_000)
correos.unref?.()

// Apagado ordenado: dejar de recibir peticiones, terminar las que estan en
// curso y cerrar la base de datos.
function apagar(senal) {
  console.log(`\n${senal} recibido, cerrando...`)
  clearInterval(limpieza)
  clearInterval(barrido)
  clearInterval(correos)
  servidor.close(() => {
    cerrarBaseDatos()
    console.log('Listo.')
    process.exit(0)
  })
  // Si algo se queda colgado, no esperar para siempre.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => apagar('SIGINT'))
process.on('SIGTERM', () => apagar('SIGTERM'))
