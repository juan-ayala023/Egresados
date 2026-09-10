// -----------------------------------------------------------------------------
// QUE OPERACIONES OFRECE EL SERVICIO DE SIESA, Y QUE CAMPOS PIDE CADA UNA.
//
//   npm run listar-siesa                  las lista todas
//   npm run listar-siesa -- Tercero       muestra los campos de las que digan "Tercero"
//
// SOLO FUNCIONA DESDE LA RED DEL COLEGIO o desde el servidor cseventos: el
// WSDL vive en una IP interna (10.90.11.140) que no responde desde fuera.
//
// Para que existe: el colegio confirmo (10-sep-2026) que hay que validar si el
// tercero existe en SIESA y, si no, mandarlo a crear, y que "dentro del WSDL
// estan los dos metodos, uno del tercero y otro de la sucursal". Este script
// saca los nombres exactos y sus campos, que es lo unico que falta para
// escribir esa parte.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import soap from 'soap'
import { config } from '../src/config.js'

const filtro = process.argv[2]

if (!config.siesa.wsdl) {
  console.log('\n  Falta SIESA_WSDL_URL en el .env\n')
  process.exit(1)
}

console.log(`\n  Leyendo ${config.siesa.wsdl}\n`)

let cliente
try {
  cliente = await soap.createClientAsync(config.siesa.wsdl, {
    wsdl_options: { rejectUnauthorized: false },
  })
} catch (e) {
  console.log(`  No se pudo leer el WSDL: ${e.message}`)
  console.log('  Recuerda: esto solo corre desde la red del colegio.\n')
  process.exit(1)
}

const descripcion = cliente.describe()

for (const [servicio, puertos] of Object.entries(descripcion)) {
  for (const [puerto, operaciones] of Object.entries(puertos)) {
    console.log(`  ${servicio} / ${puerto}`)
    console.log('  ' + '-'.repeat(servicio.length + puerto.length + 3))

    for (const nombre of Object.keys(operaciones)) {
      if (filtro && !nombre.toLowerCase().includes(filtro.toLowerCase())) continue
      console.log(`\n    ${nombre}`)

      // Con filtro se muestran los campos; sin el, solo la lista de nombres.
      if (!filtro) continue
      const entrada = operaciones[nombre]?.input
      if (!entrada) { console.log('      (sin campos declarados)'); continue }
      for (const [campo, tipo] of Object.entries(entrada)) {
        if (campo.startsWith('target')) continue
        const t = typeof tipo === 'string' ? tipo : JSON.stringify(tipo)
        console.log(`      ${campo.padEnd(34)} ${t.slice(0, 400)}`)
      }
    }
    console.log('')
  }
}
