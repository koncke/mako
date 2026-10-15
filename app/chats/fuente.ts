// =============================================================================
// La letra de Chats: Inter, la de respond.io
// =============================================================================
// respond.io declara `font-family: Inter, sans-serif !important` en todo su CSS (relevamiento
// respondio.md §1.0). La copia es TAL CUAL, así que la tab usa Inter y no la Geist del resto de MaKo.
//
// ⚠️ ES EL PRIMER `next/font` DEL REPO (el resto entra como hoja de Google: app/layout.tsx y
// app/_cursos/fuentes.ts). Se eligió así porque la letra sale del MISMO deploy (Next la baja en el
// build y la sirve desde /_next): sin pedido a fonts.googleapis.com al abrir la tab y sin el salto
// de letra de una hoja que llega tarde. La consecuencia: `next build` necesita red hacia Google
// Fonts. Sin red, el build falla al bajarla — no dibuja otra letra en silencio.
//
// La variable `--rio-inter` la publica la CLASE (`inter.variable`), que va en la raíz `.rio`
// (ChatsApp.tsx); chats.css la usa en `--rio-font` con Inter y la del sistema de respaldo.

import { Inter } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--rio-inter',
});
