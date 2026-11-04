// =============================================================================
// /api/competitor-spy/transcribir — el guion de un reel, transcripto solo al abrir su detalle (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «En cada uno de los videos cuando entro no estás trayendo la transcripción… hacé que se
// pida sola en segundo plano, con "Transcribiendo" mientras tanto». La pantalla llama esto al abrir el detalle de una pieza:
// contesta en el acto con lo que hay (o «transcribiendo») y el trabajo sigue en un `after()` (lib/spy-transcripcion.ts). La
// pantalla vuelve a preguntar hasta que queda.
//
//   POST { piezaId } → { ok, guion: VistaGuion }
//
// ⚠️ LA IA ES LA DEL NEGOCIO, adentro de `conSuIADelNegocio` (D6b), y el video lo pide la clave de Spy del negocio con su tope
// del día. Sin una o la otra no se reclama nada y la pantalla dice cuál falta.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { claveDeIAPropia, conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { cheapDisponible } from '@/lib/ai-cheap';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { asegurarGuion } from '@/lib/spy-transcripcion-servidor';
import { tieneClaveDeSpy } from '@/lib/spy-todo';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Traer el video (hasta 100 s), bajarlo y escucharlo. */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // La misma puerta que la pantalla (`requireRolWs([], { nav: 'market-an' })`): esto gasta la IA y la clave del negocio.
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const cuerpo = (await req.json().catch(() => ({}))) as { piezaId?: unknown };
  const piezaId = Number(cuerpo.piezaId);
  if (!Number.isInteger(piezaId) || piezaId <= 0) return Response.json({ ok: false, error: 'Falta la pieza.' }, { status: 400 });

  const hayIA = (await claveDeIAPropia(ws).catch(() => true)) || (await cheapDisponible().catch(() => false));
  const hayClave = await tieneClaveDeSpy(ws);
  let r: Awaited<ReturnType<typeof asegurarGuion>>;
  try {
    r = await asegurarGuion(ws, piezaId, { hayIA, hayClave });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  if (!r) return Response.json({ ok: false, error: 'Esa pieza no está.' }, { status: 404 });

  const { trabajo } = r;
  if (trabajo) {
    const correr = () => runWithWorkspace(ws, () => conSuIADelNegocio(ws, () => trabajo()));
    try { after(correr); } catch { void correr(); }
  }
  return Response.json({ ok: true, guion: r.vista });
}
