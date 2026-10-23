// =============================================================================
// tope-automations — «hasta 3 automatizaciones activas» del Esencial, al ACTIVAR una (23/10/2026)
// =============================================================================
// docs/ofertas-mako.md y lib/topes-plan.ts (`automations.activas`). Lo pregunta `setSecuenciaActiva` (lib/nutricion.ts), la
// única puerta que prende una automatización, y tira `TopeDelPlanError` (23/10/2026: estaba en cada puerta; ahí lo cubre
// cualquier camino nuevo). Las rutas lo contestan 403 con `tope: true` y MaKo lo dice en su resumen.
// ⚠️ SÓLO AL ESENCIAL DE LA PASARELA (lib/plan-esencial.ts): al ws1, a la plataforma, a los acuerdos a mano y al Pro, nunca.
// ⚠️ PRENDER UNA QUE YA ESTÁ PRENDIDA no cuenta como una más (el lienzo vuelve a mandar «activa» al publicar).
import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { esEsencialDe } from './plan-esencial';
import { cabeOtra, textoTope, topeDe } from './topes-plan';

/** null = se puede activar; un texto = el tope del plan, para mostrarle a la persona. */
export async function topeAlActivar(id: number, wsDado?: number): Promise<string | null> {
  // MaKo por WhatsApp corre sin sesión: el negocio lo pasa quien llama.
  const ws = wsDado ?? (await getWorkspaceActual());
  if (ws == null || !(await esEsencialDe(ws))) return null;
  const tope = topeDe('completo', 'automations.activas');
  if (tope == null) return null;
  const db = await getTenantDb();
  const { data: esta } = await db.from('nutricion_secuencias').select('activa').eq('id', id).maybeSingle();
  if ((esta as { activa?: boolean } | null)?.activa === true) return null;
  const { count, error } = await db.from('nutricion_secuencias').select('id', { count: 'exact', head: true })
    .eq('activa', true).is('archivada_at', null);
  // Ante la duda, se deja: un error de lectura no le frena el trabajo a quien paga.
  if (error) return null;
  return cabeOtra('completo', 'automations.activas', count ?? 0) ? null : textoTope(tope);
}
