'use client';

import { Instagram, Phone } from 'lucide-react';
import { contacto, evento } from '@/data';

/* EL PIE VA EN CLARO, como historia y boletería.
   Desde el 9 de septiembre de 2026 es SOLO datos de contacto y letra chica
   legal: el bloque de cierre con el titular y el botón se quitó porque
   repetía lo que ya está arriba. La página cierra en las preguntas.

   UNA SOLA FRANJA (10 de septiembre de 2026). Antes eran dos: el correo
   arriba y, debajo de una línea, una banda aparte con el nombre del colegio a
   la izquierda y las redes a la derecha. El colegio pidió quitar esa segunda
   banda -- dejaba mucho aire muerto al final de la página -- y meter las
   redes dentro del bloque del correo, para que el cierre sea uno solo.

   También salió "Comité Organizador Homecoming 80 Años": no le dice nada a
   quien está buscando cómo escribir. El texto sigue en data.ts por si se
   quiere devolver.

   Sobre --bone el 139C no contrasta como letra, así que los textos dorados
   van en --gold-deep. */

export default function Footer() {
  return (
    <footer className="relative bg-bone">
      <div className="mx-auto max-w-3xl px-6 pb-10 pt-12 text-center">
        {/* CONTACTO. Va grande a proposito: este correo es el UNICO canal de
            atencion -- el colegio descarto WhatsApp -- asi que es lo unico
            que tiene alguien cuyo pago no paso o a quien no le llego la
            boleta. */}
        {contacto.correo && (
          <>
            <p className="font-body text-base text-grayBrand sm:text-lg">
              Para mayor información o cualquier inquietud,
              <br className="hidden sm:block" /> escríbenos a nuestro correo:
            </p>
            <a
              href={`mailto:${contacto.correo}`}
              className="mt-3 inline-block font-body text-lg font-bold text-goldDeep underline decoration-goldDeep/40 underline-offset-[6px] transition-colors hover:text-brand sm:text-xl"
            >
              {contacto.correo}
            </a>
          </>
        )}

        {/* SIN LINEA divisoria (10 de septiembre de 2026): partia en dos un
            bloque que ya era uno solo, y el corte se leia como si abajo
            empezara otra seccion. El aire alcanza para separar. */}
        <div className="mt-11 flex flex-col items-center gap-y-4">
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {contacto.telefono && (
              <a
                href={`tel:${contacto.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-grayBrand transition-colors hover:text-goldDeep"
              >
                <Phone size={14} strokeWidth={1.75} />
                {contacto.telefono}
              </a>
            )}
            {/* El correo NO se repite aqui: ya va arriba, grande, y en la
                misma pantalla salia dos veces. Instagram si se queda -- es el
                otro canal y no esta en ninguna otra parte.

                ES UN ENLACE DE VERDAD. Estaba como <span>: se veia igual pero
                no llevaba a ninguna parte, y la gente le daba clic. La URL se
                arma quitandole la arroba al usuario, asi no hay dos datos que
                mantener sincronizados en data.ts. */}
            <a
              href={`https://instagram.com/${contacto.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 font-body text-[13px] font-bold text-brand transition-colors hover:text-goldDeep"
            >
              <Instagram size={14} strokeWidth={1.75} />
              {contacto.instagram}
            </a>
          </div>

          {/* Sin logotipo: el unico archivo que hay es la version sobre fondo
              oscuro y aqui desapareceria. Va el lockup escrito, que es lo que
              pide la referencia. */}
          <p className="font-display text-[12.5px] font-black uppercase tracking-[0.16em] text-brand">
            {evento.colegio} {evento.aniversario} Years
          </p>
        </div>

        {/* La franja de copyright y la mención a la pasarela las quitó el
            colegio el 8 de septiembre de 2026.

            OJO SI SE VA A DEVOLVER: los contratos de pasarela suelen exigir
            mostrar la marca en el sitio donde se cobra. Si tesorería confirma
            que el de Wompi lo pide, esto vuelve tal cual. */}
      </div>
    </footer>
  );
}
