// Prueba la conexion al SQL Server del colegio y muestra la configuracion
// contable de Homecoming.
//
//   npm run probar-siesa          usa SIESA_SERVICE_ID del .env (465)
//   npm run probar-siesa -- 340   otra fila, para comparar con teatro
//
// No escribe nada, no vende nada, no factura nada. Solo lee y muestra.
import 'dotenv/config'
import { config } from '../src/config.js'
import { leerConfiguracionSiesa, camposVacios, cerrarConexion } from '../src/siesa/config.js'

const servicioId = Number(process.argv[2]) || config.siesa.servicioId

console.log('')
console.log(`  Servidor : ${config.siesa.host || '(sin configurar)'}:${config.siesa.puerto}`)
console.log(`  Base     : ${config.siesa.baseDatos}`)
console.log(`  Usuario  : ${config.siesa.usuario || '(sin configurar)'}`)
console.log(`  Servicio : ${servicioId || '(sin configurar)'}`)
console.log('')

try {
  const configuracion = await leerConfiguracionSiesa(servicioId)

  console.log('  Conexion OK. Configuracion contable:')
  console.log('')
  const ancho = Math.max(...Object.keys(configuracion).map((k) => k.length))
  for (const [campo, valor] of Object.entries(configuracion)) {
    const mostrado = valor === null ? '(NULL)' : String(valor)
    console.log(`    ${campo.padEnd(ancho)}  ${mostrado}`)
  }
  console.log('')

  const vacios = camposVacios(configuracion)
  if (vacios.length) {
    console.log(`  OJO: ${vacios.length} campo(s) sin valor:`)
    console.log(`    ${vacios.join(', ')}`)
    console.log('')
    console.log('  Los llena el colegio en su tabla, no se arreglan desde aqui.')
    console.log('  Hay que preguntarles cuales son obligatorios para facturar.')
  } else {
    console.log('  Los 14 campos vienen con valor.')
  }
  console.log('')
} catch (e) {
  console.log(`  FALLO: ${e.message}`)
  console.log('')

  if (e.tipo === 'sin_configurar') {
    console.log('  Completa el bloque de SQL Server en el .env.')
  } else if (e.tipo === 'conexion') {
    console.log('  Cosas que suelen ser:')
    console.log('    - No estas en la red del colegio (la IP 10.90.11.15 es interna).')
    console.log('      Si entras con SSMS desde este mismo equipo, la red esta bien.')
    console.log('    - Usuario o contrasena equivocados.')
    console.log('    - El puerto no es 1433, o hay una instancia con nombre.')
  } else if (e.tipo === 'sin_fila') {
    console.log('  El id no existe en la tabla. Confirmalo con el colegio.')
  }
  console.log('')
  process.exitCode = 1
} finally {
  await cerrarConexion()
}
