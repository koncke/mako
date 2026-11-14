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
// del día. Sin una o la otra no se reclama nada y la pantalla dice cuál falta. Un video de YouTube no pide la clave de Spy: lo
// transcribe el Gemini del negocio desde su enlace, y «¿tiene Gemini?» se pregunta también adentro de `conSuIADelNegocio`
// (un negocio con su Claude o su GPT no manda nada a Gemini).
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { claveDeIAPropia, conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { cheapDisponible, provsDe } from '@/lib/ai-cheap';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { asegurarGuion } from '@/lib/spy-transcripcion-servidor';
import { huellasDeSpy } from '@/lib/spy-todo';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Traer el video (hasta 100 s), bajarlo y escucharlo; o los tramos de un video de YouTube, de a uno (hasta 3 × 170 s). */
export const maxDuration = 800;

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
  // Las huellas (nunca las claves): con la de un rechazo ya cambiada, el guion se vuelve a pedir sin esperar la hora.
  const huellas = await huellasDeSpy(ws);
  const hayClave = huellas == null || huellas.length > 0;
  let r: Awaited<ReturnType<typeof asegurarGuion>>;
  try {
    // «No pude leer» no es «no tiene»: un fallo acá es un 500 (la pantalla no dibuja el bloque), nunca un «Conecta tu Gemini».
    const hayGemini = () => runWithWorkspace(ws, () => conSuIADelNegocio(ws, async () => (await provsDe('gemini')).length > 0));
    r = await asegurarGuion(ws, piezaId, { hayIA, hayClave, hayGemini, huellas });
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
