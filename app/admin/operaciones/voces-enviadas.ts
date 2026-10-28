// =============================================================================
// Las notas de voz de los mensajes enviados (26/10/2026): por qué y cómo, en lib/operaciones-reglas.ts («Las notas de voz
// enviadas»). Lo dibuja VozEnviada.tsx.
// =============================================================================
// ⚠️ SIN 'use client' a propósito, como fotos-enviadas.ts: lo llama el motor (useCentro.ts), que no lleva la directiva, y
//    el menú del mensaje (Conversacion.tsx, ChatsMovil.tsx). Corre sólo en el navegador.
//
// De dónde sale el audio de una burbuja, en este orden:
//   1. la memoria de este navegador: lo que grabó en esta carga (se escucha en el acto);
//   2. el SERVIDOR: el MP3 que subió el navegador que la grabó, con una URL firmada de 10 minutos. Lo pide el MISMO pedidor
//      de las fotos (fotos-remotas.ts): junta las burbujas que piden a la vez, y lo que todavía no subió se cree poco.
// Sin ninguno de los dos (la subida falló, o pasaron 14 días), la burbuja dice la transcripción.

import { crearPedidorDeFotos } from './fotos-remotas';

const grabadas = new Map<string, string>();

const servidor = crearPedidorDeFotos(async (ids) => {
  try {
    const r = await fetch(`/api/operaciones/adjuntos?voces=${ids.map(encodeURIComponent).join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const o = (await r.json()) as { ok?: boolean; voces?: Record<string, { url: string; nombre: string }[]> };
    return r.ok && o.ok && o.voces && typeof o.voces === 'object' ? o.voces : null;
  } catch { return null; }
});

/**
 * Lo llama el motor (useCentro.ts → mandar) apenas el trabajo salió: la nota se escucha en el acto en este navegador, y
 * su MP3 sube al servidor para escucharla en otro dispositivo. Si la subida falla, no se avisa: allá se lee su
 * transcripción, como antes.
 */
export function recordarVozEnviada(id: string, audio: Blob) {
  grabadas.set(id, URL.createObjectURL(audio));
  void fetch(`/api/operaciones/adjuntos?voz=${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'content-type': 'audio/mpeg' }, body: audio, signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
}

/** La nota de un mensaje que todavía está SALIENDO (27/10/2026): se escucha en el acto con el id local, sin subir nada (la
 *  grabación tal cual; el MP3 sube con el id de verdad, `recordarVozEnviada`). */
export function verVozLocal(id: string, audio: Blob) {
  grabadas.set(id, URL.createObjectURL(audio));
}

/** El audio de una nota que ya se sabe sin preguntar (undefined = todavía no; null = el servidor no lo tiene). */
export function vozYaLeida(id: string): string | null | undefined {
  const local = grabadas.get(id);
  if (local) return local;
  const ya = servidor.yaSabidas(id);
  return ya ? ya[0]?.url ?? null : undefined;
}

/** El audio de una nota: el de este navegador o el del servidor (null = no lo tiene). */
export async function leerVozEnviada(id: string): Promise<string | null> {
  return grabadas.get(id) ?? (await servidor.pedir(id, 1))[0]?.url ?? null;
}

// ── La transcripción, en el menú del mensaje («Ver transcripción») ─────────────────────────────────────────────────
// Se abre debajo del reproductor. Qué nota la tiene abierta vive acá (y no en la burbuja) porque la abre el MENÚ, que es
// de la conversación: la burbuja la lee con `useSyncExternalStore`.
const abiertas = new Set<string>();
const oyentes = new Set<() => void>();
export const transcripcionAbierta = (id: string): boolean => abiertas.has(id);
export function alternarTranscripcion(id: string) {
  if (abiertas.has(id)) abiertas.delete(id); else abiertas.add(id);
  for (const o of oyentes) o();
}
export function escucharTranscripciones(o: () => void): () => void {
  oyentes.add(o);
  return () => { oyentes.delete(o); };
}
