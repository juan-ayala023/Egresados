'use client';

import { useEffect, useState } from 'react';
import { evento } from '@/data';
import IconoWhatsApp from './IconoWhatsApp';

/* CTA grupal: abre WhatsApp con el mensaje ya escrito Y EL ENLACE DE LA
   PÁGINA, y deja que el egresado escoja el chat de su promoción. Es wa.me SIN
   número: así WhatsApp muestra el selector de chats en vez de abrirle
   conversación a alguien.

   La URL se arma después de montar porque en el servidor no existe
   window.location y este sitio no tiene dominio fijo configurado todavía
   (no hay metadataBase en layout.tsx). Mientras tanto comparte solo el texto,
   que es válido: nunca manda un enlace roto.

   El botón de "Copiar enlace" que iba al lado lo quitó el colegio el 8 de
   septiembre de 2026. */
export default function CompartirWhatsApp({ className = '' }: { className?: string }) {
  const [url, setUrl] = useState('');

  useEffect(() => setUrl(window.location.origin + window.location.pathname), []);

  /* Formato del colegio: una linea por dato, cada una con su emoji.
     Antes iba en parrafo corrido y en WhatsApp se leia como un bloque que
     nadie termina; en renglones se escanea de un vistazo.

     Los datos salen de `evento` en data.ts, no van escritos aqui: si cambia
     la fecha o la hora, el mensaje cambia solo y no queda una version vieja
     circulando por los chats. */
  const mensaje = [
    `🎉 ¡${evento.titulo}!`,
    `📅 ${evento.fechaTexto} | ${evento.horaTexto}`,
    `📍 ${evento.lugar}`,
    '⚠️ Cupos limitados.',
    /* El enlace en su propio renglon: WhatsApp solo lo vuelve clicable y le
       arma la vista previa si no lleva texto pegado. */
    url && `🎟️ Compra tu boleta aquí:\n${url}`,
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
