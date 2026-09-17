// =============================================================================
// api-mako/areas/mako.helpers — lecturas de las colas que lib/ no expone SIN escribir
// =============================================================================
// DEUDA con lib/mako-pendientes.ts y lib/propuestas.ts, escrita a propósito:
//   · pendientePorId → getPendiente(ws, id) existe pero NO selecciona `resultado`
//     ni `resuelto_at`, que es justo lo que contesta «¿se ejecutó lo que
//     confirmé?». Sumarlos al select de la lib es el arreglo; esto se borra ese día.
//   · contarPendientesVigentes → pendientesVigentes / pendientesDelWorkspace
//     ESCRIBEN antes de leer (vencerExpiradas: UPDATE estado='vencida'). Una lectura
//     del registro no escribe, así que acá se filtra por `vence_at > ahora` en la
//     consulta, que da el mismo conjunto sin tocar filas.
//   · propuestasAccionFallidas → propuestasPendientes filtra estado='pendiente', y
//     una propuesta genérica que se aplicó y FALLÓ queda 'aplicada' con
//     resultado.ok=false (a propósito, para no invitar un segundo click). Sin esta
//     lectura desaparece de toda bandeja y nadie ve que no se hizo. Suma las que
//     quedaron {en_curso:true} sin `ok` (la función murió entre marcar y resolver).
//   · contarBandejas → contarPendientes() de lib/mako-confirmaciones.ts traga el
//     error y da 0; propuestasPendientes trae 100 filas select('*') para contar.
//
// Todo pasa por getTenantDb(): corre adentro de runWithWorkspace(ctx.ws), que pone
// el choke point (lib/api-mako/ejecutar.ts). Nada de acá escribe.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';

export type PendienteCompleta = {
  id: number; grupoJid: string; tipo: string; resumen: string; estado: string;
  venceAt: string; origen: string | null; createdAt: string;
  resultado: string | null; resueltoAt: string | null;
};

export async function pendientePorId(id: number): Promise<PendienteCompleta | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('mako_acciones_pendientes')
    .select('id, grupo_jid, tipo, resumen, estado, vence_at, origen, created_at, resultado, resuelto_at')
    .eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: pendientePorId: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: Number(r.id), grupoJid: String(r.grupo_jid ?? ''), tipo: String(r.tipo ?? ''), resumen: String(r.resumen ?? ''),
    estado: String(r.estado ?? ''), venceAt: String(r.vence_at ?? ''), origen: r.origen ? String(r.origen) : null,
    createdAt: String(r.created_at ?? ''), resultado: r.resultado == null ? null : String(r.resultado),
    resueltoAt: r.resuelto_at ? String(r.resuelto_at) : null,
  };
}

/** Cuántas pendientes siguen vigentes: en todo el workspace y, si se pasan claves,
 *  solo las de esas claves (lo que ESTE canal puede confirmar). `null` = la lectura
 *  falló, que no es lo mismo que cero. */
export async function contarPendientesVigentes(claves: readonly string[] | null): Promise<{ total: number | null; delCanal: number | null }> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const total = await db.from('mako_acciones_pendientes').select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente').gt('vence_at', ahora);
  const t = total.error ? null : (total.count ?? 0);
  if (!claves) return { total: t, delCanal: t };
  const canal = await db.from('mako_acciones_pendientes').select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente').gt('vence_at', ahora).in('grupo_jid', [...claves]);
  return { total: t, delCanal: canal.error ? null : (canal.count ?? 0) };
}

export type PropuestaFallida = {
  id: string; resumen: string; origen: string | null; datos: Record<string, unknown>; resultado: Record<string, unknown> | null;
  createdAt: string; appliedAt: string | null;
  /** true = se empezó a aplicar y nunca se escribió el resultado (la función murió en
   *  el medio): pudo haber escrito a medias. false = terminó con ok=false. */
  sinResultado: boolean;
};

