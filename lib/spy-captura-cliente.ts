// =============================================================================
// El lado de la pantalla de «Capturar» en «Sus páginas»: pedirle a la extensión que abra la página (4/11/2026)
// =============================================================================
// Todo por eventos del DOM, como el resto del puente (extension/mako-puente.js): la extensión no tiene un id fijo antes de la
// tienda. La pantalla pide `MAKO_SPY_CAPTURAR_PIDO` con un `id`; el puente contesta `MAKO_SPY_CAPTURA` con el mismo `id` (dos
// pedidos en vuelo no se pisan); y cuando la persona capturó (o cerró la pestaña), llega `MAKO_SPY_CAPTURA_TERMINO`.
//
// Sin `server-only` y sin React: lo prueban los tests con una ventana de mentira.
// =============================================================================

import { esMasVieja } from './version-comparar';
import { VERSION_CAPTURA } from './spy-pagina-capturada';

/** Lo mínimo para hablar con el puente: lo que tiene `window` y lo que tiene `document.documentElement`. */
export type VentanaPuente = {
  addEventListener: (tipo: string, fn: (e: Event) => void) => void;
  removeEventListener: (tipo: string, fn: (e: Event) => void) => void;
  dispatchEvent: (e: Event) => boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (t: never) => void;
};

/** ¿Hay extensión, y sabe capturar? Lee el atributo que pone el puente en <html>. */
export function extensionCaptura(version: string | null | undefined): 'si' | 'vieja' | 'no' {
  if (!version) return 'no';
  return esMasVieja(version, VERSION_CAPTURA) ? 'vieja' : 'si';
}

/** Cuánto se espera a que el puente conteste que abrió la página. Abrir una pestaña es inmediato: sin respuesta, no hay puente. */
export const ESPERA_PUENTE_MS = 6_000;

export type RespuestaCaptura = { ok: true } | { ok: false; motivo: string };

/** Le pide a la extensión que abra la página del competidor a la vista. Contesta cuando la abrió (o por qué no). */
export function pedirCaptura(v: VentanaPuente, competidorId: number, url: string, esperaMs = ESPERA_PUENTE_MS): Promise<RespuestaCaptura> {
  return new Promise((resolve) => {
    const id = `c${Date.now()}${Math.random()}`;
    let listo = false;
    const fin = (r: RespuestaCaptura) => {
      if (listo) return;
      listo = true;
      v.removeEventListener('MAKO_SPY_CAPTURA', al);
      v.clearTimeout(t as never);
      resolve(r);
    };
    const al = (e: Event) => {
      const d = (e as CustomEvent).detail as { id?: unknown; ok?: unknown; motivo?: unknown } | null;
      if (!d || d.id !== id) return;
      fin(d.ok === true ? { ok: true } : { ok: false, motivo: typeof d.motivo === 'string' ? d.motivo : 'extension' });
    };
    v.addEventListener('MAKO_SPY_CAPTURA', al);
    const t = v.setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), esperaMs);
    v.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURAR_PIDO', { detail: { id, competidorId, url } }));
  });
}

export type FinDeCaptura = { competidorId: number; url: string; lista: boolean; cerrada: boolean };

/** Avisa cuando la persona capturó la página (o cerró su pestaña sin capturar). Devuelve cómo dejar de escuchar. */
export function alTerminarCaptura(v: Pick<VentanaPuente, 'addEventListener' | 'removeEventListener'>, fn: (f: FinDeCaptura) => void): () => void {
  const al = (e: Event) => {
    const d = (e as CustomEvent).detail as Partial<FinDeCaptura> | null;
    if (!d || typeof d.competidorId !== 'number' || typeof d.url !== 'string') return;
    fn({ competidorId: d.competidorId, url: d.url, lista: d.lista === true, cerrada: d.cerrada === true });
  };
  v.addEventListener('MAKO_SPY_CAPTURA_TERMINO', al);
  return () => v.removeEventListener('MAKO_SPY_CAPTURA_TERMINO', al);
}
