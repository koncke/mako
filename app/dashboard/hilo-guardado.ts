// =============================================================================
// hilo-guardado — la conversación de «Editar con MaKo» sobrevive a recargar la página (17/10/2026; puro)
// =============================================================================
// docs/relevo/dashboard.md, «Lo de antes que sigue abierto»: «el hilo de "Editar con MaKo" no se guarda». Vivía en el
// estado del editor (`hilosMako`, EditorInforme.tsx): cerrar y abrir el panel lo conservaba, recargar lo perdía. Se guarda
// en el NAVEGADOR (es una comodidad de quien lo mira, no un dato del negocio), por informe y por hoja, y se lee después de
// montar (si no, el primer dibujo del server y el del navegador no coinciden).
//
// ⚠️ LO QUE SE GUARDA ES LIVIANO A PROPÓSITO: sin las hojas de antes y de después de cada cambio (`antes`/`aplicada`, una
// hoja entera cada una). Después de recargar, un «Deshacer» de antes no se ofrece: la hoja ya se guardó con ese cambio y el
// deshacer del editor es el que manda. Tampoco las burbujas de «pedido» (apuntan a una hoja o una tab de ESA sesión).
// =============================================================================

import type { MensajeEdicion } from './PanelEditarMako';

/** La clave de `localStorage`, por informe («dashboard», «general»). */
export const CLAVE_HILOS = (informe: string): string => `mako.editar-con-mako.hilos.${informe}`;
/** Cuántos mensajes por hoja (los últimos) y cuántas hojas: el navegador tiene ~5 MB para todo el sitio. */
export const TOPE_MENSAJES = 30;
export const TOPE_HOJAS = 20;

type Liviano = Extract<MensajeEdicion, { k: 'yo' | 'el' | 'error' }>;

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 300)) : []);

/** Un mensaje como se guarda (o null si no se guarda). */
function liviano(m: MensajeEdicion): Liviano | null {
  if (m.k === 'yo') return { k: 'yo', texto: m.texto.slice(0, 2000) };
  if (m.k === 'error') return { k: 'error', texto: m.texto.slice(0, 600), ...(m.link ? { link: m.link } : {}) };
  if (m.k === 'el') return { k: 'el', texto: m.texto.slice(0, 2000), cambios: m.cambios.slice(0, 20), avisos: m.avisos.slice(0, 20), ...(m.deshecho ? { deshecho: true } : {}), ...(m.analizar ? { analizar: true } : {}) };
  return null;
}

/** Los hilos para guardar: livianos, los últimos de cada hoja, sin hojas vacías. */
export function hilosParaGuardar(hilos: Readonly<Record<string, readonly MensajeEdicion[]>>): Record<string, Liviano[]> {
  const out: Record<string, Liviano[]> = {};
  for (const [hoja, ms] of Object.entries(hilos).slice(-TOPE_HOJAS)) {
    const l = ms.map(liviano).filter((x): x is Liviano => !!x).slice(-TOPE_MENSAJES);
    if (l.length) out[hoja] = l;
  }
  return out;
}

/** Lo guardado, saneado (vino del navegador: puede estar roto o ser de otra versión). Vacío si no sirve. */
export function hilosGuardados(raw: string | null | undefined): Record<string, MensajeEdicion[]> {
  if (!raw) return {};
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return {}; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out: Record<string, MensajeEdicion[]> = {};
  for (const [hoja, ms] of Object.entries(o as Record<string, unknown>).slice(-TOPE_HOJAS)) {
    if (!Array.isArray(ms)) continue;
    const l = ms.flatMap((m): MensajeEdicion[] => {
      if (!m || typeof m !== 'object') return [];
      const x = m as Record<string, unknown>;
      if (x.k === 'yo' && texto(x.texto, 2000)) return [{ k: 'yo', texto: texto(x.texto, 2000) }];
      if (x.k === 'error' && texto(x.texto, 600)) return [{ k: 'error', texto: texto(x.texto, 600), ...(typeof x.link === 'string' && x.link.startsWith('/') ? { link: x.link } : {}) }];
      if (x.k === 'el') return [{ k: 'el', texto: texto(x.texto, 2000), cambios: lista(x.cambios), avisos: lista(x.avisos), ...(x.deshecho === true ? { deshecho: true } : {}), ...(x.analizar === true ? { analizar: true } : {}) }];
      return [];
    }).slice(-TOPE_MENSAJES);
    if (l.length) out[hoja] = l;
  }
  return out;
}
