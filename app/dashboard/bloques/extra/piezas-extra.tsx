'use client';

// =============================================================================
// piezas-extra — lo que comparten los bloques de las tabs de Analysts
// =============================================================================
// La caja y los mensajes son los de los bloques de Comercial (../piezas.tsx): así un bloque de Ads,
// Landing, Closing o Productividad se ve hermano de los de al lado. Acá va lo propio: la hoja de estilos
// de estos bloques (hover, consultas de contenedor, la cuadrícula de tarjetas) y los colores con
// SIGNIFICADO (bueno / malo / proceso, el veredicto, la banda de prioridad), siempre con los TOKENS de
// la app para que se den vuelta en el tema oscuro.

import type { ReactNode } from 'react';
import { Raiz, MONO } from '../piezas';
import type { Polarity, Veredicto } from '@/lib/ads-analyst-patrones';
import type { Prio } from '@/app/plan/board/types';

export { MONO };

/** Un tono con su fondo suave: el fondo sale de mezclar el tono con la superficie (se oscurece solo). */
export const suave = (color: string, p = 12) => `color-mix(in srgb, ${color} ${p}%, var(--surface))`;

export const COLOR_POLARIDAD: Record<Polarity, string> = { bueno: 'var(--good)', malo: 'var(--bad)', proceso: 'var(--warn)' };
export const COLOR_VEREDICTO: Record<Veredicto, string> = {
  escalar: 'var(--good)', mejorar: 'var(--primary)', reescribir: 'var(--warn)', repensar: 'var(--bad)', validar: 'var(--faint)', imagen: 'var(--faint)',
};
export const COLOR_PRIO: Record<Prio, string> = { alta: 'var(--bad)', media: 'var(--warn)', baja: 'var(--good)', futuro: 'var(--faint)' };
/** El color de un puntaje de 0 a 10, con los cortes de la tab de Closing (≥7,5 bien, ≥5 regular). */
export const colorPuntaje = (s: number | null) => (s == null ? 'var(--faint)' : s >= 7.5 ? 'var(--good)' : s >= 5 ? 'var(--warn)' : 'var(--bad)');

export const fmt1 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : (Math.round(n * 10) / 10).toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(n) ? 0 : 1, maximumFractionDigits: 1 }));
export const usdEntero = (n: number) => `US$${Math.round(n).toLocaleString('es-MX')}`;
export const fechaCorta = (iso: string | null) => { if (!iso) return '—'; const [, m, d] = iso.slice(0, 10).split('-'); return m && d ? `${d}/${m}` : '—'; };

const CSS_EXTRA = `
.bx-linea { font-size: 12.5px; color: var(--faint); }
.bx-chip { display: inline-flex; align-items: center; gap: 5px; font-family: ${MONO}; font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.bx-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.bx-tarjeta { display: flex; flex-direction: column; gap: 10px; text-align: left; font: inherit; color: inherit; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; min-width: 0; }
button.bx-tarjeta { cursor: pointer; transition: border-color .15s, box-shadow .15s; }
button.bx-tarjeta:hover { border-color: var(--border-strong); box-shadow: inset 0 0 0 999px var(--velo-hover); }
button.bx-tarjeta:focus-visible, .bx-boton:focus-visible, .bx-pildora:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bx-boton { font: inherit; font-size: 12.5px; font-weight: 600; color: var(--primary); background: none; border: none; padding: 0; cursor: pointer; text-align: left; }
.bx-boton:hover { text-decoration: underline; }
.bx-pildoras { display: inline-flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 3px; }
.bx-pildora { font: inherit; font-size: 12.5px; border: none; background: transparent; color: var(--dim); padding: 4px 12px; border-radius: 999px; cursor: pointer; }
.bx-pildora[aria-pressed="true"] { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(18,21,27,.08); }
.bx-fila { display: flex; align-items: center; gap: 10px; font-size: 13px; min-width: 0; }
.bx-fila > .bx-crece { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bx-carril { flex: 1; height: 14px; border-radius: 5px; background: var(--surface-2); overflow: hidden; min-width: 40px; }
.bx-carril > span { display: block; height: 100%; }
.bx-num { font-family: ${MONO}; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--dim); white-space: nowrap; flex: none; }
.bx-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.bx-lista { display: flex; flex-direction: column; gap: 7px; }
.bx-vacio { border: 1.5px dashed var(--border-strong); border-radius: 11px; padding: 18px 14px; text-align: center; color: var(--faint); font-size: 12.5px; line-height: 1.5; }
.bx-boton:disabled, .bx-pildora:disabled { cursor: default; opacity: .6; text-decoration: none; }
.bx-buscar { flex: 1 1 200px; min-width: 150px; max-width: 320px; box-sizing: border-box; padding: 7px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); font: inherit; font-size: 13px; color: var(--ink); }
.bx-buscar:focus-visible { outline: none; box-shadow: var(--focus-ring); }
button.bx-renglon { display: flex; width: 100%; align-items: center; gap: 10px; padding: 10px 8px; background: none; border: none; border-bottom: 1px solid var(--border); font: inherit; color: inherit; text-align: left; cursor: pointer; transition: box-shadow .15s; }
button.bx-renglon:hover { box-shadow: inset 0 0 0 999px var(--velo-hover); }
button.bx-renglon:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bx-svg { display: block; width: 100%; height: auto; overflow: visible; }
.bx-svg text { font-family: ${MONO}; }
@container (max-width: 640px) { .bx-cols { grid-template-columns: minmax(0, 1fr); } }
`;

/** La caja de un bloque de Analysts: la de Comercial, con la hoja de estos bloques (una sola vez en la página). */
export function RaizExtra({ children }: { children: ReactNode }) {
  return (
    <Raiz>
      <style href="dash-bloques-extra" precedence="medium">{CSS_EXTRA}</style>
      {children}
    </Raiz>
  );
}

/** El vacío con borde punteado de las tabs viejas: una frase, qué falta. */
export function Vacio({ children }: { children: ReactNode }) {
  return <div className="bx-vacio">{children}</div>;
}

/** Un título chico de sección adentro de un bloque. */
export function Subtitulo({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{children}</div>;
}
