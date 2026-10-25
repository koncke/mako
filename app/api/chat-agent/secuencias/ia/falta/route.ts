// =============================================================================
// POST /api/chat-agent/secuencias/ia/falta — «Pedírselo al equipo»: lo que MaKo dijo que no está, a la Ticketera (24/10/2026)
// =============================================================================
// f23 de la llamada con Leandro (app/automations/PedirAlEquipo.tsx). Un PEDIDO (`tipo: 'pedido'`, `noExiste`), como el que
// propone `levantar_ticket` en el chat del Ops Center.
// ⚠️ LO QUE SE ESCRIBE SALE DEL CHAT GUARDADO, no del body (`ticketDeLaFalta`): el body sólo dice cuál es. Una falta que MaKo
//    no dijo en el chat de ESA automatización no levanta nada.
// ⚠️ LA MISMA PUERTA QUE EL CHAT (../route.ts, `adminDelWs`): el workspace y el rol de la sesión. Del mismo origen, como
//    /api/soporte/reportar. Y la misma falta es UN ticket (`refDeLaFalta`): tocar dos veces devuelve el mismo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { leerChat } from '@/lib/automatizacion-chat-db';
import { crearTicket, identidadDe } from '@/lib/tickets-db';
import { TOPE_FALTA } from '@/lib/automatizacion-chat';
import { refDeLaFalta, ticketDeLaFalta } from '@/app/automations/pedir-al-equipo';

export const dynamic = 'force-dynamic';

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return json({ ok: false, error: 'No salió de MaKo' }, 403);
  const [s, ws, rol] = await Promise.all([getUsuarioActual(), getWorkspaceActual(), getRolWsEfectivo()]);
  if (!s?.email?.includes('@') || ws == null || rol !== 'admin') return json({ ok: false, error: 'Solo el administrador del negocio puede mandarlo.' }, 403);
  let body: { secuenciaId?: unknown; falta?: unknown } = {};
  try { body = ((await req.json()) ?? {}) as typeof body; } catch { return json({ ok: false, error: 'No entendí el pedido' }, 400); }
  const secuenciaId = Number(body.secuenciaId);
  const falta = typeof body.falta === 'string' ? body.falta.slice(0, TOPE_FALTA * 2) : '';
  if (!Number.isInteger(secuenciaId) || secuenciaId <= 0 || !falta.trim()) return json({ ok: false, error: 'No sé qué pasarle al equipo' }, 400);
  try {
    // El nombre de la automatización, en la base de ESTE negocio (como ../route.ts): si no es suya, no hay chat que leer.
    const { data: sec, error } = await (await getTenantDb()).from('nutricion_secuencias').select('id, nombre').eq('id', secuenciaId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!sec) return json({ ok: false, error: 'Esa automatización no es de este negocio' }, 404);
    const chat = await leerChat(ws, secuenciaId);
    const t = ticketDeLaFalta(chat.mensajes, falta, { id: secuenciaId, nombre: String((sec as { nombre?: unknown }).nombre ?? '') });
    if (!t) return json({ ok: false, error: 'No encontré lo que dijo MaKo: vuelve a preguntarle' }, 404);
    const email = s.email.trim().toLowerCase();
    const creado = await crearTicket({
      identidad: await identidadDe(ws, email, s.nombre ?? ''),
      tipo: 'pedido', declaradoPor: 'persona',
      titulo: t.titulo, descripcion: t.descripcion, canal: 'chat_app', contexto: t.contexto, ref: refDeLaFalta(ws, secuenciaId, falta),
    });
    if (!creado.ok) return json({ ok: false, error: creado.error });
    return json({ ok: true, id: creado.id, yaExistia: creado.yaExistia });
  } catch (e) {
    console.error(`[api:secuencias/ia/falta] ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: 'No pude mandarlo: vuelve a tocar en un rato' }, 500);
  }
}
