import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { evento } from '@/data';

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${evento.titulo} · ${evento.colegio}`,
  description: `${evento.bajada}. ${evento.fechaTexto} en ${evento.lugar}, ${evento.ciudad}. Cupos limitados.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
