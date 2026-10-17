// =============================================================================
// Lo que está haciendo un chat AHORA: los pasos de su turno abierto (17/10/2026, la E; puro, con test)
// =============================================================================
// Martín (feedback del 17/10, su punto 1): «mientras un chat trabaja, una animación con los pasos de su turno en vivo, como
// Claude». La PC lee la cola del transcript de cada chat ocupado y sube sus últimos pasos: el nombre de la herramienta y,
// del Bash, su `description` (la frase corta que el modelo le pone a cada comando). NADA del contenido: ni el comando, ni
// lo que leyó, ni lo que escribió (scripts/operaciones/cartero.mjs → pasosDeLineas, el mismo molde que acá).
// Llegan con `vigilar` cada ~15 s, por un POST liviano (`?pasos=1`), y se guardan por cuenta (lib/centro-pasos-db.ts).
// ⚠️ SIN `server-only`: lo leen el servidor, la pantalla y los tests.

import { DESTINO_RE } from './operaciones-reglas';

export type PasoDelTurno = { at: string; texto: string };
export type PasosPorChat = Record<string, PasoDelTurno[]>;

/** Los que se muestran de un chat: los últimos. */
export const PASOS_POR_CHAT = 6;
export const MAX_TEXTO_PASO = 90;
/** Lo que subió una PC hace más que esto ya no es «ahora» (el chat terminó, o la PC se durmió). */
export const PASOS_VIGENTES_MS = 90_000;

const ISO = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

/** Lo que subió una PC, validado: sesiones de verdad, pasos cortos y sin caracteres de control, los últimos. */
export function sanearPasos(x: unknown): PasosPorChat {
  const out: PasosPorChat = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const [local, lista] of Object.entries(x as Record<string, unknown>).slice(0, 60)) {
    if (!DESTINO_RE.test(local) || !Array.isArray(lista)) continue;
    const pasos = lista.flatMap((p): PasoDelTurno[] => {
      if (!p || typeof p !== 'object') return [];
      const o = p as Record<string, unknown>;
      const at = ISO(o.at);
      const texto = typeof o.texto === 'string' ? o.texto.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO_PASO) : '';
      return at && texto ? [{ at, texto }] : [];
    }).slice(-PASOS_POR_CHAT);
    if (pasos.length) out[local] = pasos;
  }
  return out;
}

/** Lo de todas las cuentas, junto: sólo lo que se subió hace poco. `registros`: lo guardado por cada cuenta. */
export function pasosVigentes(registros: readonly ({ at: string; pasos: PasosPorChat } | null)[], ahora: number): PasosPorChat {
  const out: PasosPorChat = {};
  for (const r of registros) {
    if (!r || ahora - Date.parse(r.at) > PASOS_VIGENTES_MS) continue;
    for (const [local, pasos] of Object.entries(r.pasos)) out[local] = pasos;
  }
  return out;
}

/** Los pasos de un chat (de cualquiera de sus sesiones), el más viejo primero. */
export const pasosDelChat = (c: { miembros: readonly string[] }, pasos: Readonly<PasosPorChat>): PasoDelTurno[] =>
  c.miembros.flatMap((m) => pasos[m] ?? []).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-PASOS_POR_CHAT);
