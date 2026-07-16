// =============================================================================
// incidentes de servicios — registro/lectura con INICIO y FIN por período
// =============================================================================
// Server-only. Un incidente es un PERÍODO: started_at (cuándo se detectó el
// problema) → resolved_at (cuándo se recuperó; NULL = en curso). Se reconcilia
// contra el estado actual: abre uno por servicio cuando aparece el problema,
// actualiza sus campos mientras persiste, y lo cierra cuando el servicio vuelve a
// estar sano. Generaliza a cualquier servicio (meta, openai, fathom, ...).
//
// Nunca rompe al caller: si la tabla no existe todavía (migración 0089 sin
// aplicar), loguea y no-opea.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import type { MetaAccountHealth } from './meta-health';

// Un problema ACTIVO ahora, tal como lo detecta quien reconcilia.
export type ProblemaActual = {
  service: string;               // 'meta' | 'openai' | 'fathom' | ...
  severidad: 'rojo' | 'ambar';
  statusLabel: string;
  disableReason: string | null;
  entregaFrenada: boolean;
  balanceMxn: number | null;
  detalle: string;
};

// Un incidente ya registrado (para mostrar en el historial).
export type Incidente = {
  id: number;
  service: string;
  severidad: string;
  statusLabel: string;
  disableReason: string | null;
  entregaFrenada: boolean;
  detalle: string | null;
  startedAt: string;
  resolvedAt: string | null;      // NULL = en curso
};

/**
 * Reconcilia los incidentes de los servicios en `scope` contra los `problemas`
 * activos ahora: abre los nuevos, actualiza los que siguen, cierra los que ya se
 * resolvieron. `scope` acota qué servicios toca esta llamada (así el cron, que
 * solo mira Meta, no cierra incidentes de otros servicios). Best-effort.
 */
export async function reconciliarIncidentes(problemas: ProblemaActual[], scope: string[]): Promise<void> {
  if (scope.length === 0) return;
  try {
    const db = await getTenantDb();
    const { data } = await db
      .from('service_incidents')
      .select('id, service')
      .is('resolved_at', null)
      .in('service', scope);
    const abiertos = (data ?? []) as { id: number; service: string }[];
    const problemaPorSvc = new Map(problemas.filter((p) => scope.includes(p.service)).map((p) => [p.service, p]));
    const abiertoPorSvc = new Map(abiertos.map((a) => [a.service, a.id]));
    const now = new Date().toISOString();

    // Cerrar los incidentes abiertos cuyo servicio ya NO tiene problema.
    for (const a of abiertos) {
      if (!problemaPorSvc.has(a.service)) {
        try { await db.from('service_incidents').update({ resolved_at: now, updated_at: now }).eq('id', a.id); }
        catch (e) { console.error(`[incidentes] cerrar ${a.service}: ${e instanceof Error ? e.message : String(e)}`); }
      }
    }

    // Abrir los nuevos / actualizar los que persisten.
    for (const [service, p] of problemaPorSvc) {
      const fields = {
        severidad: p.severidad, status_label: p.statusLabel, disable_reason: p.disableReason,
        entrega_frenada: p.entregaFrenada, balance_mxn: p.balanceMxn, detalle: p.detalle, updated_at: now,
      };
      const id = abiertoPorSvc.get(service);
      try {
        if (id) await db.from('service_incidents').update(fields).eq('id', id);
        else await db.from('service_incidents').insert({ service, ...fields, started_at: now });
      } catch (e) {
        // El índice único parcial (un abierto por servicio) puede rechazar un
        // insert en carrera: no es fatal, el otro ya lo abrió.
        console.error(`[incidentes] abrir/actualizar ${service}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (err) {
    console.error(`[incidentes] reconciliar: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Construye el problema de Meta a partir de su salud (o del error de lectura). */
export function problemaMeta(h: MetaAccountHealth | null, metaError: string | null): ProblemaActual | null {
  if (h) {
    if (h.severidad === 'verde' && !h.entregaFrenada) return null;
    return {
      service: 'meta',
      severidad: h.severidad === 'rojo' ? 'rojo' : 'ambar',
      statusLabel: h.statusLabel,
      disableReason: h.disableReasonLabel ?? null,
      entregaFrenada: h.entregaFrenada,
      balanceMxn: h.balanceMxn,
      detalle: h.entregaFrenada ? 'Entrega frenada' : (h.disableReasonLabel ?? h.statusLabel),
    };
  }
  if (metaError) {
    return { service: 'meta', severidad: 'rojo', statusLabel: 'No se pudo leer el estado de Meta', disableReason: null, entregaFrenada: false, balanceMxn: null, detalle: 'No se pudo leer el estado de Meta' };
  }
  return null;
}

/** Compat: el cron horario solo mira Meta → reconcilia SOLO ese servicio. */
export async function registrarEstadoMeta(h: MetaAccountHealth): Promise<void> {
  const p = problemaMeta(h, null);
  await reconciliarIncidentes(p ? [p] : [], ['meta']);
}

/** Incidentes para el historial: primero los EN CURSO, luego por inicio desc. */
export async function getIncidentes(limit = 30): Promise<Incidente[]> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db
      .from('service_incidents')
      .select('*')
      .order('resolved_at', { ascending: true, nullsFirst: true })
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      service: String(r.service),
      severidad: String(r.severidad),
      statusLabel: String(r.status_label ?? ''),
      disableReason: (r.disable_reason as string) ?? null,
      entregaFrenada: !!r.entrega_frenada,
      detalle: (r.detalle as string) ?? null,
      startedAt: String(r.started_at),
      resolvedAt: (r.resolved_at as string) ?? null,
    }));
  } catch (err) {
    console.error(`[incidentes] leer: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
