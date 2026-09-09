// -----------------------------------------------------------------------------
// Datos de ejemplo para probar el panel administrativo:  npm run seed
//
// Crea ordenes en varios estados (pagadas, pendientes, rechazadas) sin pasar por
// HTTP. Se niega a correr en produccion.
// -----------------------------------------------------------------------------
import { config } from '../src/config.js'
import { crearOrden, confirmarPago } from '../src/servicios/ordenes.js'
import { disponibilidad } from '../src/servicios/aforo.js'

if (config.entorno === 'production') {
  console.error('El seed no corre en produccion.')
  process.exit(1)
}

const NOMBRES = [
  'Maria Fernanda Restrepo Gomez', 'Andres Felipe Ossa Velez', 'Laura Jimenez Arango',
  'Juan Pablo Mesa Uribe', 'Catalina Zapata Londono', 'Santiago Escobar Ruiz',
  'Valentina Correa Betancur', 'Sebastian Alvarez Mejia',
]

const aleatorio = (lista) => lista[Math.floor(Math.random() * lista.length)]

function armarCompra(indiceComprador, cantidad) {
  const cedula = String(1000000000 + indiceComprador * 137)
  return {
    tipoBoletaId: config.boleta.id,
    cantidad,
    comprador: {
      nombre: aleatorio(NOMBRES),
      cedula,
      correo: `comprador${indiceComprador}@ejemplo.com`,
      celular: `30012345${String(indiceComprador).padStart(2, '0')}`,
      direccion: `Cra ${10 + indiceComprador} # 1-50`,
      ciudad: 'Medellin',
      promocion: String(1990 + (indiceComprador % 30)),
    },
    asistentes: Array.from({ length: cantidad }, (_, i) => ({
      nombre: aleatorio(NOMBRES),
      cedula: `${cedula}${i}`,
      correo: `asistente${indiceComprador}-${i}@ejemplo.com`,
      celular: `31012345${String(i).padStart(2, '0')}`,
      promocion: i % 4 === 3 ? 'no-egresado' : String(1990 + ((indiceComprador + i) % 30)),
      esEgresado: i % 4 !== 3,
    })),
    aceptaTratamientoDatos: true,
    aceptaTerminos: true,
  }
}

console.log('Creando ordenes de ejemplo...\n')

let creadas = 0
for (let i = 1; i <= 12; i++) {
  const cantidad = 1 + (i % config.boleta.maxPorCompra)
  try {
    const orden = crearOrden(armarCompra(i, cantidad), '127.0.0.1')

    // 8 de cada 12 se pagan, 2 se rechazan, 2 quedan pendientes.
    if (i % 6 === 0) {
      confirmarPago(orden.referencia, { estadoDestino: 'rechazada', transactionId: `seed-${i}` })
      console.log(`  ${orden.referencia}  ${cantidad} boleta(s)  rechazada`)
    } else if (i % 5 === 0) {
      console.log(`  ${orden.referencia}  ${cantidad} boleta(s)  pendiente`)
    } else {
      confirmarPago(orden.referencia, {
        estadoDestino: 'pagada', transactionId: `seed-${i}`, metodoPago: i % 2 ? 'CARD' : 'PSE',
      })
      console.log(`  ${orden.referencia}  ${cantidad} boleta(s)  pagada`)
    }
    creadas++
  } catch (e) {
    console.log(`  (orden ${i} no se creo: ${e.message})`)
  }
}

const d = disponibilidad()
console.log(`\n${creadas} ordenes creadas.`)
console.log(`Aforo: ${d.vendidas} vendidas, ${d.reservadas} reservadas, ${d.disponibles} disponibles de ${d.aforo}.`)
console.log('\nRevisa el panel con:')
console.log(`  curl -H "Authorization: Bearer ${config.tokens.admin}" ${config.urlPublica}/api/admin/aforo`)
process.exit(0)
