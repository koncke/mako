// =============================================================================
// El muñeco de cada chat del Second Brain de un cliente (lógica pura, con test) — tanda 9, 16/10/2026
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md. Como en el Centro de Operaciones, cada chat tiene su muñeco (forma, color,
// cara: lib/centro-munecos.ts), y la persona lo cambia desde el «⋯» del chat. Por defecto sale del nombre (`aspectoDe`).
//
// ⚠️ SE GUARDA POR ID DE CONVERSACIÓN, NO POR NOMBRE (el Centro lo guarda por título): renombrar un chat no le cambia
//    la cara. Una fila por persona (`chats.munecos:<persona>`, lib/chat-munecos-db.ts): los chats son suyos.
// ⚠️ TOPE: PostgREST rechaza la fila desde ~8 KB, unos 90 muñecos. Pasado el tope se va el de la conversación más
//    VIEJA (el id más chico), nunca el que se acaba de elegir. No es «el elegido hace más tiempo»: un objeto de JS
//    ordena solas las claves que son números, así que el orden de elección no se puede guardar en el mapa.

import { sanearAspecto, type Aspecto } from './centro-munecos';

/** id de la conversación → su muñeco elegido. */
export type MunecosDeChats = Record<string, Aspecto>;
export const TOPE_MUNECOS_CHATS = 90;

const idValido = (k: string) => /^[1-9][0-9]{0,14}$/.test(k);
const porId = (a: string, b: string) => Number(a) - Number(b);

/** El mapa guardado, saneado: sólo ids de conversación y aspectos válidos; pasado el tope, los más nuevos. Nunca tira. */
export function sanearMunecosDeChats(v: unknown): MunecosDeChats {
  const out: MunecosDeChats = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const pares = Object.entries(v as Record<string, unknown>).filter(([k]) => idValido(k)).sort(([a], [b]) => porId(a, b));
  for (const [k, a] of pares.slice(-TOPE_MUNECOS_CHATS)) {
    const aspecto = sanearAspecto(a);
    if (aspecto) out[k] = aspecto;
  }
  return out;
}

/** El mapa con el muñeco de `sessionId` elegido o quitado (`null`: vuelve al de su nombre). */
export function conMunecoDeChat(m: Readonly<MunecosDeChats>, sessionId: number, aspecto: Aspecto | null): MunecosDeChats {
  const k = String(sessionId);
  const out: MunecosDeChats = { ...m };
  delete out[k];
  if (!aspecto) return out;
  out[k] = aspecto;
  const viejos = Object.keys(out).filter((id) => id !== k).sort(porId);
  while (Object.keys(out).length > TOPE_MUNECOS_CHATS && viejos.length) delete out[viejos.shift()!];
  return out;
}
