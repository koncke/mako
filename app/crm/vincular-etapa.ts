// =============================================================================
// «Vincular evento» y «Vincular cobro»: lo que comparten los dos pop-ups (22/10/2026, segunda vuelta)
// =============================================================================
// Martín, 22/10/2026, con capturas del ws1: «rediseñá el pop-up: estético y con poco texto. En la computadora y en el
// teléfono», y que «Vincular cobro» siga lo mismo que «Vincular evento». Los dos dibujan una LISTA de renglones con la
// misma hoja (`CSS_VINCULAR`): en la computadora, casilla · nombre · dónde · editar en una línea; en el teléfono, el
// «dónde» baja debajo del nombre. Puro y sin React: lo prueba tests/crm-vincular-22-10.test.ts.
// =============================================================================

import type { CSSProperties } from 'react';

/** Lo de Google Calendar, en una ⓘ (antes era una línea abajo de la lista: «Fuera textos», Martín). */
export const AVISO_GOOGLE_AGENDA = 'Google Calendar no deja vincular sus páginas de reserva: su API no las comparte.';

/** Dónde está vinculado un evento: «CRM › Etapa». null = en ninguna. */
export function ubicacionDe(v: { funnel: string; etapaNombre: string } | null | undefined): string | null {
  if (!v) return null;
  const crm = v.funnel?.trim();
  return crm ? `${crm} › ${v.etapaNombre}` : v.etapaNombre;
}

/** El orden de la lista: lo de ESTA etapa primero, después lo libre, y al final lo que está en otra (con su «Traer aquí»). */
export function ordenarEventos<T extends { nombre: string; vinculo: { funnelId: number; etapa: string } | null }>(xs: readonly T[], funnelId: number, etapa: string): T[] {
  const peso = (e: T) => (!e.vinculo ? 1 : e.vinculo.funnelId === funnelId && e.vinculo.etapa === etapa ? 0 : 2);
  return [...xs].sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, 'es'));
}

/** El botón de conectar una cuenta, como pastilla (BotonIntegracion trae su estilo de texto: el `style` lo pisa). */
export const PASTILLA_CONECTAR: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 99,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, fontSize: 13,
};

/** La hoja de los dos pop-ups. */
export const CSS_VINCULAR = `
.vx { display: flex; flex-direction: column; gap: 12px; }
.vx-barra { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vx-elastico { flex: 1; }
.vx-info { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 99px; color: var(--faint); font-size: 15px; cursor: help; }
.vx-icono { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none;
  border-radius: 8px; background: transparent; color: var(--dim); cursor: pointer; }
.vx-icono:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.vx-icono:disabled { opacity: .45; cursor: default; }
.vx-icono:focus-visible, .vx-link:focus-visible, .vx-cuenta:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.vx-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vx-form--crear { padding: 12px; border-radius: 12px; background: var(--surface-2); }
.vx-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.vx-fila { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto 28px; align-items: center; gap: 12px; padding: 11px 12px;
  border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
.vx-fila[data-aqui] { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); background: color-mix(in srgb, var(--primary) 5%, var(--surface)); }
.vx-fila--abierta { display: block; background: var(--surface-2); }
.vx-sel { width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: var(--primary); }
.vx-txt { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.vx-nombre { font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vx-nombre[data-fuera] { color: var(--dim); }
.vx-meta { font-size: 12.5px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vx-donde { display: flex; align-items: center; gap: 8px; min-width: 0; justify-content: flex-end; }
.vx-chip { max-width: 220px; padding: 3px 9px; border-radius: 99px; background: var(--surface-2); color: var(--dim); font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vx-chip--aqui { background: var(--primary-bg); color: var(--primary); font-weight: 600; }
.vx-link { flex: none; border: none; background: none; padding: 0; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--primary); }
.vx-cuentas { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
.vx-cuenta { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 99px; cursor: pointer;
  border: 1px solid var(--border-strong); background: var(--surface); color: var(--dim); font: inherit; font-size: 12.5px; font-weight: 600; }
.vx-cuenta[aria-pressed='true'] { border-color: var(--primary); background: var(--primary-bg); color: var(--primary); }
.vx-cuenta:disabled { cursor: default; opacity: .6; }
.vx-gris > span { height: 12px; border-radius: 6px; background: var(--surface-2); }
.vx-gris > span:nth-child(2) { width: 60%; }
.vx-vacio { margin: 0; padding: 26px 12px; text-align: center; font-size: 13.5px; color: var(--dim); }
.vx-vacio[data-mal], .vx-nota[data-mal] { color: var(--warn); }
.vx-nota { margin: 0; font-size: 12.5px; }
.vx-donde-titulo { font-size: 12.5px; color: var(--faint); }
@media (max-width: 560px) {
  .vx-fila { grid-template-columns: 20px minmax(0, 1fr) 28px; grid-template-areas: 'sel txt icono' '. donde donde'; row-gap: 6px; }
  .vx-fila > .vx-sel { grid-area: sel; }
  .vx-fila > .vx-txt { grid-area: txt; }
  .vx-fila > .vx-donde { grid-area: donde; justify-content: flex-start; }
  .vx-fila > :last-child:not(.vx-donde):not(.vx-txt) { grid-area: icono; }
  .vx-cuentas { grid-column: 1 / -1; }
}
`;
