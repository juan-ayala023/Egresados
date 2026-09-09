// -----------------------------------------------------------------------------
// GET /api/evento
//
// Lo consume el front al cargar la pagina para saber si puede vender. Con esto
// el comite puede cerrar la venta sin recompilar el sitio.
// -----------------------------------------------------------------------------
import { Router } from 'express'
import { config } from '../config.js'
import { estadoVenta, disponibilidad, aperturaVenta } from '../servicios/aforo.js'

export const rutasEvento = Router()

rutasEvento.get('/evento', (_req, res) => {
  const estado = estadoVenta()

  const cuerpo = {
    nombre: config.evento.nombre,
    fecha: config.evento.fecha,
    lugar: config.evento.lugar,
    direccion: config.evento.direccion,
    aforo: config.evento.aforo,
    cierreVenta: config.evento.cierreVenta,
    // El front pinta la cuenta regresiva con esto cuando estado = "proxima".
    apertura: aperturaVenta(),
    estadoVenta: estado, // proxima | abierta | agotada | cerrada

    // Enlaces que el front muestra junto a las casillas obligatorias del
    // checkout. Vacios mientras el colegio no los entregue: el front no debe
    // pintar un enlace roto.
    politicaDatosUrl: config.politicaDatosUrl || null,
    terminosUrl: config.terminosUrl || null,

    maxPorCompra: config.boleta.maxPorCompra,
  }

  // DECISION #5: la reunion pidio no mostrar cupos restantes. Por defecto no
  // viajan; se prenden con MOSTRAR_CUPOS_RESTANTES=true en el .env.
  if (config.mostrarCuposRestantes) {
    const d = disponibilidad()
    cuerpo.vendidas = d.vendidas
    cuerpo.disponibles = d.disponibles
  }

  res.json(cuerpo)
})
