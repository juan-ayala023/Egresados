'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { contacto, evento } from '@/data';
import { ease } from '@/lib/motion';

/* Glifo oficial de WhatsApp. lucide-react ya no trae iconos de marca, así que
   va inline en vez de aproximarlo con un bocadillo genérico: la silueta es lo
   que hace que el botón se reconozca sin leer nada. */
function IconoWhatsApp({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.548 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

export default function BotonWhatsApp() {
  const [visible, setVisible] = useState(false);
  const sinMovimiento = useReducedMotion();

  /* Aparece al salir del hero. Ahí abajo viven el contador y los dos botones
     principales; un flotante encima compite con la acción que de verdad
     importa, que es comprar. */
  useEffect(() => {
    const umbral = () => window.innerHeight * 0.85;
    const alScroll = () => setVisible(window.scrollY > umbral());
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll);
    return () => {
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('resize', alScroll);
    };
  }, []);

  /* Sin número no hay botón. Misma regla que el Footer: antes un hueco que un
     dato inventado, y aquí además un enlace roto que abre WhatsApp en blanco. */
  if (!contacto.whatsapp) return null;

  const mensaje = encodeURIComponent(
    `Hola, quiero informacion sobre el ${evento.titulo} del ${evento.colegio}.`
  );
  const href = `https://wa.me/${contacto.whatsapp}?text=${mensaje}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.85 }}
          animate={sinMovimiento ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: 0.4, ease: ease.out }}
          /* z-60: por encima de la página, por debajo del menú móvil (70), del
             checkout (80), del lightbox (95) y del telón de carga (100). */
          className="fixed bottom-6 right-6 z-[60] sm:bottom-8 sm:right-8"
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escríbenos por WhatsApp"
            className="group flex items-center gap-0 rounded-full bg-[#25D366] py-4 pl-4 pr-4 text-ink shadow-[0_8px_30px_-6px_rgba(0,0,0,0.55)] outline-none transition-[gap,padding,box-shadow] duration-300 hover:gap-2.5 hover:pr-5 hover:shadow-[0_10px_36px_-6px_rgba(37,211,102,0.5)] focus-visible:ring-2 focus-visible:ring-bone focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:hover:gap-3"
          >
            <IconoWhatsApp />
            {/* La etiqueta se despliega en el hover y no ocupa espacio en
                reposo: el botón vive sobre el contenido y en móvil no hay
                hover, así que ahí se queda siempre como círculo limpio. */}
            <span className="hidden max-w-0 overflow-hidden whitespace-nowrap font-body text-[13px] font-semibold leading-none transition-[max-width] duration-300 group-hover:max-w-[10rem] sm:block">
              Escríbenos
            </span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
