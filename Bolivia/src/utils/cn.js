// Une clases condicionalmente. Alternativa mínima a clsx sin dependencias.
export default function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
