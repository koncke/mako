// =============================================================================
// hilo-guardado — la conversación de «Editar con MaKo» queda en la BASE y sobrevive a recargar (puro)
// =============================================================================
// 17/10/2026: se guardaba en el NAVEGADOR (localStorage `mako.editar-con-mako.hilos.<informe>`), por informe y por hoja.
// 22/10/2026 (Martín: «¿Todos esos chats regresan y se quedan registrados en Ops Center?»): pasa a `chart_sessions` con la
// clave `dashboard:<hoja>` (lib/hilo-de-tab-reglas.ts, /api/hilo-de-tab), así se ve en el Ops Center como «de antes» y
// otra computadora la encuentra. Lo del navegador se sube UNA vez y se borra (`hilosGuardados` lo lee, EditorInforme.tsx).
//
// ⚠️ LO QUE SE GUARDA ES LIVIANO A PROPÓSITO: sin las hojas de antes y de después de cada cambio (`antes`/`aplicada`, una
// hoja entera cada una). Después de recargar, un «Deshacer» de antes no se ofrece: la hoja ya se guardó con ese cambio y el
// deshacer del editor es el que manda. Tampoco las burbujas de «pedido» (apuntan a una hoja o una tab de ESA sesión).
// ⚠️ UN MENSAJE DE MaKo ES UN SOLO TEXTO EN LA BASE (lo que dibuja el Ops Center): lo que cambió va en renglones «• …» y
//    los avisos en «Ojo: …», y al volver se separan de nuevo (`hiloDeFilas`).
// =============================================================================

import type { MensajeEdicion } from './PanelEditarMako';
import { filaDeError, textoDeError, type FilaHilo } from '@/lib/hilo-de-tab-reglas';

/** La clave VIEJA de `localStorage`, por informe («dashboard», «general»): sólo se lee para subirla a la base. */
export const CLAVE_HILOS = (informe: string): string => `mako.editar-con-mako.hilos.${informe}`;
/** Cuántos mensajes por hoja (los últimos) y cuántas hojas se leían del navegador. */
export const TOPE_MENSAJES = 30;
export const TOPE_HOJAS = 20;

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 300)) : []);

const CAMBIO = '• ';
const AVISO = 'Ojo: ';

/** Los mensajes de un hilo como se guardan en la base. Las burbujas de pedido no se guardan. */
export function filasDeHilo(hilo: readonly MensajeEdicion[]): FilaHilo[] {
  return hilo.flatMap((m): FilaHilo[] => {
    if (m.k === 'yo') return m.texto.trim() ? [{ role: 'user', content: m.texto }] : [];
    if (m.k === 'error') return [filaDeError(m.texto)];
    if (m.k === 'el') {
      const content = [m.texto.trim(), ...m.cambios.map((c) => `${CAMBIO}${c}`), ...m.avisos.map((a) => `${AVISO}${a}`)].filter(Boolean).join('\n');
      return [{ role: 'assistant', content: content || 'Sin cambios.' }];
    }
    return [];
  });
}

/** Lo guardado en la base, de vuelta como hilo del panel. */
export function hiloDeFilas(filas: readonly FilaHilo[]): MensajeEdicion[] {
  return filas.flatMap((f): MensajeEdicion[] => {
    const c = typeof f?.content === 'string' ? f.content : '';
    if (!c) return [];
    if (f.role === 'user') return [{ k: 'yo', texto: c }];
    const err = textoDeError(c);
    if (err != null) return [{ k: 'error', texto: err }];
    const renglones = c.split('\n');
    const cambios = renglones.filter((r) => r.startsWith(CAMBIO)).map((r) => r.slice(CAMBIO.length));
    const avisos = renglones.filter((r) => r.startsWith(AVISO)).map((r) => r.slice(AVISO.length));
    const resto = renglones.filter((r) => !r.startsWith(CAMBIO) && !r.startsWith(AVISO)).join('\n').trim();
    return [{ k: 'el', texto: resto, cambios, avisos }];
  });
}

/** Lo que quedó en el navegador de antes del 22/10, saneado (puede estar roto o ser de otra versión). Vacío si no sirve. */
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

/** El título de la charla en el Ops Center. */
export const tituloDeHoja = (nombre: string | null | undefined): string => `Editar con MaKo · ${(nombre ?? '').trim() || 'Hoja'}`;
