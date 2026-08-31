'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { contacto, evento } from '@/data';
import { ease } from '@/lib/motion';
import IconoWhatsApp from './IconoWhatsApp';

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
