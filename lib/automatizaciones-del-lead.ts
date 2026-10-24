// =============================================================================
// automatizaciones-del-lead — en qué automatizaciones está un lead (o varios) y frenarlo en una
// =============================================================================
// Martín, 22/10/2026 (por el Cerebro, la campaña del Sprint de Mauricio): «en el CRM debería indicar en la tarjeta o en algún
// lugar que esos leads están en una automatización activa, y que desde el CRM también se pueda frenar». La pantalla es del
// CRM (app/crm); acá la lectura y la escritura, lo puro en lib/automatizaciones-del-lead-reglas.ts, y las acciones en
// app/automations/automatizaciones-del-lead-actions.ts.
//
//   · `enAutomatizaciones(leadIds)`: UNA consulta por tablero (el aviso en cada tarjeta). Sólo inscripciones VIVAS ('activa',
//     o 'respondio': frenada porque contestó) de automatizaciones sin archivar; una pausada viene con
//     `automatizacionActiva: false` (el lead quedó congelado en su paso: lib/nutricion.ts, `idsDePausadas`).
//   · `frenarEnAutomatizacion`: el mismo núcleo que la operación de la API `sacar_lead_de_secuencia` (`sacarDeSecuencia`,
//     que también descarta sus borradores pendientes): no le sale nada más, y no se vuelve a abrir sola.
// =============================================================================
import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { sacarDeSecuencia } from '@/lib/nutricion-salida-manual';
import {
  enAutomatizacionesDe, textoDeFrenar, detalleDe, ESTADOS_VIVOS, DIAS_TERMINADAS, TOPE_NO_ENTRO,
  type EnAutomatizacion, type FilaInscripcion, type FilaAutomatizacion, type AutomatizacionesDelLead,
  type FilaInscripcionDetalle, type FilaEnvioDetalle, type FilaAuditDetalle, type FilaEntranteDetalle,
} from '@/lib/automatizaciones-del-lead-reglas';
import { zonaDelNegocio } from '@/lib/timezone';
import { frenosDelNegocio } from '@/lib/por-que-no-sale-db';

export type { EnAutomatizacion };

/** Cuántos leads se consultan de una vez (un tablero del CRM). */
export const TOPE_LEADS = 500;

/** Las automatizaciones VIVAS de cada lead (sólo aparecen los que están en alguna). Tira si no puede leer. */
export async function enAutomatizaciones(leadIds: readonly number[]): Promise<Map<number, EnAutomatizacion[]>> {
  const ids = [...new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, TOPE_LEADS);
  if (!ids.length) return new Map();
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_inscripciones')
    .select('id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, proximo_envio_at')
    .in('lead_id', ids).in('estado', [...ESTADOS_VIVOS]);
  if (error) throw new Error(`automatizaciones del lead: ${error.message}`);
  const filas = (data ?? []) as FilaInscripcion[];
  const secIds = [...new Set(filas.map((f) => Number(f.secuencia_id)))];
  if (!secIds.length) return new Map();
  const { data: secs, error: eSecs } = await db.from('nutricion_secuencias')
    .select('id, nombre, activa, archivada_at, pasos, instance_name').in('id', secIds);
  if (eSecs) throw new Error(`automatizaciones del lead (automatizaciones): ${eSecs.message}`);
  // Y POR QUÉ NO LE SALE, en palabras (23/10/2026, P0 de #289: lib/por-que-no-sale.ts). Si no se puede leer, sin motivo.
  const automatizaciones = (secs ?? []) as FilaAutomatizacion[];
  return enAutomatizacionesDe(filas, automatizaciones, await frenosDelNegocio(filas, automatizaciones));
}

/**
 * EL DETALLE DE UN LEAD, para el bloque «Automatizaciones» de la ficha (23/10/2026): sus inscripciones (las vivas y las
 * terminadas de los últimos `DIAS_TERMINADAS` días) con el paso, lo próximo y su hora, por qué no le sale, sus envíos con
 * su estado y su error, la reentrada y qué se puede hacer; y las veces que una persona lo movió a una etapa con
 * automatización y no entró (del historial). Lo arma `detalleDe` (puro). Tira si no puede leer.
 */
