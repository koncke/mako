import 'server-only';
// =============================================================================
// LO QUE LA PERSONA LE MANDA A MaKo POR WHATSAPP SOBRE EL RETO (20/11/2026)
// =============================================================================
// La auditoría del 20/11 (wa-02, D1-12): «siempre escribe ella primero y MaKo le CONTESTA», y ningún código leía su mensaje. Dos
// mensajes son del reto y los contesta el código, como el pedido del código (lib/mako-grupo.ts, `responderPedidoV2`):
//   · la hora del día 2 («Hola MaKo, prefiero que me escribas a las 18:00 sobre el reto.»): se guarda en su reto (desde ahí MaKo le
//     escribe a esa hora, lib/reto/avisos-salida.ts) y MaKo le contesta «¡Hecho, {n}! Cada día te escribo a las 18:00…»;
//   · BAJA (lo ofrece el mensaje de Martín a quien deja el reto): ningún WhatsApp más del reto, y MaKo se lo confirma.
// Sólo en una línea de MaKo, y sólo de quien verificó su número por el onboarding V2 y tiene reto. Si no, null: el mensaje sigue
// al bot como cualquier otro. Lo que habla con WhatsApp va en `responder`, para correr después de contestarle al webhook.
// =============================================================================
import { getSupabaseServer } from '../supabase';
import { cambiarSettingSi } from '../settings';
import { runWithWorkspace } from '../workspace';
import { esNombreDeCanal } from '../mako-canal';
import { chatDelMensaje, esSuTelefono } from '../mako-bot-reglas';
import { enviarAPersonaMaKo } from '../mako-grupo';
import { CLAVE_RETO, HORAS_WA, leerEstado } from './dias';
import { CLAVE_AVISOS, RESPUESTA_BAJA, esBaja, horaDelMensaje, leerAvisos, respuestaDeLaHora } from './avisos';

const KEY_VERIFICACION = 'mako.contacto.verificacion';

type Verificada = { ws: number; nombre: string; linea: string | null };

/** El negocio de quien escribe: una verificación del V2 ya confirmada, con su número. */
async function negocioDe(telefono: string): Promise<Verificada | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value')
    .eq('key', KEY_VERIFICACION).ilike('value', '%"v2":true%').ilike('value', '%"verificado":true%').limit(500);
  if (error) { console.error(`[reto] no pude buscar de quién es ${telefono}: ${error.message}`); return null; }
  for (const f of (data ?? []) as Array<{ workspace_id: number; value: string }>) {
    try {
      const v = JSON.parse(f.value) as { telefono?: string; destino?: string; nombre?: string; linea?: string };
      if ([v.destino, v.telefono].some((t) => t && esSuTelefono(t, telefono))) return { ws: Number(f.workspace_id), nombre: v.nombre ?? '', linea: v.linea ?? null };
    } catch { /* una fila rota no es de nadie */ }
  }
  return null;
}

async function leerClave(ws: number, key: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as { value?: string | null } | null)?.value) ?? null;
}

export async function responderAlReto(instancia: string, m: Record<string, unknown>): Promise<{ resultado: string; responder?: () => Promise<void> } | null> {
  const key = (m?.key ?? {}) as { remoteJid?: string; fromMe?: boolean; remoteJidAlt?: string; senderPn?: string };
  if (key.fromMe) return null;
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  const texto = typeof msg.conversation === 'string' ? msg.conversation : String((msg.extendedTextMessage as { text?: string } | undefined)?.text ?? '');
  const baja = esBaja(texto);
  const hora = baja ? null : horaDelMensaje(texto, HORAS_WA);
  // Sin uno de los dos mensajes no se toca la base: por este webhook pasa todo el tráfico.
  if (!baja && !hora) return null;
  const chat = chatDelMensaje(key);
  if (!chat?.telefono) return null;
  const quien = await negocioDe(chat.telefono);
  if (!quien || !(esNombreDeCanal(instancia) || instancia === quien.linea)) return null;
  const { ws } = quien;
  const crudoReto = await leerClave(ws, CLAVE_RETO);
  const e = leerEstado(crudoReto);
  if (!e) return null;
  const destino = chat.telefono;

  if (baja) {
    const crudo = await leerClave(ws, CLAVE_AVISOS);
    const a = leerAvisos(crudo, e);
    if (!a.baja) {
      const gane = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_AVISOS, crudo, JSON.stringify({ ...a, baja: new Date().toISOString() })));
      if (!gane) return { resultado: `ws${ws}: BAJA ya anotada por otra llegada` };
    }
    return { resultado: `ws${ws}: BAJA del reto`, responder: async () => { await enviarAPersonaMaKo(destino, RESPUESTA_BAJA); } };
  }

  // La hora: se guarda en su reto (compare-and-set sobre lo leído: una tarea marcada en el medio no se pisa; se relee y se reintenta).
  let crudo = crudoReto, actual = e, gane = false;
  for (let i = 0; i < 3 && actual && !gane; i++) {
    if (i > 0) { crudo = await leerClave(ws, CLAVE_RETO); actual = leerEstado(crudo); if (!actual) break; }
    gane = actual.horaWa === hora || (await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_RETO, crudo, JSON.stringify({ ...actual!, horaWa: hora }))));
  }
  if (!gane) console.error(`[reto] ws${ws}: no pude guardar la hora ${hora} (cambió en el medio); igual le contesto`);
  return {
    resultado: `ws${ws}: la hora del reto, ${hora}`,
    responder: async () => {
      const r = await enviarAPersonaMaKo(destino, respuestaDeLaHora(quien.nombre, hora!));
      if (!r.ok) console.error(`[reto] ws${ws}: no salió la respuesta a la hora: ${r.error}`);
    },
  };
}
