// =============================================================================
// ficha/historial — quién cambió la ficha de un CRM, qué, y cómo estaba antes (17/10/2026)
// =============================================================================
// Hasta el 17/10/2026 la configuración de la ficha (`funnels.data.ficha`) no dejaba rastro: `cambiarFichaFunnelAction`
// escribía un `console.info` con el autor y nada más (docs/relevo/crm-tanda-b1.md, b1), así que un cambio de MaKo o
// de otro admin no tenía quién ni vuelta atrás fuera del «Deshacer» de esa misma pestaña.
//
// ⚠️ VIVE EN EL MISMO `data` DEL FUNNEL (`data.fichaHistorial`), NO EN UNA TABLA: se escribe en el MISMO update
//    compare-and-set que la ficha (`cambiarFichaDeFunnel`, lib/ficha/config-server.ts), así que no hay un cambio sin su
//    línea ni una línea sin su cambio, y no hace falta migración ni una tabla más de inquilino. Con TOPE: las últimas
//    `TOPE_HISTORIAL_FICHA` (lo de antes de cada una es una foto de la ficha guardada, unos pocos KB).
// ⚠️ PURO (sin server-only): lo ejecutan los tests y lo lee la pantalla.
// =============================================================================

import { sanearFicha, type FichaGuardada } from './config';

export const TOPE_HISTORIAL_FICHA = 20;

/** Un cambio de la ficha: cuándo, quién, qué (la frase de `describirCambio`) y cómo estaba la ficha justo antes. */
export type EntradaHistorialFicha = { at: string; autor: string; que: string; antes: FichaGuardada };

const texto = (v: unknown, tope: number): string => (typeof v === 'string' ? v.trim().slice(0, tope) : '');

/** Lo guardado, saneado: lo que no se entiende se descarta (nunca tira). La más nueva primero. */
export function sanearHistorial(raw: unknown): EntradaHistorialFicha[] {
  if (!Array.isArray(raw)) return [];
  const out: EntradaHistorialFicha[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const at = texto(o.at, 40);
    if (!at || !Number.isFinite(Date.parse(at))) continue;
    out.push({ at, autor: texto(o.autor, 120) || 'Alguien', que: texto(o.que, 300) || 'Un cambio', antes: sanearFicha(o.antes) });
    if (out.length >= TOPE_HISTORIAL_FICHA) break;
  }
  return out;
}

/** La lista con una entrada nueva ARRIBA, y con el tope. */
export function conEntrada(raw: unknown, e: EntradaHistorialFicha): EntradaHistorialFicha[] {
  return [e, ...sanearHistorial(raw)].slice(0, TOPE_HISTORIAL_FICHA);
}
