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
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
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
