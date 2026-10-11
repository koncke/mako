// =============================================================================
// landing-mapa-rotulo — qué se tocó en una landing, dicho en palabras
// =============================================================================
// El rótulo de cada fila de «Lo más tocado»: el destino de un botón, o qué era lo
// que no es un botón («Fuera de un botón · una imagen»). Vivía adentro de
// app/landing-analyst/MapaDeCalor.tsx, que es `'use client'`, y se mudó acá el
// 11/10/2026 porque el lector del conjunto `toques` del Dashboard
// (lib/graficos-datos-extra.ts) lo necesita del lado del server, y un `.tsx` con
// `'use client'` no le exporta valores al server (AGENTS.md, «'use client' es una
// frontera de DATOS»). La pantalla del mapa lo importa de acá: un solo rótulo.
//
// SIN `server-only`, a propósito (lo usan la pantalla, el server y los tests).

import type { ToqueMapa } from './landing-mapa';

/** La dirección sin el esquema: `negocio.com/precios`. */
export function hostPath(url: string): string {
  try { const u = new URL(url); return u.host + (u.pathname === '/' ? '' : u.pathname); } catch { return url; }
}

export const TAGS: Record<string, string> = {
  IMG: 'una imagen', PICTURE: 'una imagen', SVG: 'un ícono', H1: 'un título', H2: 'un título', H3: 'un título',
  H4: 'un título', P: 'un texto', SPAN: 'un texto', LI: 'una lista', VIDEO: 'un video', INPUT: 'un campo',
  LABEL: 'un campo', TEXTAREA: 'un campo', SELECT: 'un campo',
};

/** Lo que se tocó, en palabras: el destino de un botón, o qué era lo que no es un botón. */
export function rotuloDe(t: Pick<ToqueMapa, 'tipo' | 'etiqueta'>): string {
  const e = t.etiqueta;
  if (t.tipo === 'clic_vacio') {
    const tag = e.replace(/^vacio:\s*/, '').toUpperCase();
    return `Fuera de un botón · ${TAGS[tag] ?? 'una zona'}`;
  }
  if (e.startsWith('boton:')) return e.slice(6).trim() || 'Un botón sin texto';
  if (e.startsWith('ancla ')) return e.slice(6);
  if (/^https?:\/\//.test(e)) return hostPath(e.split(' — ')[0]);
  return e;
}
