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
import { AVISO_FALTAN_PERMISOS_META, FALTAN_PERMISOS_META } from './meta-permisos';

// Un problema ACTIVO ahora, tal como lo detecta quien reconcilia.
export type ProblemaActual = {
  service: string;               // 'meta' | 'openai' | 'fathom' | ...
  severidad: 'rojo' | 'ambar';
  statusLabel: string;
  disableReason: string | null;
  entregaFrenada: boolean;
  balanceMxn: number | null;
  detalle: string;
  /**
   * ¿El servicio CONTESTÓ y este es su estado? (mig 0139)
   *
   * `false` = no se pudo leer. Es una IGNORANCIA, no un hecho, y la diferencia
   * no es filosófica: `esCritico()` en lib/alerta-critica.ts solo persigue por
   * WhatsApp lo confirmado. Sin esta distinción, «no pude preguntar» se le
   * anunciaba al cliente como «tu cuenta está caída» — pasó el 21/8/2026.
   */
  confirmado: boolean;
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
  /** false = no se pudo leer el estado; el problema es la LECTURA, no la cuenta. */
  confirmado: boolean;
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
        entrega_frenada: p.entregaFrenada, balance_mxn: p.balanceMxn, detalle: p.detalle,
        confirmado: p.confirmado, updated_at: now,
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
      confirmado: true,        // Meta contestó: esto es un HECHO.
    };
  }
  // ⚠️ NO PODER LEER EL ESTADO NO ES UN ESTADO. Sigue siendo un problema —hay algo
  // que arreglar y la pantalla tiene que decirlo— pero es nuestro, no de la cuenta
  // del cliente, y no se sabe nada sobre si entrega o no.
  //
  // Esto era `severidad: 'rojo'` y le costó a un cliente cuatro WhatsApps a las
  // 21:15, 22:30, 23:31 y 00:40 diciéndole que su cuenta estaba caída y que no le
  // entraba un solo lead. Su cuenta estaba Activa. Lo que fallaba era la lectura:
  // su META_AD_ACCOUNT_ID se había guardado sin `act_` (ver lib/meta-cuenta-id.ts).
  //
  // Ámbar + `confirmado: false`, las dos cosas: el ámbar ya alcanza para que
  // `esCritico()` no lo persiga, y `confirmado` es el guard EN POSITIVO que no
  // depende de que nadie vuelva a mirar la severidad. Las dos capas de siempre.
  if (metaError) {
    // Si Meta dijo que falta el permiso de anuncios, el incidente se llama así: es lo
    // que hay que arreglar (lib/meta-permisos.ts). Sigue en ámbar y sin confirmar,
    // porque del estado de la CUENTA no se sabe nada.
    const sinPermiso = metaError === FALTAN_PERMISOS_META;
    return {
      service: 'meta',
      severidad: 'ambar',
      statusLabel: sinPermiso ? FALTAN_PERMISOS_META : 'No se pudo leer el estado de Meta',
      disableReason: null,
      entregaFrenada: false,
      balanceMxn: null,
      detalle: sinPermiso ? AVISO_FALTAN_PERMISOS_META : `No se pudo leer el estado de Meta: ${metaError}`,
      confirmado: false,
    };
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
      // `!== false` y no `!!`: mientras la mig 0139 no esté aplicada la columna
      // no viene, y un incidente viejo SÍ estaba confirmado. Un default que
      // degrada a «no confirmado» apagaría la alerta real, que es el bug de 8/2026
      // al revés y peor: se dejaría de avisar una cuenta suspendida de verdad.
      confirmado: r.confirmado !== false,
    }));
  } catch (err) {
    console.error(`[incidentes] leer: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
