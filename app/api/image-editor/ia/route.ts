// =============================================================================
// POST /api/image-editor/ia — el chat «MaKo IA» del Image Editor
// =============================================================================
// POST json {instruccion, diseno, alcance} → { ok, resumen, operaciones, descartes } | { ok:false, error }
//
// El panel (app/image-editor/mako/chat/PanelMakoIA.tsx) manda lo que pidió la persona y la vista del diseño abierto
// (lib/image-editor/chat/vista.ts); vuelve una PROPUESTA (operaciones de lib/image-editor/chat/catalogo.ts) que la
// persona revisa y acepta en el editor. Esta ruta no escribe nada: el diseño lo guarda el editor, como siempre.
//
// La puerta es la del editor (`puerta` de lib/image-editor/server.ts: sesión, admin con la tab en su capa y un
// workspace). ⚠️ El workspace se exige ANTES de llamar a la IA: corre con la key DEL CLIENTE (la cascada gratis), y
// sin workspace cae al ws 1, que es un cliente.
//
// Va detrás de la sesión (NO está en lib/rutas-publicas.ts) y el proxy le exige Origin propio al POST.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { rateLimit } from '@/lib/rate-limit';
import { editarImagen } from '@/lib/image-editor/chat/ia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// La IA tiene 90 s (lib/image-editor/chat/ia.ts) y una reparación del JSON con aire.
export const maxDuration = 120;

const fallo = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  if (!rateLimit(`image-editor:ia:${p.ws}`, 30, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body !== 'object') return fallo('Pedido inválido.', 400);

  return runWithWorkspace(p.ws, async () => {
    const r = await editarImagen({ instruccion: body.instruccion, diseno: body.diseno, alcance: body.alcance });
    if (!r.ok) return fallo(r.error, r.status);
    return Response.json(r, { headers: { 'cache-control': 'no-store' } });
  });
}
