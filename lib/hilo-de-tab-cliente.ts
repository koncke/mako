// =============================================================================
// hilo-de-tab-cliente — leer y guardar la charla de un chat de edición de una tab (/api/hilo-de-tab), desde el navegador
// =============================================================================
// Lo usan «Editar con MaKo» (app/dashboard/PanelEditarMako.tsx) y el agente del Web Generator
// (app/web-generator/editor/paneles/PanelAgente.tsx). Las reglas de qué se guarda están en ./hilo-de-tab-reglas.ts.
//
// ⚠️ LOS GUARDADOS DE UNA MISMA CLAVE VAN EN FILA. La ruta sigue la charla más reciente o crea una: dos pedidos
//    simultáneos sobre una entidad sin charla crearían DOS (los dos ven «no hay» antes de que el otro la cree).
// ⚠️ GUARDAR NUNCA FRENA AL PANEL: si falla, lo dicho queda en pantalla igual y se avisa en la consola.

import type { FilaHilo } from './hilo-de-tab-reglas';

const RUTA = '/api/hilo-de-tab';
const fila = new Map<string, Promise<unknown>>();

/** La charla guardada de esa clave (los últimos mensajes). null = no se pudo leer (sin sesión, sin red). */
export async function leerHiloDeTab(clave: string, signal?: AbortSignal): Promise<FilaHilo[] | null> {
  try {
    const r = await fetch(`${RUTA}?clave=${encodeURIComponent(clave)}`, { signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null) as { mensajes?: unknown } | null;
    return Array.isArray(j?.mensajes) ? (j.mensajes as FilaHilo[]) : null;
  } catch { return null; }
}

/** Suma mensajes a la charla de esa clave (la crea con `titulo` si no hay). true = quedaron guardados. */
export function guardarEnHiloDeTab(clave: string, titulo: string, mensajes: readonly FilaHilo[], op: { siVacia?: boolean } = {}): Promise<boolean> {
  if (!mensajes.length) return Promise.resolve(true);
  const antes = fila.get(clave) ?? Promise.resolve();
  const este = antes.catch(() => null).then(async () => {
    try {
      const r = await fetch(RUTA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, titulo, mensajes, ...(op.siVacia ? { siVacia: true } : {}) }),
      });
      if (!r.ok) console.warn('[hilo-de-tab] no se guardó', clave, r.status);
      return r.ok;
    } catch (e) {
      console.warn('[hilo-de-tab] no se guardó', clave, e);
      return false;
    }
  });
  fila.set(clave, este);
  void este.finally(() => { if (fila.get(clave) === este) fila.delete(clave); });
  return este;
}
