// =============================================================================
// api-mako/tokens-uso — «¿este token se usa?», anotado al autenticar
// =============================================================================
// La pantalla de API lista los tokens vivos de un workspace, y la pregunta que
// decide si uno se revoca es si alguien lo está usando. `api_llamadas` no sirve para
// eso: no guarda QUÉ token pidió (y sumarle la columna es una migración), y además
// sólo ve /api/v1 — la skill de Claude habla casi todo por /api/agente.
//
// Por eso se anota acá, en el momento en que un token resuelve a un workspace, con
// un FRENO: una escritura cada diez minutos por token y por instancia. Sin el freno
// serían hasta 120 escrituras por minuto en `app_settings` por un dato que se lee
// con precisión de «hace un rato».
//
// Vive aparte de tokens.ts porque lo llaman los DOS resolvedores (el de /api/v1 y el
// del principal, en lib/agente-token.ts), y agente-token no puede importar tokens.ts
// sin armar un ciclo.
//
// Best-effort: nunca tira, nunca demora la respuesta.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';
import { API_TOKENS_USO_KEY, parsearUsos } from './tokens-lista';

const CADA_MS = 10 * 60_000;
const ultimo = new Map<string, number>();

/** Anota que el token `id` del workspace `ws` se acaba de usar. */
export function marcarUso(ws: number, id: string): void {
  const k = `${ws}:${id}`;
  const ahora = Date.now();
  if ((ultimo.get(k) ?? 0) > ahora - CADA_MS) return;
  if (ultimo.size > 5000) ultimo.clear();
  ultimo.set(k, ahora);
  void runWithWorkspace(ws, async () => {
    const usos = parsearUsos(await getSetting(API_TOKENS_USO_KEY));
    usos[id] = new Date(ahora).toISOString();
    await setSetting(API_TOKENS_USO_KEY, JSON.stringify(usos));
  }).catch((e) => console.error(`[api-mako] no pude anotar el uso del token ${id} (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`));
}

/** Saca un id del mapa de usos (al revocar). Best-effort. */
export async function olvidarUso(ws: number, id: string): Promise<void> {
  try {
    await runWithWorkspace(ws, async () => {
      const usos = parsearUsos(await getSetting(API_TOKENS_USO_KEY));
      if (!(id in usos)) return;
      delete usos[id];
      await setSetting(API_TOKENS_USO_KEY, JSON.stringify(usos));
    });
  } catch (e) {
    console.error(`[api-mako] no pude borrar el uso del token ${id} (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
  }
  ultimo.delete(`${ws}:${id}`);
}
