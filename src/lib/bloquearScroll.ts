'use client';

import { useEffect } from 'react';

/* ============================================================================
   UN SOLO CANDADO PARA EL SCROLL DE LA PÁGINA.

   EL PROBLEMA QUE RESUELVE (11 de septiembre de 2026): cuatro componentes
   —el checkout, el menú móvil, la galería y el preloader— hacían cada uno por
   su cuenta:

       document.body.style.overflow = 'hidden'   // al abrir
       document.body.style.overflow = ''         // al cerrar

   Como es una variable global del documento, el que corría de último ganaba.
   Con el checkout abierto bastaba que el Navbar o el Preloader volvieran a
   ejecutar su efecto para que pusieran '' y le quitaran el bloqueo: la rueda
   del mouse sobre el checkout empezaba a mover la página de atrás.

   Aquí se cuenta cuántos lo tienen pedido. Solo se desbloquea cuando el
   último lo suelta, así que ya no importa el orden.

   POR QUÉ `position: fixed` Y NO SOLO `overflow: hidden`: en iOS Safari el
   overflow no alcanza —la página sigue rebotando— y en algunos navegadores
   el que scrollea es <html> y no <body>. Fijar el body es lo único que
   funciona en todos. Se guarda la posición y se devuelve al soltar, así que
   para quien mira no pasa nada.
   ========================================================================== */

let bloqueos = 0;
let posicionGuardada = 0;

function bloquear() {
  if (bloqueos === 0 && typeof document !== 'undefined') {
    posicionGuardada = window.scrollY;
    const cuerpo = document.body;

    /* Al desaparecer la barra de desplazamiento, el contenido se ensancha y
       la página "salta" unos píxeles. Se compensa con el mismo ancho. */
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;
    if (anchoBarra > 0) cuerpo.style.paddingRight = `${anchoBarra}px`;

    cuerpo.style.position = 'fixed';
    cuerpo.style.top = `-${posicionGuardada}px`;
    cuerpo.style.left = '0';
    cuerpo.style.right = '0';
    cuerpo.style.width = '100%';
    cuerpo.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  bloqueos += 1;
}

function liberar() {
  bloqueos = Math.max(0, bloqueos - 1);
  if (bloqueos === 0 && typeof document !== 'undefined') {
    const cuerpo = document.body;
    cuerpo.style.position = '';
    cuerpo.style.top = '';
    cuerpo.style.left = '';
    cuerpo.style.right = '';
    cuerpo.style.width = '';
    cuerpo.style.overflow = '';
    cuerpo.style.paddingRight = '';
    document.documentElement.style.overflow = '';
    window.scrollTo(0, posicionGuardada);
  }
}

/**
 * Congela el scroll de la página mientras `activo` sea true.
 *
 * Se puede usar en varios componentes a la vez sin que se pisen: la página
 * vuelve a moverse cuando el último lo suelta.
 */
export function useBloquearScroll(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    bloquear();
    return liberar;
  }, [activo]);
}
