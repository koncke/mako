// =============================================================================
// /api/competitor-spy/oferta — la oferta de un competidor, con el analista de Offer, sola y en segundo plano (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya tenemos
// construido, y debe traer automáticamente sus web para analizarlas». Sin botón: la pantalla llama esto al abrir la ficha
// de un competidor con web y dibuja lo que vuelve. Si hay que leerla, contesta en el acto con «leyendo» y el trabajo sigue
// en un `after()` (lib/spy-oferta.ts); la pantalla vuelve a preguntar hasta que queda.
//
//   POST { id } → { ok, oferta: VistaOferta }
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION, por lo mismo que /api/competitor-spy/analizar: las actions hacen fila, y un
// diagnóstico de un minuto dejaría esperando a cambiar de competidor.
//
// ⚠️ LA IA ES LA DEL NEGOCIO, adentro de `conSuIADelNegocio` (D6b) y sin crédito ni red de la plataforma. Sin ninguna
// conectada no se reclama nada: vuelve `sin-ia` y la pantalla lo dice.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { claveDeIAPropia, conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { cheapDisponible } from '@/lib/ai-cheap';
import { asegurarOferta } from '@/lib/spy-oferta-servidor';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** El diagnóstico de Offer corta a los 200 s y su web se baja antes: con 300 hay aire para guardar. */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  // La misma puerta que la pantalla (`requireRolWs([], { nav: 'market-an' })`): esto gasta la IA del negocio.
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const cuerpo = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(cuerpo.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta el competidor.' }, { status: 400 });

  // Sin poder leer sus claves se intenta igual: lo peor es un diagnóstico que contesta «conecta tu IA».
  const hayIA = (await claveDeIAPropia(ws).catch(() => true)) || (await cheapDisponible().catch(() => false));
  let r: Awaited<ReturnType<typeof asegurarOferta>>;
  try {
    r = await asegurarOferta(id, { hayIA, inicio });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  if (!r) return Response.json({ ok: false, error: 'Ese competidor no está.' }, { status: 404 });

  const { trabajo } = r;
  if (trabajo) {
    const correr = () => runWithWorkspace(ws, () => conSuIADelNegocio(ws, () => trabajo()));
    try { after(correr); } catch { void correr(); }
  }
  return Response.json({ ok: true, oferta: r.vista });
}
