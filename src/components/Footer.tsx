'use client';

import { Instagram, Phone, MapPin, CalendarDays, Clock } from 'lucide-react';
import { contacto, evento } from '@/data';

/* EL PIE VA EN CLARO, como historia y boletería.
   Desde el 9 de septiembre de 2026 es SOLO datos de contacto y letra chica
   legal: el bloque de cierre con el titular y el botón se quitó porque
   repetía lo que ya está arriba. La página cierra en las preguntas.

   Sobre --bone el 139C no contrasta como letra, así que los textos dorados
   van en --gold-deep. */

export default function Footer() {
  return (
    <footer className="relative bg-bone">
      {/* SIN bloque de cierre. El colegio lo pidió quitar el 9 de septiembre de
          2026: repetía el titular, la promesa y el mismo botón que ya están
          arriba, y la página terminaba diciendo dos veces lo mismo. Ahora
          cierra en las preguntas frecuentes y el pie queda solo con los datos.

          Los textos siguen en `cierre` dentro de data.ts por si se quiere
          devolver; no se borran de ahí para no perder la redacción. */}

      {/* CONTACTO. Bajo aqui desde las preguntas frecuentes: alla iba sobre el
          navy y se veia apagado, y sobre este fondo claro resalta. Ademas
          cierra la pagina -- lo ultimo que ve el visitante es a donde
          escribir.

          Va grande a proposito: este correo es el UNICO canal de atencion
          -- el colegio descarto WhatsApp -- asi que es lo unico que tiene
          alguien cuyo pago no paso o a quien no le llego la boleta. */}
      {contacto.correo && (
        <div className="mx-auto max-w-3xl px-6 pb-10 pt-12 text-center">
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
        </div>
      )}

      {/* Datos.
          Sin logotipo: el único archivo que hay es la versión sobre fondo
          oscuro y aquí desaparecería. Va el lockup escrito, que es lo que
          pide la referencia. */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 border-t border-brand/10 py-8 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <p className="font-display text-[12.5px] font-black uppercase tracking-[0.16em] text-brand">
              {evento.colegio} {evento.aniversario} Years
            </p>
            <p className="mt-1.5 font-body text-[13px] text-grayBrand">{contacto.comite}</p>
          </div>

          <div className="flex flex-col items-center gap-2.5 md:items-end">
            {/* El correo NO se repite aqui: ya va arriba, grande, y en la
                misma pantalla salia dos veces. Instagram si se queda -- es el
                otro canal y no esta en ninguna otra parte. */}
            {contacto.telefono && (
              <a
                href={`tel:${contacto.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-grayBrand transition-colors hover:text-goldDeep"
              >
                <Phone size={14} strokeWidth={1.75} />
                {contacto.telefono}
              </a>
            )}
            <span className="flex items-center gap-2.5 font-body text-[13px] font-bold text-brand">
              <Instagram size={14} strokeWidth={1.75} />
              {contacto.instagram}
            </span>
          </div>
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
