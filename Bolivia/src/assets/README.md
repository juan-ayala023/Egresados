# /assets

Carpeta para recursos que necesiten pasar por el bundler (logos SVG, íconos,
videos cortos). **Las fotos de la cabaña NO van aquí**: viven en `public/img/`
y se sirven directamente, sin importarse desde JS.

## Cómo añadir una foto nueva

1. Exporta la foto a JPEG en dos tamaños y déjala en `public/img/`:
   - `nombre.jpg` → lado mayor 1920 px, calidad ~82 (héroes, lightbox, fondos)
   - `nombre-sm.jpg` → lado mayor 900 px, calidad ~76 (tarjetas, galería)
2. Usa un nombre en minúsculas, sin espacios, tildes ni `ñ`
   (ej. `piscina-atardecer`, no `Piscina Atardecer.png`).
3. Referénciala en `src/utils/data.js` con los helpers:

```js
import { img, imgSm } from './data'

img('piscina-atardecer')    // → /img/piscina-atardecer.jpg
imgSm('piscina-atardecer')  // → /img/piscina-atardecer-sm.jpg
```

En la galería basta con añadir una entrada a `GALLERY` con el `name` (sin
extensión), un `alt` descriptivo y `span: 'tall'` para fotos verticales o
`'short'` para horizontales — así se recorta lo mínimo posible.

> Los PNG originales sin comprimir están en la raíz del proyecto. Pesan ~2,5 MB
> cada uno, así que no los uses directamente en la web: son el respaldo del que
> se generaron los JPEG de `public/img/`.
