// =============================================================================
// estilos — la hoja de estilos de lo que dibujan los gráficos del Dashboard (el sistema «gordo»)
// =============================================================================
// Las tarjetas y el cromo del editor viven en app/dashboard/editor-css.ts; esto es SÓLO el adentro de un
// gráfico que se dibuja en HTML (tablas, paneles, barras gordas, la barra de proporción, la línea de tiempo,
// las tarjetas y el mapa). Va con `<style href precedence>` (React 19 la sube al <head> una sola vez, aunque
// la monten 40 gráficos), así no hace falta tocar la hoja del editor.
//
// Reglas (lib/graficos-gordo.ts): ninguna letra por debajo de 13 px (var(--fs-sm)); cifras tabulares; sólo
// tokens (se dan vuelta solos en el tema oscuro) y ningún hex. Sin scroll de costado: lo que no entra se
// corta con «…» o se esconde de derecha a izquierda.
// ⚠️ Sin comillas invertidas adentro de la cadena: cortan la hoja a la mitad (AGENTS.md).

import { CSS_HTML } from './estilos-html';

export const CSS_GRAFICOS = `
${CSS_HTML}
.gr-punto { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
.gr-chip { display: inline-flex; align-items: center; font-size: var(--fs-sm); font-weight: 600; padding: 3px 9px; border-radius: 8px; background: var(--surface-2); color: var(--dim); white-space: nowrap; }

.gr-numero-sec { font-size: var(--fs-md); color: var(--dim); margin-top: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gr-solo-numero { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
.gr-solo-numero b { font-size: 28px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.gr-solo-numero span { font-size: var(--fs-sm); color: var(--dim); }
`;

/** La hoja, una sola vez por página aunque la monten todos los gráficos. */
export function EstilosGraficos() {
  return <style href="gr-graficos" precedence="medium">{CSS_GRAFICOS}</style>;
}
