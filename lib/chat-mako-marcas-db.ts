// =============================================================================
// Las marcas de la persona en los mensajes de SUS chats del Ops Center: reacciones, destacados, fijados y eliminados para
// ella (21/10/2026). Las reglas, las mismas del super admin: lib/centro-mensajes.ts.
// =============================================================================
// Martín: «no se puede dar click derecho como en SuperAdmin». El menú de un mensaje (MensajeWA.tsx) es el mismo, y sus
// marcas se guardan igual que las de Martín (lib/centro-mensajes-db.ts), pero en el workspace del NEGOCIO y por PERSONA:
// `mako.marcas.<persona>.<chat>`, con la persona de la sesión (su `chart_key`, nunca un parámetro) y el chat de la lista
// (`s<id>` una conversación con MaKo, `o<id>` una de Offer, `a<id>` una de antes). Así cruzan al teléfono, y lo que marca
// una persona no lo ve otra del mismo negocio.
// ⚠️ ESCRIBIR LEE ESTRICTO: si no puede leer lo que había, no escribe (pisaría las marcas con una sola).
// ⚠️ NO VAN AL CHAT: son de la persona. MaKo no las lee.

import 'server-only';
import { createHash } from 'node:crypto';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace } from './workspace';
import { SIN_MARCAS, aplicarMarca, sanearMarcas, type CambioMarca, type MarcasChat } from './centro-mensajes';

const PREFIJO = 'mako.marcas.';
/** El chat de la lista del Ops Center del cliente (lib/chat-mako-reglas.ts → FilaDelCliente.clave, sin el jefe virtual). */
const CHAT_RE = /^[soa]\d{1,12}$/;
export const esChatDeMarcas = (v: unknown): v is string => typeof v === 'string' && CHAT_RE.test(v);

/** La clave de app_settings: la huella de la persona (su `chart_key` tiene un email o un id) y el chat. */
function claveDe(chartKey: string, chat: string): string | null {
  if (!chartKey || !esChatDeMarcas(chat)) return null;
  return `${PREFIJO}${createHash('sha256').update(chartKey).digest('hex').slice(0, 24)}.${chat}`;
}

const parsear = (v: string | null): MarcasChat => { try { return v ? sanearMarcas(JSON.parse(v)) : SIN_MARCAS; } catch { return SIN_MARCAS; } };

/** Las marcas de un chat de la persona, para dibujarlo. Sin la base, ninguna. */
export async function leerMarcasDelChat(p: { ws: number; chartKey: string }, chat: string): Promise<MarcasChat> {
  const clave = claveDe(p.chartKey, chat);
  if (!clave) return SIN_MARCAS;
  try {
    return parsear(await runWithWorkspace(p.ws, () => getSetting(clave)));
  } catch {
    return SIN_MARCAS;
  }
}

/** Aplica un cambio sobre lo que hay y devuelve cómo quedó. */
export async function marcarEnElChat(p: { ws: number; chartKey: string }, chat: string, cambio: CambioMarca): Promise<MarcasChat> {
  const clave = claveDe(p.chartKey, chat);
  if (!clave) throw new Error('Falta el chat.');
  return runWithWorkspace(p.ws, async () => {
    const nuevas = aplicarMarca(parsear(await getSettingEstricto(clave)), cambio);
    await setSetting(clave, JSON.stringify(nuevas));
    return nuevas;
  });
}
