// =============================================================================
// La letra de Chats: Inter, la de respond.io
// =============================================================================
// respond.io declara `font-family: Inter, sans-serif !important` en todo su CSS (relevamiento
// respondio.md §1.0). La copia es TAL CUAL, así que la tab usa Inter y no la Geist del resto de MaKo.
//
// ⚠️ ANTES ENTRABA POR `next/font/google` Y ESO TIRÓ EL BUILD DE PRODUCCIÓN (15/10/2026, con la
// Noto Sans del Image Editor, que estaba igual). El comentario de la versión vieja lo había
// anticipado con todas las letras — «next build necesita red hacia Google Fonts; sin red, el build
// falla al bajarla» — y aun así quedó, porque durante semanas la red contestó. Lo que pasó: dos
// builds seguidos murieron con «next/font/google queries have exactly one entry» sobre el MISMO
// código que había compilado verde una hora antes, y producción se quedó atrás sin que nada lo
// dijera. **Un build que depende de una red ajena falla cualquier día**, y cuando falla bloquea los
// deploys de todos los chats, no sólo el de esta tab.
//
// Ahora entra como hoja de Google desde el navegador, igual que el resto del repo (app/layout.tsx,
// app/_cursos/fuentes.ts y, desde el mismo día, el Image Editor). Se pierde lo que la versión vieja
// buscaba: la letra ya no sale del mismo deploy, así que hay un pedido a fonts.googleapis.com al
// abrir la tab. Es el precio de que el build no dependa de Google, y se paga.
//
// `precedence` hace que React 19 suba el <link> al <head> y lo deduplique: se puede montar en los
// dos `return` de ChatsApp sin que salgan dos hojas.
//
// Si algún día hace falta que la letra salga del deploy, el camino es `next/font/local` con el
// woff2 commiteado — eso no pide nada en el build ni en el navegador. Lo que no vuelve es
// `next/font/google`.

export const HOJA_INTER =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

/** La hoja de Inter para la raíz `.rio` de Chats. */
export function FuenteChats() {
  return <link rel="stylesheet" href={HOJA_INTER} precedence="default" />;
}
