// =============================================================================
// tope-automations — «hasta 3 automatizaciones activas» del Esencial, al ACTIVAR una (23/10/2026)
// =============================================================================
// docs/ofertas-mako.md y lib/topes-plan.ts (`automations.activas`). Se pregunta en cada puerta que prende una automatización
// (app/api/email/secuencias, app/api/whatsapp/secuencias y lo que pide MaKo, lib/mako-doer-acciones.ts) ANTES de
// `setSecuenciaActiva`, que vive en lib/nutricion.ts y es del chat «Automations» (no se toca mientras arregla el motor).
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
