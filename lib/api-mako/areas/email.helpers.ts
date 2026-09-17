// =============================================================================
// api-mako/areas/email.helpers — lecturas del área `email` que lib/ no exporta
// =============================================================================
// Todo con getTenantDb() (scopea por el workspace en curso, que ejecutarOperacion
// fija con runWithWorkspace). Nada acá escribe: por eso las escrituras condicionales
// que pidió la revisión (actualizarBroadcastSi / eliminarBroadcastSi) NO están acá,
// son deuda de lib/email-marketing.ts.
//
// ⚠️ DEUDA: estas lecturas deberían vivir en lib/email-marketing.ts. Están acá
// porque el implementador del área no toca libs compartidas:
//   · estadoEmail()       copia estadoActual() de app/api/email/dominio/route.ts.
//   · historialEmailLead() / bajasEmail() no existen en ninguna lib.
//   · contar*() existen para AVISAR que las stats de la lib quedaron cortas:
//     getEmailKpis, getEmailSecuencias y getBroadcasts leen envíos sin paginar y
//     PostgREST corta en 1000 filas sin error.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { getSetting, getSettingEstricto } from '@/lib/settings';
import { KEY_TIMEZONE, esTzValida } from '@/lib/timezone';
import { getEmailFrom, emailConectado, remitenteEsSandbox, resendConfigurado, getResendDomain, type ResendDnsRecord } from '@/lib/resend';
import { envioEmailHabilitado } from '@/lib/envio-flags';

/** El tope silencioso de PostgREST por request. */
export const TOPE_POSTGREST = 1000;

export type EstadoEmail = {
  conectado: boolean; envio_real_habilitado: boolean; remitente_sandbox: boolean; resend_configurado: boolean;
  dominio: string | null; remitente: string; estado_dominio: string | null;
  error_dominio: string | null; registros_dns: ResendDnsRecord[];
  /** registros cuyo status no es «verified» (los que faltan o están pendientes) */
  registros_dns_sin_verificar: number;
  /** no se pudo leer el dominio cargado en la base: dominio null NO significa «no hay» */
  error_lectura: string | null;
};

/** El mismo agregado que GET /api/email/dominio (estadoActual), con el error de
 *  Resend a la vista: la key de producción es «sending only» y GET /domains da 401,
 *  y sin esto un estado_dominio null se lee como «no hay dominio». */
export async function estadoEmail(): Promise<EstadoEmail> {
  // Estricto: getSetting convierte un 5xx en null, y un null acá se leía como «este
  // negocio no cargó un dominio», que es una afirmación falsa sobre el cliente.
  const leerDominio = async (): Promise<{ dominio: string | null; id: string | null; error: string | null }> => {
    try {
      const [d, i] = await Promise.all([getSettingEstricto('resend_domain'), getSettingEstricto('resend_domain_id')]);
      return { dominio: d?.trim() || null, id: i?.trim() || null, error: null };
    } catch (e) {
      return { dominio: null, id: null, error: e instanceof Error ? e.message : String(e) };
    }
  };
  const [leido, remitente, conectado, envio, sandbox, keyOk] = await Promise.all([
    leerDominio(), getEmailFrom(),
    emailConectado(), envioEmailHabilitado(), remitenteEsSandbox(), resendConfigurado(),
  ]);
  const id = leido.id;
  let estado: string | null = null;
  let registros: ResendDnsRecord[] = [];
  let errorDominio: string | null = null;
  if (id) {
    const r = await getResendDomain(id);
    if (r.ok) { estado = r.domain.status; registros = r.domain.records; }
    else errorDominio = r.error;
  }
  return {
    conectado, envio_real_habilitado: envio, remitente_sandbox: sandbox, resend_configurado: keyOk,
    dominio: leido.dominio, remitente, estado_dominio: estado, error_dominio: errorDominio, registros_dns: registros,
    registros_dns_sin_verificar: registros.filter((r) => r.status && r.status !== 'verified').length,
    error_lectura: leido.error,
  };
}

/** id del dominio de envío cargado en el negocio, o null. Estricto: un error de
 *  lectura tira, en vez de contestar «no hay dominio». */
export async function dominioIdDelWorkspace(): Promise<string | null> {
  return (await getSettingEstricto('resend_domain_id'))?.trim() || null;
}

/** La zona horaria GUARDADA del negocio, o null. Solo lee: tzDeWorkspace() la
 *  averigua y la ESCRIBE cuando falta, y preparar() no puede escribir. */
export async function tzGuardada(): Promise<string | null> {
  const tz = (await getSetting(KEY_TIMEZONE))?.trim();
  return tz && esTzValida(tz) ? tz : null;
}

/** Lo que empieza a salir de verdad al prender el envío real de email. Cuenta lo
 *  mismo que el motor manda: secuencias activas NO archivadas (getSecuenciasActivas
 *  en lib/nutricion.ts filtra archivada_at) con AL MENOS un paso canal='email' —las
 *  mixtas también mandan email—, y los broadcasts programados. getEmailSecuencias
 *  no sirve para esto: exige TODOS los pasos por email y no mira archivada_at.
 *  Sin paginar: las secuencias de un negocio son decenas, no miles. */
