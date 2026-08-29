// =============================================================================
// Email Marketing — KPIs, secuencias de email y broadcasts (Resend)
// =============================================================================
// El canal email reutiliza el motor de nutrición: las "secuencias de email" son
// las secuencias de nutricion_secuencias cuyos pasos son TODOS canal='email'.
// Acá viven, además, los broadcasts (envíos puntuales a un segmento) y los KPIs
// que alimentan la tab /email.
//
// El envío real queda detrás del flag POR WORKSPACE (lib/envio-flags.ts): si
// está apagado, los broadcasts se registran 'simulado' y no se manda nada.

import { getTenantDb } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import type { PasoSecuencia } from '@/lib/nutricion';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado } from '@/lib/envio-flags';

const ahoraISO = () => new Date().toISOString();
const haceDiasISO = (d: number) => new Date(Date.now() - d * 86400 * 1000).toISOString();

// ── Una secuencia es "de email" si tiene pasos y todos son canal='email' ──────
function esSecuenciaEmail(pasos: PasoSecuencia[]): boolean {
  return pasos.length > 0 && pasos.every((p) => p.canal === 'email');
}

type SecRow = {
  id: number; clave: string; nombre: string; etapa: string;
  trigger_tipo: string; activa: boolean; pasos: unknown;
};
const parsePasos = (p: unknown): PasoSecuencia[] => (Array.isArray(p) ? (p as PasoSecuencia[]) : []);

// ── KPIs ──────────────────────────────────────────────────────────────────────
export type EmailKpi = { label: string; value: string; delta: string; deltaColor: string };

const GOOD = 'var(--good)';
const BAD = 'var(--bad)';
const DIM = 'var(--dim)';

const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

// Junta los eventos de email de los dos orígenes (nutrición + broadcasts) en un
// arreglo común {created_at, estado, abierto_at, clic_at} para los KPIs.
async function emailEventos(desdeISO?: string): Promise<Array<{ created_at: string; estado: string; abierto_at: string | null; clic_at: string | null }>> {
  const supabase = (await getTenantDb());
  let q1 = supabase.from('nutricion_envios')
    .select('created_at, estado, abierto_at, clic_at')
    .eq('canal', 'email');
  let q2 = supabase.from('email_broadcast_envios')
    .select('created_at, estado, abierto_at, clic_at');
  if (desdeISO) { q1 = q1.gte('created_at', desdeISO); q2 = q2.gte('created_at', desdeISO); }
  const [a, b] = await Promise.all([q1, q2]);
  if (a.error) throw new Error(`emailEventos nutri: ${a.error.message}`);
  if (b.error) throw new Error(`emailEventos bcast: ${b.error.message}`);
  return [
    ...((a.data ?? []) as Array<{ created_at: string; estado: string; abierto_at: string | null; clic_at: string | null }>),
    ...((b.data ?? []) as Array<{ created_at: string; estado: string; abierto_at: string | null; clic_at: string | null }>),
  ];
}

const esEnviado = (estado: string) => estado === 'enviado' || estado === 'simulado';

