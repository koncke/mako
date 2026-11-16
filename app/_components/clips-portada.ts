// =============================================================================
// Las animaciones de la portada, en fila: las que pasan solas en el login y en /planes (15/11/2026)
// =============================================================================
// Vivían en app/login/_ui/TarjetaLogin.tsx. Salieron a este archivo cuando /planes las pidió (Martín, 15/11/2026: «al costado
// pondría, en lugar del VSL, las imágenes, lo mismo que tenemos en el onboarding, que son como van pasando las animaciones que
// ya hicimos»): TarjetaLogin importa ./login.css, y cualquier página que importara la lista desde ahí se llevaba esa hoja.
// Acá no hay estilos: sólo los datos. El componente que las pasa es <VitrinaVideos> (app/login/_ui/VitrinaVideos.tsx).
// =============================================================================

import { TARJETAS_PORTADA } from '@/app/vsl/_sitio/datos';
import type { ClipVitrina } from '@/app/login/_ui/VitrinaVideos';

/**
 * HASTA DÓNDE SE MUESTRA CADA GRABACIÓN, en segundos: el último momento con contenido, ANTES de que vuelva a su arranque.
 *
 * ⚠️ LAS GRABACIONES DE LA PORTADA TERMINAN VOLVIENDO A SU PRIMER CUADRO, Y ACÁ ESO SE VE COMO UN ERROR (15/11/2026). En la
 * portada cada una se repite sola, así que están hechas para que el final empalme con el principio sin corte. En el login
 * pasan una detrás de otra, y esa vuelta se veía como que «por un segundo se reinicia la animación original… debería pasar
 * a la siguiente» (Martín). Medido: las 11 terminan en un cuadro casi idéntico al primero, y en algunas la vuelta dura
 * segundos — «referentes» ya está de nuevo en la grilla de caras a los 7 de sus 10 s; «automations», «carruseles» y
 * «crm-ficha» tienen colas de 2 a 5 s.
 *
 * ⚠️ Y EL CORTE SE ELIGIÓ MIRANDO, NO CON UNA FÓRMULA. La cuenta automática («el último pico de diferencia con el primer
 * cuadro») acertaba en los clips de un solo paso y se comía contenido de verdad en los de varios: en «video» cortaba en el
 * segundo 11 de 23 y se perdía la reproducción con los subtítulos, que es lo mejor del clip; en «crm-ficha» se perdía la
 * lista de actividad. Cómo se mide uno nuevo: `ffmpeg -i <clip>.webm -vf "fps=1,scale=192:-1,tile=6x4" -frames:v 1 tira.png`
 * y se anota el segundo del último cuadro antes de que vuelva el arranque. Un clip sin medir se ve ENTERO (con la vuelta);
 * tests/login-vitrina-animaciones.test.ts avisa cuando la portada suma uno.
 */
const HASTA_DONDE: Readonly<Record<string, number>> = {
  '/vsl-assets/sitio/referentes.webm': 6.9,
  '/vsl-assets/sitio/spy.webm': 20.1,
  '/vsl-assets/sitio/copywriting.webm': 10.4,
  '/vsl-assets/sitio/carruseles.webm': 10.0,
  '/vsl-assets/sitio/video.webm': 18.0,
  '/vsl-assets/sitio/copilot.webm': 12.6,
  '/vsl-assets/sitio/replicar.webm': 11.9,
  '/vsl-assets/sitio/crm-ficha.webm': 15.9,
  '/vsl-assets/sitio/automations.webm': 13.0,
  '/vsl-assets/sitio/chats.webm': 13.6,
  '/vsl-assets/sitio/comunidad.webm': 21.9,
};

/**
 * LAS ANIMACIONES DE LA PORTADA, en el orden de la portada: cada fila que muestra la app grabada (`visual.video`).
 * Las que no tienen video (el hero, los gurús, el Second Brain vivo, un recuadro de «falta») no entran.
 *
 * Reemplaza a la frase «El mejor software para vender High Ticket» que iba sola en este panel (15/11/2026). Martín: «en
 * lugar de poner el mejor software para vender High Ticket, ahí yo pondría los videos que hicimos de las animaciones…
 * en bucle de todas las cosas que hace MaKo».
 */
export const CLIPS_VITRINA: readonly ClipVitrina[] = TARJETAS_PORTADA.flatMap((t) =>
  typeof t.visual === 'object' && 'video' in t.visual
    ? [{ video: t.visual.video, poster: t.visual.poster, titulo: t.titulo, hasta: HASTA_DONDE[t.visual.video] ?? null }]
    : [],
);
