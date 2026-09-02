'use client';

import { useEffect, useState } from 'react';
import { Link2, Check } from 'lucide-react';
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

   Al lado va "Copiar enlace": no todo el mundo comparte por WhatsApp, y quien
   quiera pegarlo en un correo, en un grupo de Facebook o en su historia
   necesita la URL suelta y no un mensaje armado. */
export default function CompartirWhatsApp({ className = '' }: { className?: string }) {
  const [url, setUrl] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setUrl(window.location.origin + window.location.pathname), []);

  /* El aviso de "copiado" se borra solo. El temporizador se limpia al
     desmontar y en cada copia nueva, para no dejarlo colgado. */
  useEffect(() => {
    if (!copiado) return;
    const id = setTimeout(() => setCopiado(false), 2200);
    return () => clearTimeout(id);
  }, [copiado]);

  const mensaje = [
    `${evento.titulo} — ${evento.colegio}`,
    `${evento.fechaTexto}, ${evento.horaTexto}. ${evento.lugar} (${evento.direccion}).`,
    '¿Nos vemos allá? Cupos limitados.',
    url,
  ]
    .filter(Boolean)
    .join('\n');

  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      /* El portapapeles falla en contextos no seguros (http) y si el usuario
         niega el permiso. No hay nada que avisar: el enlace sigue visible en
         la barra del navegador. */
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2.5 font-body text-sm font-semibold text-bone/75 underline-offset-[6px] transition-colors hover:text-[#25D366] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
      >
        <IconoWhatsApp size={18} />
        Compartir Evento por WhatsApp
      </a>

      {/* Solo aparece cuando ya hay URL: un botón de copiar que no copia nada
          es peor que no tenerlo. */}
      {url && (
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-2 font-body text-sm font-semibold text-bone/60 underline-offset-[6px] transition-colors hover:text-gold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          {copiado ? (
            <Check size={16} strokeWidth={2} className="text-gold" />
          ) : (
            <Link2 size={16} strokeWidth={1.75} />
          )}
          {copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
        </button>
      )}
    </div>
  );
}
