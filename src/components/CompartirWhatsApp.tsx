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

  const mensaje = [
    `${evento.titulo} — ${evento.colegio}`,
    `${evento.fechaTexto}, ${evento.horaTexto}. ${evento.lugar} (${evento.direccion}).`,
    '¿Nos vemos allá? Cupos limitados.',
    url,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2.5 font-body text-sm font-semibold text-bone/75 underline-offset-[6px] transition-colors hover:text-[#25D366] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
      >
        <IconoWhatsApp size={18} />
        Compartir evento por WhatsApp
      </a>
    </div>
  );
}
