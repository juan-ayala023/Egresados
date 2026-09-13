'use client';

import { useEffect, useState } from 'react';
import { evento } from '@/data';
import IconoWhatsApp from './IconoWhatsApp';

/* CTA grupal: abre WhatsApp con el mensaje ya escrito Y EL ENLACE DE LA
   PÁGINA, y deja que el egresado escoja el chat de su promoción. Es wa.me SIN
   número: así WhatsApp muestra el selector de chats en vez de abrirle
   conversación a alguien.

   EL ENLACE ES EL SUBDOMINIO OFICIAL, no la URL desde donde se abrió la
   página. El colegio asignó homecomingtcs.columbus.edu.co el 13 de septiembre
   de 2026 (va en NEXT_PUBLIC_SITIO_URL). Antes salía de window.location, y
   quien compartiera desde Vercel o desde un túnel de pruebas mandaba ESA
   dirección a su promoción. Si la variable faltara, cae a window.location
   como antes: nunca manda un enlace roto.

   El botón de "Copiar enlace" que iba al lado lo quitó el colegio el 8 de
   septiembre de 2026. */
export default function CompartirWhatsApp({ className = '' }: { className?: string }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const fija = (process.env.NEXT_PUBLIC_SITIO_URL ?? '').replace(/\/$/, '');
    setUrl(fija || window.location.origin + window.location.pathname);
  }, []);

  /* Formato del colegio: una linea por dato. Antes iba en parrafo corrido y
     en WhatsApp se leia como un bloque que nadie termina; en renglones se
     escanea de un vistazo.

     SIN EMOJIS (13 de septiembre de 2026). Iban con uno por renglon, como en
     la muestra del colegio, pero la app de WhatsApp para Windows los
     convierte en "?" al recibir el enlace -- es un fallo de esa app con los
     caracteres de 4 bytes, no de aqui. Se quitaron antes que arriesgar que a
     alguien le llegue el mensaje con signos raros.

     Tampoco va la cursiva de "Cupos limitados" (_asi_): por la misma razon,
     mejor texto plano que marcas que puedan salir crudas.

     Los datos salen de `evento` en data.ts, no van escritos aqui: si cambia
     la fecha o la hora, el mensaje cambia solo y no queda una version vieja
     circulando por los chats. */
  const mensaje = [
    `¡${evento.titulo}!`,
    `${evento.fechaTexto} | ${evento.horaTexto}`,
    evento.lugar,
    'Cupos limitados.',
    /* El enlace en su propio renglon: WhatsApp solo lo vuelve clicable y le
       arma la vista previa si no lleva texto pegado. */
    url && `Compra tu boleta aquí:\n${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2.5 font-body text-sm font-bold text-bone/75 underline-offset-[6px] transition-colors hover:text-[#25D366] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
      >
        <IconoWhatsApp size={18} />
        Compartir evento por WhatsApp
      </a>
    </div>
  );
}
