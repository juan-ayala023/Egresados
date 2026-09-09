// Genera un QR_SECRET y explica que hacer con el.
//   npm run generar-qr-secret
import crypto from 'node:crypto'

const secreto = crypto.randomBytes(32).toString('hex')

console.log('')
console.log('  Pega esta linea en tu .env:')
console.log('')
console.log(`  QR_SECRET=${secreto}`)
console.log('')
console.log('  OJO: cambiar esta llave despues de emitir boletas las invalida TODAS.')
console.log('  En la puerta, ningun QR ya enviado volveria a servir.')
console.log('')
