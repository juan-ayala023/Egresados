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
import { despacharCorreo } from './servicios/pagos.js'

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
// Diez minutos de gracia porque antes de eso el usuario probablemente sigue
// escribiendo la tarjeta, y no tiene sentido gastarle consultas a Wompi.
// En modo simulacion no corre: no hay a quien preguntarle.
// -----------------------------------------------------------------------------
const CADA_5_MINUTOS = 5 * 60_000

async function correrBarrido() {
  try {
    const c = await barrer()
    if (!c.revisadas) return

    console.log(
      `[reconciliacion] ${c.revisadas} revisada(s): `
      + `${c.pagadas} pagada(s), ${c.rechazadas} rechazada(s), `
      + `${c.siguenPendientes} sigue(n) en la pasarela, `
      + `${c.sinTransaccion} sin id de transaccion, ${c.errores} con error`,
    )
    for (const ordenId of c.correos) despacharCorreo(ordenId)
  } catch (e) {
    // Nunca puede tumbar el servidor: es una tarea de fondo.
    console.error('[reconciliacion] Fallo el barrido:', e.message)
  }
}

const barrido = setInterval(correrBarrido, CADA_5_MINUTOS)
barrido.unref?.()

// -----------------------------------------------------------------------------
// Reintento de correos.
//
// Cada minuto se revisan las ordenes pagadas a las que no les ha salido el
// correo y ya cumplieron su espera. Corre aparte del barrido porque la primera
// espera es de un minuto: un fallo pasajero de SMTP se resuelve solo, rapido.
// -----------------------------------------------------------------------------
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
