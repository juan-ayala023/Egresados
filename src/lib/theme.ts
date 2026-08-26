/* Colores que CSS no puede alcanzar porque viven dentro de una data-URI.
   Debe reflejar --surface de globals.css. Es el único hex duplicado del proyecto
   y está aquí, señalado, en vez de escondido dentro de un componente. */
export const BLUR_HEX = '#00203A';

/* SVG de 8x8 sólido, codificado como data-URI sin base64 (no requiere Buffer,
   funciona igual en servidor y navegador). */
export const blurDataURL = (hex: string = BLUR_HEX) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${hex}"/></svg>`
  );
