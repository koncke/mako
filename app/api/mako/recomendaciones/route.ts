// =============================================================================
// /api/mako/recomendaciones — lo que MaKo recomienda en una pantalla, y lo que la persona decide (26/10/2026)
// =============================================================================
// GET  ?superficie=ops-center|automations|offer|landing      → { ok, recomendaciones, funcionaron, fallas, notas, redaccion }
// POST { superficie, clave, decision: 'hecha'|'ahora-no'|'no-aplica', motivo? } → { ok }
//
// El motor: lib/recomendaciones.ts (lo que lee y guarda) y lib/recomendaciones-reglas.ts (cuándo existe una recomendación).
// El diseño: docs/diseno-mako-recomienda.md. Esto sólo traduce HTTP.
//
// PRIVADA: no está en PUBLICOS (lib/rutas-publicas.ts) y además exige la sesión adentro, en cada pedido. SÓLO EL ADMIN DEL
// NEGOCIO: lo que decide («Ahora no», «No aplica») vale para todo el equipo, y lo que «Hacerlo» abre (crear una
// automatización, cambiar la oferta) es suyo. A un miembro no se le muestra nada (`[]`), no un error: la pantalla es la misma.
//
// ⚠️ EL GET NO ESCRIBE NADA DEL NEGOCIO: lee y, si el negocio tiene SU IA y la redacción guardada no es de estas señales,
//    la pide DESPUÉS de contestar (`after()`), que guarda sólo el caché de la redacción. La próxima vez sale la de la IA.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { decidirRecomendacion, recomendacionesDe } from '@/lib/recomendaciones';
import { clavesValidas, esClaveDeRecomendacion, esDecision, esSuperficie, MAX_MOTIVO } from '@/lib/recomendaciones-reglas';

export const dynamic = 'force-dynamic';
// La redacción de la IA corre en after() con su propio plazo (45 s): la ruta tiene que vivir eso.
export const maxDuration = 90;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

async function quien(): Promise<{ ws: number; admin: boolean; actor: string } | { error: string; status: number }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'Tu sesión venció.', status: 401 };
  const rol = await getRolWsEfectivo();
  if (!rol) return { error: 'Tu sesión venció.', status: 401 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Elige una cuenta primero.', status: 400 };
  return { ws, admin: rol === 'admin', actor: sesion.email || sesion.nombre || sesion.sub };
}

export async function GET(req: NextRequest) {
  try {
    const superficie = req.nextUrl.searchParams.get('superficie');
    if (!esSuperficie(superficie) || superficie === 'whatsapp') return json({ ok: false, error: 'Esa pantalla no existe.' }, 400);
    const q = await quien();
    if ('error' in q) return json({ ok: false, error: q.error }, q.status);
    if (!q.admin) return json({ ok: true, recomendaciones: [], funcionaron: [], descartadas: [], fallas: [], notas: [], redaccion: 'nada' });
    // ADENTRO de «sólo su IA» (D6b, tests/d6b-rutas.test.ts: lo que llama el navegador del Ops Center prende el contexto): con
    // su Claude o su GPT, la redacción va a la suya y nunca a la Gemini gratis. after() ata ese contexto (lib/solo-su-ia.ts);
    // el workspace se fija igual, por las dudas.
    const r = await runWithWorkspace(q.ws, () => conSuIADelNegocio(q.ws, () => recomendacionesDe(superficie, {
      alDespues: (fn) => after(() => runWithWorkspace(q.ws, fn)),
    })));
    return json({ ok: true, ...r });
  } catch (e) {
    console.error('[api/mako/recomendaciones] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude cargar las recomendaciones de MaKo.' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const q = await quien();
    if ('error' in q) return json({ ok: false, error: q.error }, q.status);
    if (!q.admin) return json({ ok: false, error: 'Sólo el administrador decide sobre las recomendaciones.' }, 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const superficie = b?.superficie;
    const clave = typeof b?.clave === 'string' ? b.clave : '';
    if (!esSuperficie(superficie) || superficie === 'whatsapp') return json({ ok: false, error: 'Esa pantalla no existe.' }, 400);
    if (!esClaveDeRecomendacion(clave)) return json({ ok: false, error: 'Esa recomendación no existe.' }, 400);
    const decision = b?.decision;
    if (!esDecision(decision)) return json({ ok: false, error: 'Elige qué hacer con la recomendación.' }, 400);
    const motivo = typeof b?.motivo === 'string' ? b.motivo.slice(0, MAX_MOTIVO) : null;
    // Las OTRAS claves de la recomendación (la IA puede juntar varias señales en una), tal como las mostró la tarjeta: cada una
    // con la misma forma que la principal, y pocas. El server no agrega ninguna: se decide sobre lo que se vio.
    const claves = clavesValidas(b?.claves);
    const r = await runWithWorkspace(q.ws, () => conSuIADelNegocio(q.ws, () => decidirRecomendacion({ superficie, clave, claves, d: decision, motivo, quien: q.actor })));
    if (!r.ok) return json({ ok: false, error: r.error }, r.status);
    return json({ ok: true });
  } catch (e) {
    console.error('[api/mako/recomendaciones] POST', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude guardar lo que decidiste.' }, 500);
  }
}
