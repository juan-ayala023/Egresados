'use client';

import { Instagram, Mail, Phone, MapPin, CalendarDays, Clock } from 'lucide-react';
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

      {/* Datos.
          Sin logotipo: el único archivo que hay es la versión sobre fondo
          oscuro y aquí desaparecería. Va el lockup escrito, que es lo que
          pide la referencia. */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 border-t border-brand/10 py-8 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.16em] text-brand">
              {evento.colegio} {evento.aniversario} Years
            </p>
            <p className="mt-1.5 font-body text-[13px] text-grayBrand">{contacto.comite}</p>
          </div>

          <div className="flex flex-col items-center gap-2.5 md:items-end">
            {contacto.correo && (
              <a
                href={`mailto:${contacto.correo}`}
                className="flex items-center gap-2.5 font-body text-[13px] text-grayBrand transition-colors hover:text-goldDeep"
              >
                <Mail size={14} strokeWidth={1.75} />
                {contacto.correo}
              </a>
            )}
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
