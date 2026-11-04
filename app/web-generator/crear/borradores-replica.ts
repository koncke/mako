// =============================================================================
// crear/borradores-replica — la pantalla habla con los borradores de una réplica (ticket #54, 4/11/2026)
// =============================================================================
// Lo leído para replicar queda como borrador del negocio (lib/editor-landing/replica-borrador.ts); esto es lo que piden la
// pantalla de replicar (./Replicar.tsx) y la lista de landings del editor (../editor/paneles/PanelLandings.tsx), con
// /api/landing-generator/replicar/borrador. Todo pedido con su plazo, y lo que no se pudo leer vuelve como null: la pantalla
// sigue como antes (lee la página), no se traba.
//
// SIN `'use client'` y sin estado: son funciones que se llaman desde un componente.
// =============================================================================

import { sanearBorrador, type BorradorReplica, type EleccionReplica, type ResumenBorrador } from '@/lib/editor-landing/replica-borrador';

const RUTA = '/api/landing-generator/replicar/borrador';
const PLAZO_MS = 8_000;

/** La pantalla de replicar guardó o descartó un borrador: la lista de landings lo vuelve a pedir. */
export const EVENTO_BORRADORES_REPLICA = 'gp-borradores-replica';
export const avisarBorradores = (): void => { try { window.dispatchEvent(new Event(EVENTO_BORRADORES_REPLICA)); } catch { /* sin ventana */ } };

/** El borrador de esa página, o null (no hay, o no se pudo leer: entonces se lee la página como siempre). */
export async function pedirBorrador(url: string): Promise<BorradorReplica | null> {
  try {
    const res = await fetch(`${RUTA}?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(PLAZO_MS), cache: 'no-store' });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; borrador?: unknown } | null;
    return j?.ok && j.borrador ? sanearBorrador(j.borrador, url) : null;
  } catch {
    return null;
  }
}

/** Las réplicas sin terminar del negocio, o null si no se pudieron leer (o no es el admin: no se dibuja nada). */
export async function pedirBorradores(): Promise<ResumenBorrador[] | null> {
  try {
    const res = await fetch(RUTA, { signal: AbortSignal.timeout(PLAZO_MS), cache: 'no-store' });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; borradores?: ResumenBorrador[] } | null;
    return j?.ok && Array.isArray(j.borradores) ? j.borradores : null;
  } catch {
    return null;
  }
}

/** Guarda lo elegido. `alSalir`: el pedido sobrevive a la pantalla que se cierra (keepalive). */
export async function guardarEleccion(url: string, eleccion: EleccionReplica, op: { alSalir?: boolean } = {}): Promise<boolean> {
  try {
    const res = await fetch(RUTA, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, eleccion }),
      ...(op.alSalir ? { keepalive: true } : { signal: AbortSignal.timeout(PLAZO_MS) }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; guardado?: boolean } | null;
    return !!j?.ok && j.guardado === true;
  } catch {
    return false;
  }
}

/** «Descartar»: borra el borrador de esa página. */
export async function descartarBorrador(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${RUTA}?url=${encodeURIComponent(url)}`, { method: 'DELETE', signal: AbortSignal.timeout(PLAZO_MS) });
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!j?.ok;
  } catch {
    return false;
  } finally {
    avisarBorradores();
  }
}
