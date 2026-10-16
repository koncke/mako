// =============================================================================
// Dónde se guardan los muñecos de los chats del Second Brain (tanda 9, 16/10/2026)
// =============================================================================
// Una fila de `app_settings` por persona: `chats.munecos:<persona>` (la base `mako-movil:<persona>` de sus chats).
// Lo que decide —qué vale, el tope— está en lib/chat-munecos.ts (puro, con test).
//
// ⚠️ COMPARE-AND-SET: dos pestañas que cambian dos muñecos a la vez no se pisan. Se lee el valor crudo, se escribe sólo
//    si sigue siendo ése (`cambiarSettingSi`), y se reintenta; si pierde tres veces, tira.
// ⚠️ NUNCA SIN WORKSPACE: `app_settings` no está en TENANT_TABLES y lib/settings.ts, sin uno, cae al ws1 (el de
//    Mauricio). Todo corre adentro de `runWithWorkspace(ws)` con un ws válido.
// ⚠️ LECTURA ESTRICTA: «no pude leer» tira. Leerlo como «no hay muñecos» y escribir encima borraría los de los demás chats.

import 'server-only';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { runWithWorkspace } from './workspace';
import { conMunecoDeChat, sanearMunecosDeChats, type MunecosDeChats } from './chat-munecos';
import type { Aspecto } from './centro-munecos';

const VUELTAS = 3;
const clave = (persona: string) => `chats.munecos:${persona}`;

function validar(ws: number, persona: string): void {
  if (!Number.isInteger(ws) || ws <= 0) throw new Error('Los muñecos de los chats necesitan un workspace.');
  if (!persona.trim()) throw new Error('Los muñecos de los chats necesitan una persona.');
}

const leer = (crudo: string | null): MunecosDeChats => {
  if (!crudo) return {};
  try { return sanearMunecosDeChats(JSON.parse(crudo)); } catch { return {}; }
};

/** Los muñecos elegidos de los chats de una persona. Tira si no se pudo leer. */
export async function munecosDeChats(ws: number, persona: string): Promise<MunecosDeChats> {
  validar(ws, persona);
  return runWithWorkspace(ws, async () => leer(await getSettingEstricto(clave(persona))));
}

/**
 * Elige (o quita, con `null`) el muñeco de un chat y devuelve cómo quedaron todos. Quien llama ya miró que la
 * conversación es de esta persona.
 */
export async function ponerMunecoDeChat(ws: number, persona: string, sessionId: number, aspecto: Aspecto | null): Promise<MunecosDeChats> {
  validar(ws, persona);
  const k = clave(persona);
  return runWithWorkspace(ws, async () => {
    for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
      const crudo = await getSettingEstricto(k);
      const actual = leer(crudo);
      const nuevo = conMunecoDeChat(actual, sessionId, aspecto);
      const valor = JSON.stringify(nuevo);
      if (crudo != null && valor === JSON.stringify(actual)) return actual;
      if (await cambiarSettingSi(k, crudo, valor)) return nuevo;
    }
    throw new Error('Los muñecos cambiaron mientras se guardaban: prueba de nuevo.');
  });
}
