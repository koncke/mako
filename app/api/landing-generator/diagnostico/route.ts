// =============================================================================
// POST /api/landing-generator/diagnostico — el diagnóstico de una landing y sus comentarios guardados
// =============================================================================
// Tanda 2, puntos 2, 7 y 8 (docs/diseno-editor-landing.md, T2 y T5): el panel del diagnóstico que se
// abre a la derecha del Panel (app/landing-generator/diagnostico/PanelDiagnostico.tsx). Un `accion` por
// operación, exactamente `PedidoDiagnostico` (lib/editor-landing/diagnostico.ts):
//   { accion: 'listar', docId | url }              los comentarios guardados (y el veredicto de una de afuera);
//   { accion: 'analizar', docId | url, texto? }    analiza, guarda lo nuevo y devuelve la lista entera;
//   { accion: 'estado', id, estado }               pendiente / resuelta / descartada (nunca borra).
// El trabajo vive en lib/editor-landing/diagnostico-server.ts; acá sólo la puerta y el reparto.
//
// La puerta es la de todo /api/landing-generator: admin del workspace y la tab `landing-writer` en su
// capa (sin el rol, un closer usaría por acá la IA que su pantalla le esconde, contra las keys del negocio).
// maxDuration 300: el análisis del Landing Analyst piensa (`effort: 'high'`) y una página de afuera
// además se baja. El panel espera con un plazo del navegador de 305 s.
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { analizar, cambiarEstado, listar } from '@/lib/editor-landing/diagnostico-server';
import type { RespuestaDiagnostico } from '@/lib/editor-landing/diagnostico';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const falla = (status: number, error: string, extra: { pegable?: boolean } = {}) =>
  Response.json({ ok: false, error, ...extra } satisfies RespuestaDiagnostico, { status });

/** El resultado del server como respuesta: el `status` interno elige el código y NO viaja en el cuerpo. */
function responder(r: { ok: true } | { ok: false; error: string; status: number; pegable?: boolean }): Response {
  if (!r.ok) return falla(r.status, r.error, r.pegable ? { pegable: true } : {});
  return Response.json(r);
}

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');

  try {
    switch (body.accion) {
      case 'listar': return responder(await listar({ docId: body.docId, url: body.url }));
      case 'analizar': return responder(await analizar({ docId: body.docId, url: body.url, texto: body.texto }));
      case 'estado': return responder(await cambiarEstado({ id: body.id, estado: body.estado }));
      default: return falla(400, 'Acción desconocida');
    }
  } catch (err) {
    // El server no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error(`[landing-generator/diagnostico:${String(body.accion ?? '?')}]`, err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
