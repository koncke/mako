// =============================================================================
// motion/fuentes — cargar en el navegador las fuentes de una escena ANTES de dibujarla
// =============================================================================
// Un lienzo no espera a una fuente: si no cargó, dibuja con la del sistema y no avisa (lower-thirds, de las skills de
// iart-ai, MIT, Copyright (c) 2026 iart.ai, ./LICENSE-IART: «verify the returned face has that weight/style or the canvas
// silently draws a fallback»). El Video Editor
// llama a `cargarFuentesMotion` en el punto por el que pasan el reproductor y el export (frame-descriptor.ts), así el
// primer cuadro exportado ya sale con su fuente.
//
// Sólo los pesos que la familia TIENE (`FUENTES_MOTION`): pedirle a Google uno que no existe devuelve 400 y no carga
// ninguno. Una promesa por familia: dos clips con la misma fuente la piden una vez.
// =============================================================================

import { FUENTES_MOTION } from './plantillas';
import type { Escena } from './tipos';

const cargadas = new Map<string, Promise<void>>();
const listas = new Set<string>();

function cargarFamilia(familia: string): Promise<void> {
  const ya = cargadas.get(familia);
  if (ya) return ya;
  const pesos = FUENTES_MOTION[familia];
  if (!pesos || typeof document === 'undefined') return Promise.resolve();
  const p = (async () => {
    const href = `https://fonts.googleapis.com/css2?family=${familia.replace(/ /g, '+')}:wght@${pesos.join(';')}&display=swap`;
    if (!document.querySelector(`link[data-motion-fuente="${familia}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-motion-fuente', familia);
      document.head.appendChild(link);
      await new Promise<void>((ok) => {
        link.addEventListener('load', () => ok(), { once: true });
        link.addEventListener('error', () => ok(), { once: true });
      });
    }
    await Promise.all(pesos.map((w) => document.fonts.load(`${w} 40px "${familia}"`).catch(() => [])));
    listas.add(familia);
  })();
  cargadas.set(familia, p);
  return p;
}

/** Las familias que usa una escena (la de la plantilla y, en un testimonio, la de las comillas). */
export function familiasDe(e: Escena): string[] {
  const s = new Set<string>();
  for (const c of e.capas) if ((c.k === 'texto' || c.k === 'cifra') && FUENTES_MOTION[c.familia]) s.add(c.familia);
  return [...s];
}

export function cargarFuentesMotion(familias: readonly string[]): Promise<void> {
  return Promise.all(familias.map(cargarFamilia)).then(() => undefined);
}

/**
 * ¿Ya están? Para no devolver una promesa en cada cuadro del reproductor. ⚠️ No con `document.fonts.check`: antes de que
 * llegue la hoja de Google no hay ninguna @font-face de esa familia, y `check` contesta `true` (nada pendiente).
 */
export function fuentesListas(familias: readonly string[]): boolean {
  if (typeof document === 'undefined') return true;
  return familias.every((f) => !FUENTES_MOTION[f] || listas.has(f));
}
