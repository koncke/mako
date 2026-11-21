// =============================================================================
// /api/crm/papelera — «Mandar a la papelera» de UNA ficha (la de página completa y el pop-up del tablero)
// =============================================================================
// POST { id } → { ok: true } | { ok: false, error }
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION, A PROPÓSITO (21/11/2026). Visto verificando «Asignar fuentes» en el ws 3: en la
// ficha de /crm/<id>, «Mandar a la papelera» no hizo nada visible, el lead seguía en la base varios segundos después, y un
// segundo toque «lo arregló». El diagnóstico obvio (el primer clic no llegó, o un doble render se lo comió) era el
// equivocado: el primer clic SÍ entró. Pero Next despacha las server actions DE A UNA (la fila de su router, ver
// AGENTS.md «LOS SERVER ACTIONS SE ENCOLAN»), y la ficha manda las suyas al abrir —medido en el ws 4: cinco en serie
// entre los 4,9 y los 9,3 s, y otra a los 13 s—; el borrado esperaba detrás de todas. Y como acción con `redirect`, su
// respuesta traía además el tablero ENTERO dibujado antes de que cambiara nada en pantalla. El segundo toque no hizo nada
// (el botón ya estaba apagado): fue el primero, que terminaba.
//
// Por una ruta, el `fetch` sale en el acto y en paralelo; la pantalla navega después con `router.push`, que en la fila de
// Next pasa ADELANTE de lo que esté esperando. Las server actions de siempre (`deleteLeadAction`, `deleteLeadInlineAction`)
// quedan para la API de MaKo y sus tests; las dos fichas van por acá (app/crm/papelera-ficha.ts).
//
// La puerta es la MISMA que la de esas acciones (`exigirSesion`: una sesión válida contra la base en este negocio) y la
// escritura es la misma función (`mandarLeadsAPapelera`, con su historial y su autor).
// =============================================================================

import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { exigirSesion, SIN_SESION } from '@/lib/sesion-accion';
import { mandarLeadsAPapelera } from '@/lib/leads-papelera';
import { PRESUPUESTO_LOTE_MS } from '@/app/crm/lote-tandas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  try { await exigirSesion(); } catch { return err(401, SIN_SESION); }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return err(400, 'Falta el lead.');

  let por = 'CRM';
  try { por = (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { /* el historial dice «CRM» */ }
  let r: Awaited<ReturnType<typeof mandarLeadsAPapelera>>;
  try {
    r = await mandarLeadsAPapelera([id], { por, hasta: Date.now() + PRESUPUESTO_LOTE_MS });
  } catch (e) {
    return err(502, e instanceof Error ? e.message : 'La papelera no contestó.');
  }
  if (!r.hechos.length) return err(400, `No se pudo mandar a la papelera: ${r.motivos[0] ?? 'no contestó'}.`);

  try {
    revalidateTag(TAG.leads, { expire: 0 });
    revalidateTag(TAG.pagos, { expire: 0 });
    revalidatePath('/crm');
    revalidatePath('/general');
  } catch { /* vence sola por TTL */ }
  return NextResponse.json({ ok: true });
}