/** Minutos sin resultado a partir de los cuales una aplicación «en curso» se da por
 *  cortada. Ninguna ejecución vive tanto (maxDuration de Vercel es menor). */
export const MIN_SIN_RESULTADO = 5;

const filaAPropuesta = (r: Record<string, unknown>): PropuestaFallida => {
  const resultado = (r.resultado ?? null) as Record<string, unknown> | null;
  return {
    id: String(r.id), resumen: String(r.resumen ?? ''), origen: r.origen ? String(r.origen) : null,
    datos: (r.datos ?? {}) as Record<string, unknown>, resultado,
    createdAt: String(r.created_at ?? ''), appliedAt: r.applied_at ? String(r.applied_at) : null,
    sinResultado: typeof resultado?.ok !== 'boolean',
  };
};

/** Propuestas genéricas (tipo 'accion') aplicadas en los últimos `dias` que NO se
 *  hicieron: resultado.ok=false, o resultado sin `ok` hace más de MIN_SIN_RESULTADO
 *  minutos. Lo segundo es el hueco de aplicarPropuestaGenerica (acciones.ts): marca
 *  {en_curso:true} ANTES de ejecutar y recién después pisa con {ok}; si la función
 *  muere en el medio, la fila queda 'aplicada' sin `ok` y sin esta lectura desaparece
 *  de toda bandeja. Tope `tope` filas, más nuevas primero. */
export async function propuestasAccionFallidas(dias: number, tope: number): Promise<PropuestaFallida[]> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const corte = new Date(Date.now() - MIN_SIN_RESULTADO * 60_000).toISOString();
  const { data, error } = await db.from('propuestas')
    .select('id, resumen, origen, datos, resultado, created_at, applied_at')
    .eq('tipo', 'accion').eq('estado', 'aplicada').gte('applied_at', desde)
    .or(`resultado->>ok.eq.false,and(resultado->>ok.is.null,applied_at.lt."${corte}")`)
    .order('applied_at', { ascending: false }).limit(tope);
  if (error) throw new Error(`api-mako: propuestasAccionFallidas: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map(filaAPropuesta);
}

/** Una propuesta con `applied_at`, que getPropuesta (lib/propuestas.ts) no mapea y
 *  hace falta para distinguir «se está aplicando» de «se cortó». DEUDA: sumar
 *  appliedAt a `Propuesta` en la lib y borrar esto. */
export async function propuestaConAplicacion(id: string): Promise<PropuestaFallida & { tipo: string; estado: string } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('propuestas')
    .select('id, tipo, estado, resumen, origen, datos, resultado, created_at, applied_at')
    .eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: propuestaConAplicacion: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { ...filaAPropuesta(r), tipo: String(r.tipo ?? ''), estado: String(r.estado ?? '') };
}

/** Conteos de las bandejas con count head:true (no trae filas). `null` = la lectura
 *  falló, que no es cero. */
export async function contarBandejas(dias: number): Promise<{ acciones: number | null; leads: number | null; fallidas: number | null; crmAuto: number | null }> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const corte = new Date(Date.now() - MIN_SIN_RESULTADO * 60_000).toISOString();
  const cuenta = async (q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
    try { const r = await q; return r.error ? null : (r.count ?? 0); } catch { return null; }
  };
  const [acciones, leads, fallidas, crmAuto] = await Promise.all([
    cuenta(db.from('propuestas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('tipo', 'accion')),
    cuenta(db.from('propuestas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('tipo', 'lead')),
    cuenta(db.from('propuestas').select('id', { count: 'exact', head: true })
      .eq('tipo', 'accion').eq('estado', 'aplicada').gte('applied_at', desde)
      .or(`resultado->>ok.eq.false,and(resultado->>ok.is.null,applied_at.lt."${corte}")`)),
    // lib/mako-confirmaciones.ts contarPendientes() devuelve 0 si falla: acá null.
    cuenta(db.from('mako_confirmaciones').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')),
  ]);
  return { acciones, leads, fallidas, crmAuto };
}
