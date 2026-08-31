/* Pantalla interna: no tiene por que aparecer en Google. El token la protege,
   pero un enlace indexado es una invitacion a probar suerte. */
export const metadata = {
  title: 'Panel del comité',
  robots: { index: false, follow: false, nocache: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