export async function detalleDelLead(leadId: number): Promise<AutomatizacionesDelLead> {
  const db = await getTenantDb();
  const ws = await getWorkspaceActual();
  const desde = new Date(Date.now() - DIAS_TERMINADAS * 86400_000).toISOString();
  const [ins, aud, contesto, lead, entrantes, zona] = await Promise.all([
    db.from('nutricion_inscripciones')
      .select('id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, proximo_envio_at, inscripto_at, updated_at, desenlace, desenlace_at')
      .eq('lead_id', leadId).order('id', { ascending: false }).limit(100),
    db.from('lead_audit').select('valor_nuevo, autor, created_at')
      .eq('lead_id', leadId).eq('campo', 'Automatización').like('valor_nuevo', 'No volvió a entrar a «%')
      .order('created_at', { ascending: false }).limit(TOPE_NO_ENTRO * 3),
    // Cuándo contestó (24/10/2026): la línea que escribe el motor al cortar por «Contestó» (`leerContesto`).
    db.from('lead_audit').select('valor_nuevo, autor, created_at')
      .eq('lead_id', leadId).eq('campo', 'Automatización').like('valor_nuevo', 'Contestó en «%')
      .order('created_at', { ascending: false }).limit(30),
    // Su nombre, para citar los mensajes como le llegaron («Hola Victor…», no «Hola {{nombre}}…»).
    db.from('leads').select('nombre').eq('id', leadId).maybeSingle(),
    // Lo que mandó él, para decir QUÉ contestó (`respuestaDelLead`): los últimos, sin reacciones ni avisos del sistema.
    db.from('wa_mensajes').select('texto, tipo, wa_timestamp').eq('lead_id', leadId).eq('from_me', false)
      .not('tipo', 'in', '(evento,otro)').order('wa_timestamp', { ascending: false }).limit(40),
    ws == null ? Promise.resolve('UTC') : zonaDelNegocio(ws).catch(() => 'UTC'),
  ]);
  if (ins.error) throw new Error(`el detalle del lead (inscripciones): ${ins.error.message}`);
  if (aud.error) throw new Error(`el detalle del lead (historial): ${aud.error.message}`);
  // Lo que adorna (cuándo contestó, el nombre en la cita) no tumba el bloque: sin eso, dice lo de antes.
  if (contesto.error) console.error(`[automatizaciones-del-lead] cuándo contestó (lead ${leadId}): ${contesto.error.message}`);
  if (lead.error) console.error(`[automatizaciones-del-lead] el nombre del lead ${leadId}: ${lead.error.message}`);
  if (entrantes.error) console.error(`[automatizaciones-del-lead] lo que contestó (lead ${leadId}): ${entrantes.error.message}`);
  const filas = (ins.data ?? []) as FilaInscripcionDetalle[];
  const secIds = [...new Set(filas.map((f) => Number(f.secuencia_id)))];
  if (!secIds.length) return { zona, inscripciones: [], noEntro: [] };
  const [secs, envs] = await Promise.all([
    db.from('nutricion_secuencias')
      .select('id, nombre, activa, archivada_at, pasos, instance_name, trigger_tipo, etapa, etapas, disparadores, reentrada').in('id', secIds),
    db.from('nutricion_envios').select('inscripcion_id, nodo_id, canal, estado, error, created_at')
      .in('inscripcion_id', filas.map((f) => f.id)).gte('created_at', desde).order('created_at', { ascending: false }).limit(400),
  ]);
  if (secs.error) throw new Error(`el detalle del lead (automatizaciones): ${secs.error.message}`);
  if (envs.error) throw new Error(`el detalle del lead (envíos): ${envs.error.message}`);
  const automatizaciones = (secs.data ?? []) as Array<FilaAutomatizacion & Record<string, unknown>>;
  // La reentrada la decide el motor (`reentradaDeSecuencia`: la guardada o, sin guardar, la regla de hoy).
  const { reentradaDeSecuencia } = await import('@/lib/nutricion');
  const reentradas = new Map(automatizaciones.map((s) => [Number(s.id), reentradaDeSecuencia({
    ...(s as unknown as Parameters<typeof reentradaDeSecuencia>[0]), pasos: Array.isArray(s.pasos) ? s.pasos : [],
  } as Parameters<typeof reentradaDeSecuencia>[0])] as const));
  return detalleDe({
    zona, filas, secs: automatizaciones, reentradaDe: (id) => reentradas.get(id) ?? 'una_vez',
    envios: (envs.data ?? []) as FilaEnvioDetalle[],
    audit: [...((aud.data ?? []) as FilaAuditDetalle[]), ...((contesto.data ?? []) as FilaAuditDetalle[])],
    frenoDe: await frenosDelNegocio(filas, automatizaciones), ahoraMs: Date.now(),
    nombreDelLead: ((lead.data as { nombre?: string | null } | null)?.nombre ?? null),
    entrantes: (entrantes.data ?? []) as FilaEntranteDetalle[],
  });
}

/** Saca al lead de UNA automatización: no le sale nada más. El texto es para la persona. */
export async function frenarEnAutomatizacion(leadId: number, secuenciaId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  return textoDeFrenar(await sacarDeSecuencia(leadId, secuenciaId));
}

