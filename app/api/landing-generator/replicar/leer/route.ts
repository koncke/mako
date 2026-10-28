// =============================================================================
// POST /api/landing-generator/replicar/leer — LEER una landing de afuera antes de replicarla (28/10/2026)
// =============================================================================
// Pedido de Martín (28/10/2026): que se defina qué se replica (diseño, estructura, ángulos, texto) y que la lectura de
// la landing se vea ANTES de replicar. Recibe `{ url, lectura?, texto? }` (como /replicar: la lectura del navegador o
// el texto pegado reemplazan la bajada) y contesta `{ ok, lectura }` con las secciones y su molde, los ángulos y el
// diseño de la original (lib/editor-landing/replicar-lectura.ts). Si la página no se lee desde el server, la falla trae
// `pegable`, `enNavegador` y `motivo` (422), y la pantalla la lee en la ventana del clic y vuelve con la `lectura`.
//
// La puerta, la de /replicar: admin del workspace y la tab `landing-writer` en su capa (los ángulos usan la IA del
// negocio). No escribe nada: la lectura vive en la pantalla y vuelve con el pedido de la réplica.
// maxDuration 120: la bajada (hasta ~20 s) y los ángulos (`PLAZO_ANGULOS_MS`, 75 s) corren casi en paralelo.
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { leerParaReplicar, type ResultadoLectura } from '@/lib/editor-landing/replicar-lectura';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const falla = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');

  let body: { url?: unknown; lectura?: unknown; texto?: unknown };
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');

  try {
    const r: ResultadoLectura = await leerParaReplicar({ url: body.url, lectura: body.lectura, texto: body.texto });
    if (!r.ok) {
      return falla(r.status ?? 400, r.error, r.enNavegador && r.motivo ? { pegable: true, enNavegador: true, motivo: r.motivo } : {});
    }
    return Response.json({ ok: true, lectura: r.lectura });
  } catch (err) {
    // leerParaReplicar no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error('[landing-generator/replicar/leer]', err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
