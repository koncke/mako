'use client';

// =============================================================================
// Lo que la persona ya vio (los recorridos y la guía de cada pestaña): UNA lectura por página (29/10/2026)
// =============================================================================
// La mitad «visto» de los recorridos (./Recorrido.tsx → useRecorrido), para quien necesita VARIAS marcas a la vez: la guía
// (lib/guia/primera-vez.ts) mira la de su tab, la del recorrido viejo que la reemplaza y cuántos «Ya sé usarla» lleva. La misma
// ruta (/api/recorridos: por PERSONA, la fila de la sesión) y el mismo respaldo en el navegador, con la huella de la persona
// (lib/recorridos.ts → claveLocal). ⚠️ MIENTRAS NO SE SABE, `null`: con null nadie pregunta (aparecería un instante).

import { useSyncExternalStore } from 'react';
import { PREFIJO_LOCAL, claveLocal, idRecorridoValido, quienValido } from '@/lib/recorridos';

let vistos: ReadonlySet<string> | null = null;
let quien: string | null = null;
let pedido = false;
const oyentes = new Set<() => void>();
const avisar = () => { for (const f of oyentes) f(); };

/** Lo que recuerda este navegador DE ESTA PERSONA (las claves llevan su huella). */
function locales(q: string): string[] {
  const pre = `${PREFIJO_LOCAL}${q}.`;
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(pre) && idRecorridoValido(k.slice(pre.length))) out.push(k.slice(pre.length));
    }
  } catch { /* bloqueado: queda el server */ }
  return out;
}

async function leer(): Promise<void> {
  try {
    const r = await fetch('/api/recorridos', { cache: 'no-store' });
    const j = await r.json().catch(() => null) as { ok?: boolean; guardado?: boolean; vistos?: unknown; quien?: unknown } | null;
    quien = quienValido(j?.quien) ? j!.quien as string : null;
    const local = quien ? locales(quien) : [];
    if (r.ok && j?.ok && j.guardado && Array.isArray(j.vistos)) {
      const delServer = j.vistos.filter((x): x is string => typeof x === 'string');
      vistos = new Set([...delServer, ...local]);
      // Lo que vio en este navegador con la base caída: se le manda, o en otra computadora vuelve a preguntar.
      for (const id of local) if (!delServer.includes(id)) mandar(id);
    } else {
      // Sin fila propia o con la base caída: decide lo del navegador, si se sabe de quién. Si no, no se sabe (null).
      vistos = quien ? new Set(local) : null;
    }
  } catch {
    vistos = null;
  }
  avisar();
}

function mandar(id: string): void {
  try {
    void fetch('/api/recorridos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
  } catch { /* sin red: queda lo local */ }
}

function suscribir(f: () => void): () => void {
  oyentes.add(f);
  if (!pedido) { pedido = true; void leer(); }
  return () => { oyentes.delete(f); };
}

/** Las marcas que ya tiene la persona (null mientras no se sabe; en el server, null). */
export function useVistos(): ReadonlySet<string> | null {
  return useSyncExternalStore(suscribir, () => vistos, () => null);
}
export const vistosAhora = (): ReadonlySet<string> | null => vistos;

/** Marca como vistas (en el acto, en el navegador y en la base). */
export function marcarVistos(ids: readonly string[]): void {
  const validos = ids.filter((id) => idRecorridoValido(id));
  if (!validos.length) return;
  vistos = new Set([...(vistos ?? []), ...validos]);
  for (const id of validos) {
    try { window.localStorage.setItem(claveLocal(id, quien), new Date().toISOString()); } catch { /* modo privado */ }
    mandar(id);
  }
  avisar();
}
