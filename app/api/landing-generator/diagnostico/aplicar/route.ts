// =============================================================================
// POST /api/landing-generator/diagnostico/aplicar — «Aplicar» comentarios del Diagnóstico
// =============================================================================
// Decisión (c) de Martín (14/10/2026): «"Aplicar" de cada comentario del Diagnóstico = un clic, con la
// versión guardada antes y "Deshacer"; más "Aplicar todos" (de a una sección, un solo Deshacer) […] En una
// landing externa, "Aplicar" lleva a replicar primero y los comentarios pasan a la copia.»
//
// Un `accion` por operación, exactamente `PedidoAplicarDiagnostico` (lib/editor-landing/diagnostico.ts):
//   { accion: 'aplicar', docId, ids, versionAntes?, version? }  los comentarios de UNA sección: la IA
//                                                     reescribe la sección, se guarda (con la versión de
//                                                     antes si se pide) y quedan resueltos;
//   { accion: 'pasar', url, docId, resolver? }        los comentarios de una página de afuera a su copia;
//                                                     los de `resolver` (ids o 'todos') quedan resueltos
//                                                     afuera (tanda 7: se aplican en la copia).
// El trabajo vive en lib/editor-landing/diagnostico-aplicar.ts (el mismo que usa la API de MaKo); acá sólo
// la puerta y el reparto. Es una ruta aparte de /diagnostico para no tocar ese archivo en la tanda 6 (lo
// trabajaba otro carril); puede volver a ser un `accion` de aquélla.
//
// La puerta es la de todo /api/landing-generator: admin del workspace y la tab `landing-writer` en su
// capa (sin el rol, un closer usaría por acá la IA que su pantalla le esconde, contra las keys del negocio).
// maxDuration 300: la IA de una sección tiene su propio plazo (lib/editor-landing/ia.ts, PLAZOS.editar).
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { aplicarComentarios, pasarACopia, type FallaAplicar } from '@/lib/editor-landing/diagnostico-aplicar';
import type { RespuestaAplicarDiagnostico } from '@/lib/editor-landing/diagnostico';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const falla = (status: number, error: string, conflicto = false) =>
  Response.json({ ok: false, error, ...(conflicto ? { conflicto: true } : {}) } satisfies RespuestaAplicarDiagnostico, { status });

/** El resultado del server como respuesta: el `status` interno elige el código y NO viaja en el cuerpo. */
function responder(r: Exclude<RespuestaAplicarDiagnostico, { ok: false }> | FallaAplicar): Response {
  if (!r.ok) return falla(r.status, r.error, r.conflicto === true);
  return Response.json(r satisfies RespuestaAplicarDiagnostico);
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
      case 'aplicar': return responder(await aplicarComentarios({ docId: body.docId, ids: body.ids, versionAntes: body.versionAntes, version: body.version }));
      case 'pasar': return responder(await pasarACopia({ url: body.url, docId: body.docId, resolver: body.resolver }));
      default: return falla(400, 'Acción desconocida');
    }
  } catch (err) {
    // El server no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error(`[landing-generator/diagnostico/aplicar:${String(body.accion ?? '?')}]`, err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
