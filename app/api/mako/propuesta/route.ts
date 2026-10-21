// =============================================================================
// /api/mako/propuesta — confirmar o descartar una propuesta ADENTRO del chat (el formulario de la tarjeta, la 1.10)
// =============================================================================
// POST { accion: 'confirmar', id, payload }  → ResultadoRevision
// POST { accion: 'descartar', id }           → ResultadoRevision
//
// Corre las MISMAS de /mako/revisar/<id> (`confirmarAccionAction`, `descartarAccionAction`): validan contra los
// `parametros`, miran que quien confirma sea el admin (`ctxDeBandeja`, con la sesión y el workspace del request) y
// preparan contra la base. La operación sale de la propuesta guardada, nunca del cuerpo.
// ⚠️ ES UNA RUTA PARA TENER SU PROPIO TECHO (revisión del 21/10/2026): por la server action, un trabajo largo (1.11) seguía
//    en `after()` con el techo de la PÁGINA del chat (60 s en /crm) y la plataforma lo cortaba. Acá, 420 s: el de la
//    tarjeta (app/api/mako/chat/route.ts) y el que espera `PLAZO_TRABAJO_MS` (lib/chat-trabajos.ts).
// =============================================================================

import { confirmarAccionAction, descartarAccionAction } from '@/app/mako/revisar/[id]/acciones';

export const dynamic = 'force-dynamic';
export const maxDuration = 420;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

export async function POST(req: Request) {
  let body: { accion?: unknown; id?: unknown; payload?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
  const id = typeof body.id === 'string' ? body.id : '';
  try {
    if (body.accion === 'confirmar') return json(await confirmarAccionAction(id, body.payload as Record<string, unknown>));
    if (body.accion === 'descartar') return json(await descartarAccionAction(id));
    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    console.error('[api/mako/propuesta]', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
  }
}
