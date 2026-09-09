// -----------------------------------------------------------------------------
// Conexion a SQLite. Se eligio SQLite porque no hay que instalar ni administrar
// un servidor de base de datos y porque sus transacciones son suficientes para
// el volumen de este evento (500 boletas).
//
// better-sqlite3 es SINCRONO a proposito: no hay callbacks ni await, y una
// transaccion se lee de arriba a abajo como si fuera un solo bloque. Eso es
// justo lo que necesitamos para que el descuento de aforo sea atomico.
// -----------------------------------------------------------------------------
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { correrMigraciones } from './migraciones.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))

fs.mkdirSync(path.dirname(config.baseDatos), { recursive: true })

export const db = new Database(config.baseDatos)

// WAL permite leer mientras se escribe. foreign_keys hay que prenderlo a mano
// en SQLite: viene apagado por defecto.
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
// Si otra conexion tiene la base bloqueada, esperar hasta 5s en vez de fallar.
db.pragma('busy_timeout = 5000')

// Crea las tablas si no existen. Con un esquema de este tamano no hace falta un
// sistema de migraciones: el archivo .sql es idempotente.
//
// Se ejecuta al importar este modulo, no al arrancar el servidor: los servicios
// preparan sus consultas en el momento en que se importan, y para entonces las
// tablas tienen que existir.
export function migrar() {
  const esquema = fs.readFileSync(path.join(AQUI, 'esquema.sql'), 'utf8')
  db.exec(esquema)

  // Y despues las migraciones, para las columnas que se agregaron a tablas que
  // ya existian en bases desplegadas (ver src/db/migraciones.js).
  const aplicadas = correrMigraciones(db)
  if (aplicadas.length && config.entorno !== 'test') {
    console.log(`[db] Migraciones aplicadas: ${aplicadas.join(', ')}`)
  }
}

migrar()

/**
 * Ejecuta una funcion dentro de una transaccion IMMEDIATE.
 *
 * IMMEDIATE toma el candado de escritura desde el primer instante. Es lo que
 * evita que dos compras simultaneas lean "queda 1 cupo" al mismo tiempo y las
 * dos crean que se lo ganaron.
 */
export function enTransaccion(fn) {
  const envuelta = db.transaction(fn)
  return envuelta.immediate()
}

export function cerrar() {
  db.close()
}
