import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { evento } from '@/data';

/* El manual de marca prohíbe expresamente usar fuentes distintas a Roboto en
   títulos y cuerpos de texto. Antes había Playfair Display + Inter: ambas
   estaban fuera de norma. Una sola familia, tres pesos:
   700 títulos y subtítulos · 500 apoyos de UI · 400 cuerpos. */
const roboto = Roboto({
  subsets: ['latin'],
  /* Roboto NO tiene 600. Por eso en el resto del sitio no se usa
     `font-semibold`: pide un peso que la fuente no trae y cada navegador lo
     resuelve distinto -- unos bajan a 500, otros lo fabrican. Para "mas que
     normal" va font-medium (500); para negrilla, font-bold (700).

     El 900 (Black) es para las etiquetas pequenas: a 12px con las letras muy
     separadas, la negrilla normal se adelgaza y el colegio las seguia viendo
     finas. El Black si se lee como un negro solido. */
  weight: ['400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  /* El subdominio oficial (13 de septiembre de 2026). Es lo que WhatsApp,
     Facebook e Instagram usan para armar la vista previa cuando alguien pega
     el enlace: sin esto, las rutas relativas de la imagen y el título no
     resuelven y la tarjeta sale vacía. */
  ...(process.env.NEXT_PUBLIC_SITIO_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITIO_URL) }
    : {}),
  title: `${evento.titulo} · ${evento.colegio}`,
  description: `${evento.bajada}. ${evento.fechaTexto} en ${evento.lugar}, ${evento.ciudad}. Cupos limitados.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={roboto.variable}>
      <body className="font-body">{children}</body>
    </html>
  );
}
