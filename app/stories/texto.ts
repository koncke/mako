// =============================================================================
// texto — la secuencia del día como texto, para «Copiar la secuencia» (módulo PURO)
// =============================================================================
// SIN 'use client' ni 'server-only' a propósito: lo usan la tab de escritorio (StoriesApp.tsx) y la del teléfono
// (app/m/stories). Vivía adentro de StoriesApp.tsx, un módulo 'use client', y una pantalla del teléfono no puede
// reusar de ahí sin llevarse la tab entera (AGENTS.md). Mudado el 17/10/2026 sin cambiar una coma.

// `import type` de un módulo server-only: se borra al compilar, no arrastra nada.
import type { PiezaStory } from '@/lib/ig-writer';

/**
 * La secuencia como texto, para «Copiar la secuencia». La arma el CÓDIGO desde la
 * pieza, no el modelo: un dato exacto no se le vuelve a pedir a un LLM.
 */
export function secuenciaATexto(p: PiezaStory): string {
  const ultimo = p.frames.length - 1;
  return [
    `STORIES DEL DÍA: ${p.idea}`,
    ...p.frames.map((f, i) => [
      `FRAME ${i + 1} · ${f.tipo}`,
      f.texto ? `Texto: ${f.texto}` : '',
      f.indicacion ? `Producción: ${f.indicacion}` : '',
      f.interactivoManual ? 'Interactivo: se agrega a mano en la app.' : '',
      i === ultimo && (p.cta || p.palabraClave)
        ? `Cierre: ${[p.cta, p.palabraClave ? `palabra clave ${p.palabraClave}` : ''].filter(Boolean).join(' · ')}`
        : '',
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}
