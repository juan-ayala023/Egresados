'use client';

/* El correo de contacto, como enlace que SIEMPRE lleva a algún lado.

   Un `mailto:` a secas abre la app de correo en el celular, pero en un PC sin
   programa de correo configurado (la mayoría) el clic no hace nada, y la
   gente cree que el enlace está roto. El colegio pidió el 14 de septiembre de
   2026 que "le den y lo lleve", en PC y en celular.

   Cómo se resuelve:
   - En pantallas táctiles (celular, tablet) se deja el mailto: ahí sí abre la
     app de correo, que es lo que la gente espera.
   - En PC se abre Gmail en el navegador, en pestaña nueva, con destinatario y
     asunto puestos. Si no tiene sesión, Gmail se la pide -- pero siempre pasa
     algo visible. Casi todo el mundo tiene Gmail; el que use Outlook ve la
     dirección en pantalla igual y la puede copiar.

   El href sigue siendo mailto: para lectores de pantalla y para quien haga
   clic derecho > copiar dirección. */

type Props = {
  correo: string;
  asunto?: string;
  className?: string;
};

export default function EnlaceCorreo({ correo, asunto = '', className = '' }: Props) {
  const mailto = `mailto:${correo}${asunto ? `?subject=${encodeURIComponent(asunto)}` : ''}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(correo)}${
    asunto ? `&su=${encodeURIComponent(asunto)}` : ''
  }`;

  const alHacerClic = (e: React.MouseEvent<HTMLAnchorElement>) => {
    /* Puntero "grueso" = dedo: celular o tablet. Ahí el mailto funciona. */
    const tactil = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (tactil) return;
    e.preventDefault();
    window.open(gmail, '_blank', 'noopener,noreferrer');
  };

  return (
    <a href={mailto} onClick={alHacerClic} className={className}>
      {correo}
    </a>
  );
}
