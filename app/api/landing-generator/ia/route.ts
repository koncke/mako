// =============================================================================
// POST /api/landing-generator/ia — MaKo en el editor de landings
// =============================================================================
// Un `accion` por operación de `PedidoIA` (lib/editor-landing/api-tipos.ts), con la
// respuesta `RespuestaIA` del mismo contrato. El trabajo vive en
// lib/editor-landing/ia.ts; acá solo la puerta y el pase de campos.
//
// La puerta es la misma que la de la tab y la del resto de /api/landing-generator:
// admin del workspace y la tab `landing-writer` en su capa (la key del nav no cambió
// con el editor nuevo: contrato en la base, D9). Sin eso, un closer usaba por acá la
// IA que su pantalla le esconde, contra las keys del negocio.
//
// maxDuration 300 y cada operación acotada con su propio plazo (`hastaMs`, en ia.ts):
// las secciones entran en menos de 60 s por tanda; «Edición con IA» sobre la landing
// entera es la más larga.
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esquema, secciones, editar, texto, disenos, notas, type ResultadoIA } from '@/lib/editor-landing/ia';
import type { PedidoIA, RespuestaIA } from '@/lib/editor-landing/api-tipos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const falla = (status: number, error: string) => Response.json({ ok: false, error } satisfies RespuestaIA, { status });

/** El resultado de ia.ts como respuesta: el `status` interno elige el código y NO viaja en el cuerpo. */
function responder<T extends object>(r: ResultadoIA<T>): Response {
  if (!r.ok) return falla(r.status, r.error);
  return Response.json(r);
}

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');

  let body: PedidoIA;
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');

  try {
    switch (body.accion) {
      case 'esquema':
        return responder(await esquema({ modo: body.modo, prompt: body.prompt, texto: body.texto, url: body.url, params: body.params }));
      case 'secciones':
        return responder(await secciones({ esquema: body.esquema, indices: body.indices, params: body.params, temaId: body.temaId }));
      case 'editar':
        return responder(await editar({ instruccion: body.instruccion, tarjetas: body.tarjetas, alcance: body.alcance === 'seccion' ? 'seccion' : 'landing', params: body.params }));
      case 'texto':
        return responder(await texto({ tipo: body.tipo, texto: body.texto, contexto: body.contexto, tono: body.tono, idioma: body.idioma }));
      case 'disenos':
        return responder(await disenos({ tarjeta: body.tarjeta }));
      case 'notas':
        return responder(await notas({ tarjeta: body.tarjeta }));
      default:
        return falla(400, 'Acción desconocida');
    }
  } catch (err) {
    // ia.ts no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error(`[landing-generator/ia:${String((body as { accion?: unknown }).accion ?? '?')}]`, err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
