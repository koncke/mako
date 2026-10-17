// =============================================================================
// pieza — los tipos de carrusel, el rol de cada slide y el carrusel como texto (módulo PURO)
// =============================================================================
// SIN 'use client' ni 'server-only' a propósito: lo usan la tab de escritorio (CarouselsApp.tsx) y la del teléfono
// (app/m/carousels). Vivían adentro de CarouselsApp.tsx, un módulo 'use client', y una pantalla del teléfono no
// puede reusar de ahí sin llevarse la tab entera (AGENTS.md, «Lo que una pantalla de /m reusa de escritorio no
// puede vivir en un módulo 'use client'»). Mudado el 17/10/2026 sin cambiar una coma.

import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
// `import type` de un módulo server-only: se borra al compilar, no arrastra nada.
import type { PiezaCarrusel } from '@/lib/ig-writer';
import { LIMITES_CARRUSEL } from '@/lib/ig-formatos';
import type { TipoCarrusel } from './actions';

export const TIPOS: Array<{ value: TipoCarrusel; label: string; sub: string; icono: NombreIconoMenu }> = [
  { value: 'educativo', label: 'Educativo', sub: 'Enseña una sola cosa; la respuesta va al final', icono: 'curso' },
  { value: 'storytelling', label: 'Storytelling', sub: 'Historia escena a escena con personaje consistente', icono: 'cita' },
  { value: 'venta', label: 'Venta', sub: 'Problema → solución ligada a tu oferta, CTA al cierre', icono: 'dinero' },
];

/** Rol de la slide según su posición (la portada es el gancho; la última cierra). */
export const rolDeSlide = (i: number, total: number) =>
  i === 0 ? 'Portada · gancho' : i === total - 1 ? 'Cierre · moraleja + CTA' : 'Desarrollo';

/**
 * El guion del carrusel como texto, para «Copiar el carrusel». Lo arma el CÓDIGO
 * desde la pieza editada, no el modelo: un dato exacto no se le vuelve a pedir a un
 * LLM.
 */
export function notasDe(p: PiezaCarrusel): string {
  return [
    `Objetivo: ${p.objetivo || '—'}`,
    p.cta ? `CTA (última slide): ${p.cta}` : 'Sin CTA: pieza solo de alcance.',
    p.palabraClave ? `Palabra clave comment→DM: ${p.palabraClave}` : '',
    p.cta ? `Primer comentario sugerido: ${p.cta}` : '',
    // Sin «SOLO JPEG (un PNG rebota)»: eso lo exige la API de publicación (Zernio), y
    // desde el 06/10/2026 la pieza se sube a mano en la app, que acepta PNG.
    `Entre ${LIMITES_CARRUSEL.itemsMin} y ${LIMITES_CARRUSEL.itemsMax} slides.`,
    '',
    ...p.slides.map((s, i) =>
      `Slide ${i + 1} — ${rolDeSlide(i, p.slides.length)}\n  Texto en la imagen: ${s.texto || '—'}\n  Diseño: ${s.visual || '—'}`),
  ].filter(Boolean).join('\n');
}

/** Lo que copia «Copiar el carrusel»: las notas y el caption. */
export function carruselATexto(p: PiezaCarrusel): string {
  return `${notasDe(p)}\n\nCaption:\n${p.caption}`;
}