/**
 * «EMPEZAR DE NUEVO» (23/10/2026, #289 del ws1): vuelve al primer paso una automatización en la que el lead está (o en la
 * que contestó). La MISMA inscripción manual de siempre (`inscribirEnSecuencia` con `empezarDeNuevo`: sus puertas, el
 * reclamo con compare-and-set y la vía rápida), y una línea en el historial firmada por quien lo pidió. Si no se puede, el
 * porqué en palabras (`motivoNoInscribe`).
 */
export async function empezarDeNuevoEnAutomatizacion(leadId: number, secuenciaId: number, autor: string): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const [{ inscribirEnSecuencia }, { motivoNoInscribe }, { logLeadEvent }] = await Promise.all([
    import('@/lib/nutricion'), import('@/lib/nutricion-inscripcion-manual'), import('@/lib/leads'),
  ]);
  const r = await inscribirEnSecuencia(leadId, secuenciaId, { empezarDeNuevo: true });
  if (!r.inscribe) return { ok: false, error: motivoNoInscribe(r.porque, { secuenciaId, secuencia: r.secuencia?.nombre, leadId, lead: r.lead?.nombre }) };
  const linea = `${r.lead.nombre} empezó de nuevo «${r.secuencia.nombre}», desde el primer paso.`;
  await logLeadEvent(leadId, 'Automatización', linea, autor).catch((e) => console.error(`[automatizaciones-del-lead] el historial de empezar de nuevo (lead ${leadId}):`, e instanceof Error ? e.message : e));
  // Y si algo frena lo primero (el horario, el envío apagado), lo dice: «empezó» no es «le salió» (lib/por-que-no-sale.ts).
  const ahora = await enAutomatizaciones([leadId]).then((m) => (m.get(leadId) ?? []).find((a) => a.secuenciaId === secuenciaId) ?? null).catch(() => null);
  return { ok: true, resumen: ahora?.frenado ? `${linea} ${ahora.frenado.texto}` : linea };
}

/**
 * FRENAR VARIOS DE UNA (la barra de lote del CRM, 22/10/2026): saca a los leads tildados de UNA automatización, o de TODAS
 * sus automatizaciones vivas si no se dice cuál. UNA escritura sobre las inscripciones vivas (no N llamadas: con 50 tildados
 * eran lentas y dejaban el lote a medias si una fallaba), y sus borradores pendientes descartados, como `sacarDeSecuencia`.
 * Una fila que otra corrida movió entre medio ya no está viva y no se toca. Tira si no puede escribir.
 */
export async function frenarLeadsEnAutomatizaciones(leadIds: readonly number[], secuenciaId?: number | null): Promise<{ pedidos: number; frenados: number; nombre: string | null }> {
  const ids = [...new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, TOPE_LEADS);
  const db = await getTenantDb();
  let nombre: string | null = null;
  if (secuenciaId != null) {
    const { data: sec, error: eSec } = await db.from('nutricion_secuencias').select('nombre').eq('id', secuenciaId).maybeSingle();
    if (eSec) throw new Error(`frenar (automatización): ${eSec.message}`);
    if (!sec) throw new Error('Esa automatización no existe en este negocio.');
    nombre = String((sec as { nombre?: unknown }).nombre ?? '').trim() || `Automatización #${secuenciaId}`;
  }
  if (!ids.length) return { pedidos: 0, frenados: 0, nombre };
  let q = db.from('nutricion_inscripciones')
    .update({ estado: 'cancelada', proximo_envio_at: null, updated_at: new Date().toISOString() })
    .in('lead_id', ids).in('estado', [...ESTADOS_VIVOS]);
  if (secuenciaId != null) q = q.eq('secuencia_id', secuenciaId);
  const { data, error } = await q.select('lead_id, secuencia_id');
  if (error) throw new Error(`frenar: ${error.message}`);
  const filas = (data ?? []) as Array<{ lead_id: number; secuencia_id: number }>;
  // Sus borradores pendientes, por automatización (lo que esperaba aprobación tampoco sale).
  const porSec = new Map<number, number[]>();
  for (const f of filas) porSec.set(Number(f.secuencia_id), [...(porSec.get(Number(f.secuencia_id)) ?? []), Number(f.lead_id)]);
  for (const [sec, leads] of porSec) {
    const { error: eBorr } = await db.from('wa_borradores').update({ estado: 'descartado' })
      .in('lead_id', leads).eq('secuencia_id', sec).eq('estado', 'pendiente');
    if (eBorr) console.error(`[automatizaciones-del-lead] no pude descartar los borradores de la automatización ${sec}: ${eBorr.message}`);
  }
  const frenados = new Set(filas.map((f) => Number(f.lead_id))).size;
  console.log(`[automatizaciones-del-lead] frené ${frenados} de ${ids.length} leads${secuenciaId != null ? ` en la automatización ${secuenciaId}` : ' en todas sus automatizaciones'}`);
  return { pedidos: ids.length, frenados, nombre };
}
