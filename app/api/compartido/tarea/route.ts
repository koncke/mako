// =============================================================================
// POST /api/compartido/tarea — el cliente contesta o aprueba, sin login
// =============================================================================
// Es la ÚNICA escritura del sistema autenticada por token de link. Tres cosas la
// sostienen, y las tres tienen que estar en ESTA ruta y no solo en la pantalla:
//
//  1. `puedeEditar` decide. Si solo lo llamara la página, cualquiera mandaría un
//     POST con otro `lead` y escribiría sobre la tarea de otro cliente. Es el
//     mismo IDOR que `puedeVer` cerró del lado de la lectura.
//  2. El workspace sale del SHARE, nunca del cuerpo del request. El token es lo
//     único que dice de quién es este dato.
//  3. La clase tiene que existir en el programa. Un `clase_id` inventado dejaría
//     filas huérfanas que ninguna pantalla vuelve a mostrar.
//
// Un share NO es una sesión: no emite cookie. Por eso `/api/compartido` está en
// `lib/rutas-publicas.ts` y esta ruta no lee la cookie de sesión para nada — si
// la leyera, el early-return del middleware la dejaría expuesta a CSRF.

import { NextResponse, type NextRequest } from 'next/server';
import { resolverToken, puedeEditar } from '@/lib/shares';
import { runWithWorkspace } from '@/lib/workspace';
import { guardarRespuesta, aprobarBloque } from '@/lib/cs-respuestas';
import { claseDe } from '@/lib/programa-catalogo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Igual que el resto de `/compartido`: fuera de alcance es 404, no 403. Un 403
 *  confirmaría que el recurso existe y se podría enumerar por diferencia. */
const NO = () => NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

/** El texto de una tarea es largo a propósito (son las respuestas del Norte
 *  Estratégico), pero no infinito: sin tope, un POST puede llenar la tabla. */
const TOPE = 20_000;

export async function POST(req: NextRequest) {
  let body: { token?: string; claseId?: string; area?: string; texto?: string; accion?: string };
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== 'object') return NO();
    body = parsed as typeof body;
  } catch { return NO(); }

  const token = String(body.token ?? '');
  const claseId = String(body.claseId ?? '');
  const area = String(body.area ?? '');
  const texto = String(body.texto ?? '').slice(0, TOPE);
  const accion = body.accion === 'aprobar' ? 'aprobar' : 'guardar';

  if (!token || !claseId) return NO();
  if (!claseDe(claseId)) return NO();

  const acceso = await resolverToken(token);
  if (!acceso) return NO();

  // El id que autoriza el share ES el lead. No viene del cuerpo: si viniera,
  // bastaría cambiarlo para escribir sobre otro cliente.
  const leadId = Number(acceso.share.recurso_id);
  if (!Number.isFinite(leadId) || leadId <= 0) return NO();
  if (!puedeEditar(acceso.share, 'tarea-cs', String(leadId))) return NO();

  try {
    const fila = await runWithWorkspace(acceso.share.workspace_id, () =>
      accion === 'aprobar'
        ? aprobarBloque(leadId, claseId, texto, area)
        : guardarRespuesta(leadId, claseId, texto, area),
    );
    if (!fila) return NO();
    return NextResponse.json(
      { ok: true, estado: fila.estado, guardadoAt: fila.updated_at },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[compartido:tarea] no se pudo guardar:', e);
    // 500 y no 404: acá el cliente SÍ tiene que ver que algo falló, porque
    // acaba de escribir algo a mano y creería que quedó guardado.
    return NextResponse.json({ ok: false, error: 'no se pudo guardar' }, { status: 500 });
  }
}