export async function getEmailKpis(): Promise<EmailKpi[]> {
  const supabase = (await getTenantDb());
  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
  const inicioMesISO = inicioMes.toISOString();

  // Suscriptores: leads con email, no dados de baja, todavía vivos.
  const [{ count: suscriptores }, nuevos30] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .not('email', 'is', null).eq('email_opt_out', false)
      .in('estado_lead', ['abierto', 'ganado']),
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .not('email', 'is', null).eq('email_opt_out', false)
      .in('estado_lead', ['abierto', 'ganado']).gte('created_at', haceDiasISO(30)),
  ]);

  const ult30 = await emailEventos(haceDiasISO(30));
  const enviados30 = ult30.filter((e) => esEnviado(e.estado));
  const abiertos30 = enviados30.filter((e) => e.abierto_at).length;
  const clics30 = enviados30.filter((e) => e.clic_at).length;
  const aperturaPct = pct(abiertos30, enviados30.length);
  const clicPct = pct(clics30, enviados30.length);

  const mes = (await emailEventos(inicioMesISO)).filter((e) => esEnviado(e.estado)).length;

  return [
    { label: 'Suscriptores activos', value: (suscriptores ?? 0).toLocaleString('en-US'), delta: (nuevos30.count ?? 0) > 0 ? `▲ ${nuevos30.count}` : '—', deltaColor: (nuevos30.count ?? 0) > 0 ? GOOD : DIM },
    { label: 'Tasa de apertura', value: enviados30.length ? `${aperturaPct}%` : '—', delta: 'últ. 30 días', deltaColor: DIM },
    { label: 'Tasa de clic', value: enviados30.length ? `${clicPct}%` : '—', delta: 'últ. 30 días', deltaColor: !enviados30.length ? DIM : (clicPct >= 2 ? GOOD : BAD) },
    { label: 'Emails enviados (mes)', value: mes.toLocaleString('en-US'), delta: 'este mes', deltaColor: DIM },
  ];
}

// ── Secuencias de email + stats por paso ──────────────────────────────────────
export type EmailStepStats = { sent: number; abiertos: number; clics: number };
export type EmailSecuencia = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  activa: boolean; pasos: PasoSecuencia[]; inscriptos: number; statsPorPaso: EmailStepStats[];
};

