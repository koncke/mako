// =============================================================================
// cerebro-areas — lo que el mapa de escritorio y el teléfono LEEN IGUAL de un Cerebro
// =============================================================================
// DATOS PUROS, como lib/cerebro-modelo.ts: sin `server-only`, sin 'use client' y sin nada
// que arrastre al bundle. Existe porque estas reglas vivían ADENTRO de
// app/second-brain/Grafo.tsx (un módulo 'use client' de 1.966 líneas) y el Second Brain del
// teléfono (app/m/second-brain) necesita las mismas: cuántos datos tiene cada área, qué nodo
// es estructura y no un dato, de qué color se pinta cada punto y qué documento se puede mirar.
// La regla de AGENTS.md («lo que se reusa de escritorio no puede vivir en un módulo use client:
// se muda a lib y escritorio lo re-exporta, nunca una copia en /m»).
//
// Grafo.tsx las importa (porArea, grados, rellenoDe, urlPreview, esImagen y sePuedeVer salen de
// acá desde el 15/10/2026): tests/m-second-brain.test.ts falla si vuelve a tener su copia.
// =============================================================================

import { colorArea, type AreaId, type AristaCerebro, type NodoCerebro } from './cerebro-modelo';

/** La raíz (el negocio), una carpeta madre (`n1:`) o la caja de un área (`area:`): no son DATOS. */
export function esEstructura(n: Pick<NodoCerebro, 'id'>): boolean {
  return n.id === 'raiz' || n.id.startsWith('n1:') || n.id.startsWith('area:');
}

/**
 * Cuántos datos REALES tiene cada área. No cuenta la estructura ni los pendientes: un «3 datos»
 * que incluye lo que falta miente sobre lo que hay (la regla de la columna «Tu negocio» del mapa).
 * Un área sin datos no aparece: quien dibuja escribe «falta», nunca un 0.
 */
export function contarPorArea(nodos: readonly NodoCerebro[]): Partial<Record<AreaId, number>> {
  const c: Partial<Record<AreaId, number>> = {};
  for (const n of nodos) {
    if (esEstructura(n) || n.autoria === 'pendiente') continue;
    c[n.area] = (c[n.area] ?? 0) + 1;
  }
  return c;
}

/** Cuántas aristas toca cada nodo (el «más conectado» va primero en una búsqueda). */
export function gradosDe(nodos: readonly NodoCerebro[], aristas: readonly AristaCerebro[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const n of nodos) g[n.id] = 0;
  for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
  return g;
}

/** El color del punto: la raíz en tinta, el cuello de botella en naranja, el Norte en dorado; el resto, el de su área. */
export function rellenoNodo(n: Pick<NodoCerebro, 'id' | 'area' | 'alerta' | 'destacado'>): string {
  if (n.id === 'raiz') return 'var(--ink)';
  if (n.alerta) return 'var(--warn-fill)';
  if (n.destacado) return 'var(--mako)';
  return colorArea(n.area);
}

/** El «todavía no existe»: el mismo punto, más apagado. Nunca un aro punteado. */
export const OPACIDAD_PENDIENTE = 0.5;

export const esImagenDocumento = (mime?: string | null): boolean => !!mime && mime.startsWith('image/');

/** Qué se puede mostrar en el navegador. Un .docx o un .xlsx se bajan: un «Ver» sobre ellos abre un visor vacío. */
export const sePuedeVerDocumento = (mime?: string | null): boolean =>
  esImagenDocumento(mime) || (!!mime && (mime.includes('pdf') || mime.startsWith('text/')));

/**
 * La ruta que redirige a una URL firmada para MIRAR un documento del Archivero (`doc:<id>`).
 * SIN el `?ws=`: lo pega quien la usa (`conWs`), porque un `<iframe>` o un `<a target=_blank>` no
 * pasan por el parche de fetch, y el super-admin mirando a un cliente recibiría «Archivo no encontrado».
 */
export function rutaVistaDocumento(idNodo: string): string {
  const id = idNodo.startsWith('doc:') ? idNodo.slice(4) : idNodo;
  return `/api/onboarding/archivero/download?id=${encodeURIComponent(id)}&preview=1`;
}
