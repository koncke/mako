// =============================================================================
// La letra de la interfaz del Image Editor
// =============================================================================
// Noto Sans (relevamiento-canva-armazon.md §1.4): Canva Sans es de Canva y no se
// copia, y Noto Sans es el respaldo de su propia pila, así que las medidas ya están
// pensadas para ella. Entra por next/font (alojada con el build, sin pedir nada a
// Google en el navegador) como la variable `--cv-font-ui`, que tokens.css usa en
// `--cv-font-sans`. Vive acá y no en cada raíz porque la usan dos (el editor y la
// ventana del presentador): dos llamadas a `Noto_Sans` serían dos juegos de fuentes.

import { Noto_Sans } from 'next/font/google';

export const notoSans = Noto_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--cv-font-ui',
});
