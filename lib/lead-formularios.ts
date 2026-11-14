// =============================================================================
// lead-formularios — qué formulario llenó cada lead, con sus respuestas (server, 14/11/2026)
// =============================================================================
// La tabla es la mig 0415 (`lead_formularios`). ⚠️ SE ESCRIBIÓ Y NO SE APLICÓ con el código: aplicar una migración en
// producción pide la frase de Martín. Hasta entonces esto NO ROMPE NADA: el insert que falla se anota y sigue, y la lectura
// devuelve vacío (la ficha cae a `leads.optin_respuestas` y al historial, como antes). Lo que sí funciona sin la tabla: el
// ruteo por formulario, el disparador «Envió el formulario» y la línea del historial del lead (`lead_audit`).
// =============================================================================
import 'server-only';
import { getTenantDb } from './workspace';
import type { RespuestaOptin } from './optin-respuestas';

export type EnvioFormulario = {
  formularioId: string | null;
  formularioNombre: string | null;
  landingDocId: number | null;
  paginaId: string | null;
  pagina: string | null;
  origen: 'formulario' | 'agenda' | 'quiz';
  respuestas: RespuestaOptin[];
  funnels: Array<number | null> | null;
  fecha: string;
};

/** ¿El error es «la tabla todavía no existe»? (la 0415 sin aplicar). */
export const faltaLaTabla = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/lead_formularios/.test(e.message ?? '') && /does not exist|schema cache/.test(e.message ?? '')));

let avisado = false;

/** Anota un envío (adentro de `runWithWorkspace`). Nunca tira: si no se pudo, queda en el log. */
export async function anotarEnvio(leadId: number, e: Omit<EnvioFormulario, 'fecha'>): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('lead_formularios').insert({
      lead_id: leadId,
      formulario_id: e.formularioId,
      formulario_nombre: e.formularioNombre?.slice(0, 160) ?? null,
      landing_doc_id: e.landingDocId,
      pagina_id: e.paginaId,
      pagina: e.pagina?.slice(0, 2000) ?? null,
      origen: e.origen,
      respuestas: e.respuestas.slice(0, 20),
      funnels: e.funnels,
    });
    if (error) {
      if (faltaLaTabla(error)) {
        if (!avisado) console.warn('[lead-formularios] la tabla lead_formularios no existe todavía (mig 0415 sin aplicar): el envío queda sólo en el historial');
        avisado = true;
        return false;
      }
      console.error(`[lead-formularios] lead=${leadId} no se pudo anotar el envío: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[lead-formularios] lead=${leadId} excepción al anotar:`, err instanceof Error ? err.message : err);
    return false;
  }
}

type Fila = {
  formulario_id: string | null; formulario_nombre: string | null; landing_doc_id: number | null; pagina_id: string | null;
  pagina: string | null; origen: string | null; respuestas: unknown; funnels: unknown; created_at: string;
};

/** Los envíos de un lead, del más nuevo al más viejo (hasta 30). Sin la tabla, o si falla, []. */
export async function enviosDelLead(leadId: number): Promise<EnvioFormulario[]> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('lead_formularios')
      .select('formulario_id, formulario_nombre, landing_doc_id, pagina_id, pagina, origen, respuestas, funnels, created_at')
      .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(30);
    if (error) {
      if (!faltaLaTabla(error)) console.error(`[lead-formularios] lead=${leadId} no se pudieron leer los envíos: ${error.message}`);
      return [];
    }
    return ((data ?? []) as Fila[]).map((f) => ({
      formularioId: f.formulario_id,
      formularioNombre: f.formulario_nombre,
      landingDocId: f.landing_doc_id,
      paginaId: f.pagina_id,
      pagina: f.pagina,
      origen: f.origen === 'agenda' || f.origen === 'quiz' ? f.origen : 'formulario',
      respuestas: (Array.isArray(f.respuestas) ? f.respuestas : [])
        .filter((x): x is { pregunta: unknown; respuesta: unknown } => !!x && typeof x === 'object')
        .map((x) => ({ pregunta: String(x.pregunta ?? ''), respuesta: String(x.respuesta ?? '') }))
        .filter((x) => x.pregunta && x.respuesta),
      funnels: Array.isArray(f.funnels) ? (f.funnels as unknown[]).map((x) => (typeof x === 'number' ? x : null)) : null,
      fecha: f.created_at,
    }));
  } catch {
    return [];
  }
}

/** Los ids de los leads que enviaron un formulario (o cualquiera de una landing), para la condición de Automations. */
export async function leadsQueEnviaron(filtro: { formularioId?: string; landingDocId?: number }, leadIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (!leadIds.length || (!filtro.formularioId && filtro.landingDocId == null)) return out;
  try {
    const db = await getTenantDb();
    let q = db.from('lead_formularios').select('lead_id').in('lead_id', leadIds.slice(0, 1000));
    q = filtro.formularioId ? q.eq('formulario_id', filtro.formularioId) : q.eq('landing_doc_id', filtro.landingDocId as number);
    const { data, error } = await q;
    if (error) return out;
    for (const r of (data ?? []) as Array<{ lead_id: number }>) out.add(Number(r.lead_id));
  } catch { /* sin la tabla: nadie */ }
  return out;
}