export async function getEmailSecuencias(): Promise<EmailSecuencia[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos')
    .order('id', { ascending: true });
  if (error) throw new Error(`getEmailSecuencias: ${error.message}`);

  const rows = (data ?? []) as SecRow[];
  const secuencias = rows
    .map((r) => ({ ...r, pasosArr: parsePasos(r.pasos) }))
    .filter((r) => esSecuenciaEmail(r.pasosArr));
  const ids = secuencias.map((s) => s.id);

  // Inscriptos por secuencia + envíos de email por (secuencia, paso).
  const [insc, env] = await Promise.all([
    ids.length ? supabase.from('nutricion_inscripciones').select('secuencia_id').in('secuencia_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('nutricion_envios').select('secuencia_id, paso, estado, abierto_at, clic_at').eq('canal', 'email').in('secuencia_id', ids) : Promise.resolve({ data: [], error: null }),
  ]);
  if (insc.error) throw new Error(`getEmailSecuencias insc: ${insc.error.message}`);
  if (env.error) throw new Error(`getEmailSecuencias env: ${env.error.message}`);

  const inscMap = new Map<number, number>();
  for (const r of (insc.data ?? []) as Array<{ secuencia_id: number | null }>) {
    if (r.secuencia_id == null) continue;
    inscMap.set(r.secuencia_id, (inscMap.get(r.secuencia_id) ?? 0) + 1);
  }
  // stats[secuencia_id][paso] = {sent, abiertos, clics}
  const statsMap = new Map<number, Map<number, EmailStepStats>>();
  for (const r of (env.data ?? []) as Array<{ secuencia_id: number | null; paso: number | null; estado: string; abierto_at: string | null; clic_at: string | null }>) {
    if (r.secuencia_id == null || r.paso == null) continue;
    if (!esEnviado(r.estado)) continue;
    let porPaso = statsMap.get(r.secuencia_id);
    if (!porPaso) { porPaso = new Map(); statsMap.set(r.secuencia_id, porPaso); }
    const s = porPaso.get(r.paso) ?? { sent: 0, abiertos: 0, clics: 0 };
    s.sent += 1;
    if (r.abierto_at) s.abiertos += 1;
    if (r.clic_at) s.clics += 1;
    porPaso.set(r.paso, s);
  }

  return secuencias.map((s) => ({
    id: s.id, clave: s.clave, nombre: s.nombre, etapa: s.etapa, trigger_tipo: s.trigger_tipo,
    activa: s.activa, pasos: s.pasosArr, inscriptos: inscMap.get(s.id) ?? 0,
    statsPorPaso: s.pasosArr.map((_, i) => statsMap.get(s.id)?.get(i + 1) ?? { sent: 0, abiertos: 0, clics: 0 }),
  }));
}

// Crea una secuencia de email nueva (pausada) con un paso vacío.
export async function crearEmailSecuencia(nombre: string, etapa: string, trigger: string): Promise<number> {
  const supabase = (await getTenantDb());
  const clave = `email-${Date.now().toString(36)}`;
  const pasoInicial: PasoSecuencia = { orden: 1, canal: 'email', delay_horas: 0, asunto: '', preheader: '', cuerpo: '', template_wa: null };
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .insert({ clave, nombre: nombre || 'Nueva secuencia de email', etapa: etapa || 'nutri', trigger_tipo: trigger || 'manual', activa: false, pasos: [pasoInicial] })
    .select('id')
    .single();
  if (error) throw new Error(`crearEmailSecuencia: ${error.message}`);
  return (data as { id: number }).id;
}

// Actualiza metadata de una secuencia (nombre / etapa / trigger). Solo toca los
// campos provistos.
export async function actualizarMetaEmailSecuencia(id: number, patch: { nombre?: string; etapa?: string; trigger_tipo?: string }): Promise<void> {
  const supabase = (await getTenantDb());
  const upd: Record<string, unknown> = { updated_at: ahoraISO() };
  if (typeof patch.nombre === 'string') upd.nombre = patch.nombre;
  if (typeof patch.etapa === 'string' && patch.etapa) upd.etapa = patch.etapa;
  if (typeof patch.trigger_tipo === 'string' && patch.trigger_tipo) upd.trigger_tipo = patch.trigger_tipo;
  if (Object.keys(upd).length === 1) return; // solo updated_at → nada que hacer
  const { error } = await supabase.from('nutricion_secuencias').update(upd).eq('id', id);
  if (error) throw new Error(`actualizarMetaEmailSecuencia: ${error.message}`);
}

// ── Catálogos para la UI (etapas + triggers) ─────────────────────────────────
export type Opcion = { value: string; label: string; color?: string };

// Etapas del funnel (mismas claves que nutricion_secuencias.etapa). Incluye las
// legacy del seed viejo Y las stage keys del funnel derivado (generateFunnel),
// que usan las secuencias funnel-agnósticas con trigger 'etapa_actual'.
export const ETAPAS: Opcion[] = [
  { value: 'nutri', label: 'No Agenda', color: '#6A4BD8' },
  { value: 'nopaga', label: 'No Paga', color: '#C7417B' },
  { value: 'noshow', label: 'No Show', color: '#B5630A' },
  { value: 'postagenda', label: 'Post Agenda', color: '#9D4EDD' },
  { value: 'manual', label: 'Manual', color: '#4F5BD5' },
  { value: 'noshow_r1', label: 'No Show R1', color: '#E8762B' },
  { value: 'noshow_r2', label: 'No Show R2', color: '#E8762B' },
  { value: 'noshow_r3', label: 'No Show R3', color: '#E8762B' },
  { value: 'nocompro', label: 'No Compró', color: '#C7417B' },
  { value: 'nutridiaria', label: 'Nutrición diaria (grupo)', color: '#1FA855' },
  { value: 'reactivacion', label: 'Reactivación', color: '#7A5AF0' },
];

// Triggers (cohorte que inscribe) — ver lib/nutricion.ts leadsDeCohorte.
export const TRIGGERS: Opcion[] = [
  { value: 'manual', label: 'Manual (no se dispara solo)' },
  { value: 'instant_form_sin_agenda', label: 'Dejó el formulario sin agendar' },
  { value: 'vio_vsl_sin_agendar', label: 'Vio el VSL sin agendar' },
  { value: 'vio_poco_vsl', label: 'Vio poco del VSL' },
  { value: 'agendado_sin_confirmar', label: 'Agendó pero no confirmó' },
  { value: 'no_show_j1', label: 'No asistió a R1' },
  { value: 'post_j1_sin_avanzar', label: 'Asistió a R1 pero no avanza' },
  { value: 'post_j1_calificado_sin_j2', label: 'Calificado sin R2' },
  { value: 'no_show_j2', label: 'No asistió a R2' },
  { value: 'post_j2_sin_cerrar', label: 'Asistió a R2 pero no cerró' },
  { value: 'confirmado_sin_pago', label: 'Confirmó pero no pagó' },
  { value: 'post_pago', label: 'Post pago (bienvenida)' },
  { value: 'reactivacion_viejo', label: 'Reactivación de lead frío' },
  { value: 'ultimo_intento_antes_noresp', label: 'Último intento' },
  { value: 'etapa_actual', label: 'Está en la etapa de la secuencia (funnel)' },
];

// ── Segmentos para broadcasts ─────────────────────────────────────────────────
export type Segmento = { value: string; label: string; descripcion: string };
export const SEGMENTOS: Segmento[] = [
  { value: 'activos', label: 'Todos los activos', descripcion: 'Leads abiertos o ganados con email' },
  { value: 'no-agenda', label: 'No agendaron', descripcion: 'Abiertos que nunca agendaron' },
  { value: 'no-paga', label: 'No pagaron', descripcion: 'Confirmaron pero sin primer pago' },
  { value: 'no-show', label: 'No show', descripcion: 'No asistieron a la Reunión 1' },
  { value: 'post-agenda', label: 'Asistieron a R1', descripcion: 'Ya tuvieron la Reunión 1' },
  { value: 'ganados', label: 'Clientes (ganados)', descripcion: 'Leads ganados' },
];
const SEGMENTO_VALIDO = new Set(SEGMENTOS.map((s) => s.value));
export const esSegmentoValido = (s: string): boolean => SEGMENTO_VALIDO.has(s);

type LeadDestino = { id: number; nombre: string | null; email: string; empresa: string | null };

// Filtros WHERE de cada segmento (sobre un PostgrestFilterBuilder de `leads`).
// Tipamos `q` con la firma mínima que usamos para no acoplar al tipo interno de
// supabase-js. Siempre exige email y descarta opt-out.
type LeadFilter = {
  is(col: string, val: null): LeadFilter;
  not(col: string, op: string, val: null): LeadFilter;
  eq(col: string, val: unknown): LeadFilter;
  neq(col: string, val: unknown): LeadFilter;
  in(col: string, val: readonly unknown[]): LeadFilter;
};
function filtroSegmento<T extends LeadFilter>(q: T, segmento: string): T {
  // email no nulo Y no vacío → así contarSegmento y leadsDeSegmento coinciden
  // (antes leadsDeSegmento descartaba '' en JS y el conteo lo incluía).
  let out = q.not('email', 'is', null).neq('email', '').eq('email_opt_out', false) as T;
  switch (segmento) {
    case 'no-agenda': out = out.is('fecha_agenda', null).eq('estado_lead', 'abierto') as T; break;
    case 'no-paga': out = out.not('fecha_confirmacion', 'is', null).is('fecha_primer_pago', null).in('estado_lead', ['abierto', 'ganado']) as T; break;
    case 'no-show': out = out.eq('asistio_j1', false).eq('estado_lead', 'abierto') as T; break;
    case 'post-agenda': out = out.eq('asistio_j1', true) as T; break;
    case 'ganados': out = out.eq('estado_lead', 'ganado') as T; break;
    case 'activos':
    default: out = out.in('estado_lead', ['abierto', 'ganado']) as T; break;
  }
  return out;
}

// Resuelve los leads de un segmento (siempre con email y sin opt-out).
export async function leadsDeSegmento(segmento: string): Promise<LeadDestino[]> {
  const supabase = (await getTenantDb());
  const q = supabase.from('leads').select('id, nombre, email, empresa');
  const { data, error } = await filtroSegmento(q as unknown as LeadFilter, segmento as string) as unknown as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(`leadsDeSegmento: ${error.message}`);
  return ((data ?? []) as Array<{ id: number; nombre: string | null; email: string | null; empresa: string | null }>)
    .filter((l) => !!l.email)
    .map((l) => ({ id: l.id, nombre: l.nombre, email: l.email as string, empresa: l.empresa }));
}

export async function contarSegmento(segmento: string): Promise<number> {
  const supabase = (await getTenantDb());
  const q = supabase.from('leads').select('id', { count: 'exact', head: true });
  const { count, error } = await filtroSegmento(q as unknown as LeadFilter, segmento) as unknown as { count: number | null; error: { message: string } | null };
  if (error) throw new Error(`contarSegmento: ${error.message}`);
  return count ?? 0;
}

export async function contarTodosSegmentos(): Promise<Record<string, number>> {
  const entries = await Promise.all(SEGMENTOS.map(async (s) => [s.value, await contarSegmento(s.value)] as const));
  return Object.fromEntries(entries);
}

// ── Broadcasts (CRUD + envío) ─────────────────────────────────────────────────
export type Broadcast = {
  id: number; asunto: string; preheader: string | null; cuerpo: string;
  segmento: string; estado: string; programado_at: string | null; enviado_at: string | null;
  total_destinatarios: number; created_at: string;
  enviados: number; abiertos: number; clics: number;
};

export async function getBroadcasts(): Promise<Broadcast[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('email_broadcasts')
    .select('id, asunto, preheader, cuerpo, segmento, estado, programado_at, enviado_at, total_destinatarios, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`getBroadcasts: ${error.message}`);
  const rows = (data ?? []) as Array<Omit<Broadcast, 'enviados' | 'abiertos' | 'clics'>>;

  const ids = rows.map((r) => r.id);
  const statsMap = new Map<number, { enviados: number; abiertos: number; clics: number }>();
  if (ids.length) {
    const { data: env, error: e2 } = await supabase
      .from('email_broadcast_envios')
      .select('broadcast_id, estado, abierto_at, clic_at')
      .in('broadcast_id', ids);
    if (e2) throw new Error(`getBroadcasts envios: ${e2.message}`);
    for (const r of (env ?? []) as Array<{ broadcast_id: number; estado: string; abierto_at: string | null; clic_at: string | null }>) {
      const s = statsMap.get(r.broadcast_id) ?? { enviados: 0, abiertos: 0, clics: 0 };
      if (esEnviado(r.estado)) { s.enviados += 1; if (r.abierto_at) s.abiertos += 1; if (r.clic_at) s.clics += 1; }
      statsMap.set(r.broadcast_id, s);
    }
  }
  return rows.map((r) => ({ ...r, ...(statsMap.get(r.id) ?? { enviados: 0, abiertos: 0, clics: 0 }) }));
}

export async function crearBroadcast(input: { asunto?: string; preheader?: string; cuerpo?: string; segmento?: string }): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('email_broadcasts')
    .insert({
      asunto: input.asunto ?? 'Nuevo broadcast',
      preheader: input.preheader ?? null,
      cuerpo: input.cuerpo ?? '',
      segmento: input.segmento && esSegmentoValido(input.segmento) ? input.segmento : 'activos',
      estado: 'borrador',
    })
    .select('id')
    .single();
  if (error) throw new Error(`crearBroadcast: ${error.message}`);
  return (data as { id: number }).id;
}

export async function actualizarBroadcast(id: number, patch: { asunto?: string; preheader?: string | null; cuerpo?: string; segmento?: string; programado_at?: string | null; estado?: string }): Promise<void> {
  const supabase = (await getTenantDb());
  const upd: Record<string, unknown> = { updated_at: ahoraISO() };
  if (patch.asunto !== undefined) upd.asunto = patch.asunto;
  if (patch.preheader !== undefined) upd.preheader = patch.preheader;
  if (patch.cuerpo !== undefined) upd.cuerpo = patch.cuerpo;
  if (patch.segmento !== undefined && esSegmentoValido(patch.segmento)) upd.segmento = patch.segmento;
  if (patch.programado_at !== undefined) upd.programado_at = patch.programado_at;
  if (patch.estado !== undefined && ['borrador', 'programado', 'cancelado'].includes(patch.estado)) upd.estado = patch.estado;
  const { error } = await supabase.from('email_broadcasts').update(upd).eq('id', id);
  if (error) throw new Error(`actualizarBroadcast: ${error.message}`);
}

export async function eliminarBroadcast(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('email_broadcasts').delete().eq('id', id);
  if (error) throw new Error(`eliminarBroadcast: ${error.message}`);
}

// Envía un email de prueba del broadcast a una dirección (no toca el estado).
export async function enviarBroadcastPrueba(id: number, emailPrueba: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('email_broadcasts').select('asunto, preheader, cuerpo').eq('id', id).single();
  if (error) return { ok: false, error: error.message };
  const b = data as { asunto: string; preheader: string | null; cuerpo: string };
  const vars = valoresVariablesLead({ nombre: 'Martín', empresa: 'MaKo' });
  const asunto = aplicarVariables(b.asunto, vars) || '(sin asunto)';
  const r = await sendEmail({
    to: emailPrueba,
    subject: `[PRUEBA] ${asunto}`,
    html: renderEmailHtml({ subject: asunto, bodyText: aplicarVariables(b.cuerpo, vars), preheader: aplicarVariables(b.preheader ?? '', vars) || undefined, fromName: displayNameDe(await getEmailFrom()) }),
    text: aplicarVariables(b.cuerpo, vars),
    tags: [{ name: 'tipo', value: 'broadcast-prueba' }],
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

const MAX_DESTINATARIOS = 2000; // tope de seguridad por broadcast
const GUARD_HORAS = 20;         // no contactar al mismo lead 2 veces en <20h

export type ResultadoBroadcast = { ok: boolean; enviados: number; simulados: number; fallos: number; saltados: number; total: number; truncado?: boolean; error?: string };

// lead_ids que ya recibieron un email (nutrición o broadcast) en las últimas N
// horas → para no contactarlos de nuevo con un broadcast (guard anti-spam).
async function leadsContactadosRecientemente(): Promise<Set<number>> {
  const supabase = (await getTenantDb());
  const desde = new Date(Date.now() - GUARD_HORAS * 3600 * 1000).toISOString();
  const [nutri, bcast] = await Promise.all([
    supabase.from('nutricion_envios').select('lead_id').eq('canal', 'email').in('estado', ['enviado', 'simulado']).gte('created_at', desde),
    supabase.from('email_broadcast_envios').select('lead_id').in('estado', ['enviado', 'simulado']).gte('created_at', desde),
  ]);
  const set = new Set<number>();
  for (const r of (nutri.data ?? []) as Array<{ lead_id: number | null }>) if (r.lead_id != null) set.add(r.lead_id);
  for (const r of (bcast.data ?? []) as Array<{ lead_id: number | null }>) if (r.lead_id != null) set.add(r.lead_id);
  return set;
}

// Envía el broadcast a su segmento. Registra cada destinatario en
// email_broadcast_envios y marca el broadcast como 'enviado'. Si EMAIL_SEND_ENABLED
// está apagado, registra 'simulado' (no manda nada real). Saltea leads contactados
// en las últimas 20h (anti-spam). Un segmento vacío NO se marca enviado.
export async function enviarBroadcast(id: number): Promise<ResultadoBroadcast> {
  const supabase = (await getTenantDb());
  const vacio = (error?: string): ResultadoBroadcast => ({ ok: false, enviados: 0, simulados: 0, fallos: 0, saltados: 0, total: 0, error });
  const { data, error } = await supabase
    .from('email_broadcasts')
    .select('id, asunto, preheader, cuerpo, segmento, estado')
    .eq('id', id)
    .single();
  if (error) return vacio(error.message);
  const b = data as { id: number; asunto: string; preheader: string | null; cuerpo: string; segmento: string; estado: string };
  if (b.estado === 'enviado') return vacio('el broadcast ya fue enviado');

  // Flag de envío real DEL WORKSPACE + preflight de remitente: si el envío está
  // activo pero el remitente sigue siendo sandbox, no mandamos (Resend
  // rechazaría a terceros). No marcamos enviado.
  const emailOn = await envioEmailHabilitado();
  if (emailOn && (await remitenteEsSandbox())) {
    return vacio('remitente sandbox: verifica tu dominio de envío antes de enviar');
  }

  const todos = await leadsDeSegmento(b.segmento);
  if (todos.length === 0) return vacio('el segmento no tiene destinatarios con email');
  const truncado = todos.length > MAX_DESTINATARIOS;
  const candidatos = todos.slice(0, MAX_DESTINATARIOS);

  // REANUDABLE: si el broadcast quedó 'enviando' (timeout de una corrida
  // anterior, rate-limit), los leads ya registrados no se re-envían.
  const { data: yaRows } = await supabase
    .from('email_broadcast_envios').select('lead_id').eq('broadcast_id', id);
  const yaRegistrados = new Set(((yaRows ?? []) as Array<{ lead_id: number | null }>).map((r) => r.lead_id).filter((x): x is number => x != null));
  const destinatarios = candidatos.filter((l) => !yaRegistrados.has(l.id));

  const recientes = await leadsContactadosRecientemente();
  const fromNameWs = displayNameDe(await getEmailFrom());

  await supabase.from('email_broadcasts').update({ estado: 'enviando', updated_at: ahoraISO() }).eq('id', id);

  const res: ResultadoBroadcast = { ok: true, enviados: 0, simulados: 0, fallos: 0, saltados: 0, total: candidatos.length, truncado };
  let filas: Array<Record<string, unknown>> = [];
  const flush = async () => {
    if (!filas.length) return;
    await supabase.from('email_broadcast_envios').insert(filas);
    filas = [];
  };

  // Presupuesto de tiempo: los serverless cortan a los ~300s. Persistimos el
  // progreso cada CHUNK y salimos ANTES del límite dejando 'enviando' — la
  // próxima corrida (cron o botón) reanuda desde donde quedó.
  const tInicio = Date.now();
  const TIEMPO_MAX_MS = 240_000;
  const CHUNK = 100;
  let completo = true;

  for (const lead of destinatarios) {
    if (Date.now() - tInicio > TIEMPO_MAX_MS) { completo = false; break; }
    if (recientes.has(lead.id)) {
      res.saltados += 1;
      filas.push({ broadcast_id: id, lead_id: lead.id, destino: lead.email, estado: 'saltado', error: 'contacto reciente (<20h)' });
      if (filas.length >= CHUNK) await flush();
      continue;
    }
    const vars = valoresVariablesLead(lead);
    const asunto = aplicarVariables(b.asunto, vars) || '(sin asunto)';
    const cuerpo = aplicarVariables(b.cuerpo, vars);
    const unsubUrl = buildUnsubscribeUrl(lead.id);

    let estado: 'enviado' | 'simulado' | 'fallo' = 'simulado';
    let proveedorId: string | null = null;
    let errMsg: string | null = null;

    if (emailOn) {
      const r = await sendEmail({
        to: lead.email,
        subject: asunto,
        html: renderEmailHtml({ subject: asunto, bodyText: cuerpo, preheader: aplicarVariables(b.preheader ?? '', vars) || undefined, unsubscribeUrl: unsubUrl, fromName: fromNameWs }),
        text: cuerpo,
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        tags: [{ name: 'tipo', value: 'broadcast' }, { name: 'broadcast_id', value: String(id) }],
      });
      if (r.ok) { estado = 'enviado'; proveedorId = r.id; res.enviados += 1; }
      else if (/rate|429|too many/i.test(r.error)) {
        // Rate limit de Resend: NO registrar este lead (se reintenta en la
        // reanudación) y cortar la corrida acá.
        completo = false;
        break;
      } else { estado = 'fallo'; errMsg = r.error; res.fallos += 1; }
    } else {
      res.simulados += 1;
    }

    filas.push({ broadcast_id: id, lead_id: lead.id, destino: lead.email, estado, proveedor_id: proveedorId, error: errMsg });
    if (filas.length >= CHUNK) await flush();
  }
  await flush();

  if (!completo) {
    // Quedó a medias: se mantiene 'enviando' y la próxima corrida reanuda.
    await supabase.from('email_broadcasts').update({ updated_at: ahoraISO() }).eq('id', id);
    return { ...res, ok: true, error: 'parcial: se reanuda en la próxima corrida' };
  }

  // Total real de destinatarios que recibieron (histórico + esta corrida, sin saltados).
  const { count: totalRecibieron } = await supabase
    .from('email_broadcast_envios')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', id)
    .in('estado', ['enviado', 'simulado']);

  await supabase.from('email_broadcasts').update({
    estado: 'enviado',
    enviado_at: ahoraISO(),
    total_destinatarios: totalRecibieron ?? res.enviados + res.simulados,
    updated_at: ahoraISO(),
  }).eq('id', id);

  return res;
}

// Procesa los broadcasts programados que ya vencieron (lo llama el cron).
// También reanuda los que quedaron atascados en 'enviando' (timeout/rate-limit
// de una corrida anterior) con más de 10 minutos sin actividad.
export async function procesarBroadcastsProgramados(): Promise<{ procesados: number; detalle: ResultadoBroadcast[] }> {
  const supabase = (await getTenantDb());
  const hace10min = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [prog, stuck] = await Promise.all([
    supabase.from('email_broadcasts').select('id').eq('estado', 'programado').lte('programado_at', ahoraISO()),
    supabase.from('email_broadcasts').select('id').eq('estado', 'enviando').lt('updated_at', hace10min),
  ]);
  if (prog.error) throw new Error(`procesarBroadcastsProgramados: ${prog.error.message}`);
  const ids = [...new Set([
    ...((prog.data ?? []) as Array<{ id: number }>).map((r) => r.id),
    ...((stuck.data ?? []) as Array<{ id: number }>).map((r) => r.id),
  ])];
  const detalle: ResultadoBroadcast[] = [];
  for (const id of ids) detalle.push(await enviarBroadcast(id));
  return { procesados: ids.length, detalle };
}

// ── Webhook de Resend: marca abierto/clic/rebote por proveedor_id ─────────────
// DELIBERADAMENTE SIN SCOPE de workspace (getSupabaseServer, no getTenantDb):
// el webhook llega sin sesión (getTenantDb colapsaría al dueño y los eventos de
// los emails de un CLIENTE jamás matchearían). El proveedor_id es el id del
// email en Resend — único global — así que buscar cross-workspace es correcto
// y no filtra datos: solo estampa timestamps en la fila dueña de ese id.
export async function marcarEventoEmail(proveedorId: string, tipo: 'abierto' | 'clic', whenISO: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const col = tipo === 'abierto' ? 'abierto_at' : 'clic_at';
  let tocado = false;
  for (const tabla of ['nutricion_envios', 'email_broadcast_envios'] as const) {
    const { data, error } = await supabase
      .from(tabla)
      .update({ [col]: whenISO })
      .eq('proveedor_id', proveedorId)
      .is(col, null)
      .select('id');
    if (!error && ((data ?? []) as unknown[]).length > 0) tocado = true;
  }
  return tocado;
}

// Rebote/queja → además de loguear, da de baja al lead (supresión). Igual que
// marcarEventoEmail: sin scope, el proveedor_id identifica la fila exacta y el
// update de leads va por PK global.
export async function suprimirPorRebote(proveedorId: string): Promise<void> {
  const supabase = getSupabaseServer();
  // Encontrar el lead por el proveedor_id en cualquiera de los dos logs.
  for (const tabla of ['nutricion_envios', 'email_broadcast_envios'] as const) {
    const { data } = await supabase.from(tabla).select('lead_id').eq('proveedor_id', proveedorId).limit(1);
    const leadId = ((data ?? []) as Array<{ lead_id: number | null }>)[0]?.lead_id;
    if (leadId) {
      await supabase.from('leads').update({ email_opt_out: true }).eq('id', leadId);
      return;
    }
  }
}