export async function alcanceEnvioReal(): Promise<{ secuencias_con_email: number; broadcasts_programados: number }> {
  const db = await getTenantDb();
  const [secs, programados] = await Promise.all([
    db.from('nutricion_secuencias').select('id, pasos').eq('activa', true).is('archivada_at', null),
    contar('email_broadcasts', { eq: { estado: 'programado' } }),
  ]);
  if (secs.error) throw new Error(`alcanceEnvioReal: ${secs.error.message}`);
  const conEmail = ((secs.data ?? []) as Array<{ pasos: unknown }>)
    .filter((r) => Array.isArray(r.pasos) && (r.pasos as Array<{ canal?: string }>).some((p) => p?.canal === 'email')).length;
  return { secuencias_con_email: conEmail, broadcasts_programados: programados };
}

type Filtro = { eq?: Record<string, unknown>; in?: [string, readonly unknown[]]; gte?: [string, string] };

/** Cuántas filas hay de verdad (count exact, sin traerlas). */
async function contar(tabla: string, f: Filtro): Promise<number> {
  const db = await getTenantDb();
  let q = db.from(tabla).select('id', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(f.eq ?? {})) q = q.eq(k, v);
  if (f.in) q = q.in(f.in[0], f.in[1] as unknown[]);
  if (f.gte) q = q.gte(f.gte[0], f.gte[1]);
  const { count, error } = await q;
  if (error) throw new Error(`contar ${tabla}: ${error.message}`);
  return count ?? 0;
}

/** Envíos de email (nutrición y broadcasts) desde una fecha: si alguno pasa de
 *  1000, los KPIs de getEmailKpis quedaron calculados sobre un recorte. */
export async function enviosEmailDesde(desdeISO: string): Promise<{ nutricion: number; broadcasts: number }> {
  const [nutricion, broadcasts] = await Promise.all([
    contar('nutricion_envios', { eq: { canal: 'email' }, gte: ['created_at', desdeISO] }),
    contar('email_broadcast_envios', { gte: ['created_at', desdeISO] }),
  ]);
  return { nutricion, broadcasts };
}

export async function filasDeSecuencias(ids: number[]): Promise<{ envios: number; inscripciones: number }> {
  if (!ids.length) return { envios: 0, inscripciones: 0 };
  const [envios, inscripciones] = await Promise.all([
    contar('nutricion_envios', { eq: { canal: 'email' }, in: ['secuencia_id', ids] }),
    contar('nutricion_inscripciones', { in: ['secuencia_id', ids] }),
  ]);
  return { envios, inscripciones };
}

export async function filasDeBroadcasts(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  return contar('email_broadcast_envios', { in: ['broadcast_id', ids] });
}

/** getEmailSecuencias no filtra archivadas (getSecuenciasActivas sí): se marcan. */
export async function secuenciasArchivadas(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id').in('id', ids).not('archivada_at', 'is', null);
  if (error) throw new Error(`secuenciasArchivadas: ${error.message}`);
  return new Set(((data ?? []) as Array<{ id: number }>).map((r) => r.id));
}

export async function leadDelWorkspace(leadId: number): Promise<{ id: number; nombre: string | null; email: string | null; email_opt_out: boolean } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre, email, email_opt_out').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`leadDelWorkspace: ${error.message}`);
  return (data as { id: number; nombre: string | null; email: string | null; email_opt_out: boolean } | null) ?? null;
}

type EnvioFila = { secuencia_id?: number | null; broadcast_id?: number | null; paso?: number | null; estado: string; created_at: string; abierto_at: string | null; clic_at: string | null; error: string | null };

/** Los últimos envíos de email de un lead, de las DOS tablas de envío, más los totales. */
export async function historialEmailLead(leadId: number, limite: number) {
  const db = await getTenantDb();
  const [nutri, bcast, totalNutri, totalBcast] = await Promise.all([
    db.from('nutricion_envios').select('secuencia_id, paso, estado, created_at, abierto_at, clic_at, error')
      .eq('canal', 'email').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(limite),
    db.from('email_broadcast_envios').select('broadcast_id, estado, created_at, abierto_at, clic_at, error')
      .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(limite),
    contar('nutricion_envios', { eq: { canal: 'email', lead_id: leadId } }),
    contar('email_broadcast_envios', { eq: { lead_id: leadId } }),
  ]);
  if (nutri.error) throw new Error(`historialEmailLead nutricion: ${nutri.error.message}`);
  if (bcast.error) throw new Error(`historialEmailLead broadcasts: ${bcast.error.message}`);
  return {
    secuencias: (nutri.data ?? []) as EnvioFila[], broadcasts: (bcast.data ?? []) as EnvioFila[],
    total_secuencias: totalNutri, total_broadcasts: totalBcast,
  };
}

export async function bajasEmail(limite: number) {
  const db = await getTenantDb();
  const [filas, total] = await Promise.all([
    db.from('leads').select('id, nombre, email').eq('email_opt_out', true).order('id', { ascending: false }).limit(limite),
    contar('leads', { eq: { email_opt_out: true } }),
  ]);
  if (filas.error) throw new Error(`bajasEmail: ${filas.error.message}`);
  return { leads: (filas.data ?? []) as Array<{ id: number; nombre: string | null; email: string | null }>, total };
}
