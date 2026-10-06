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
import { leerTodo, leerPorPaginas, type ConsultaPaginada } from '@/lib/supabase-paginado';
import type { PasoSecuencia } from '@/lib/nutricion';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado } from '@/lib/envio-flags';
import { enTandas } from '@/lib/ids-con-filas';
import { COLS_RESIDUO, RESIDUO_DIAS, SEGMENTO_RESIDUO, esResiduoFormulario, type LeadResiduo } from '@/lib/nutricion-residuo';

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

const ESTADOS_ENVIADO = ['enviado', 'simulado'];
const esEnviado = (estado: string) => ESTADOS_ENVIADO.includes(estado);

// Cuántos emails ENVIADOS (nutrición + broadcasts) desde `desdeISO`; con `marca`,
// solo los que además tienen abierto_at / clic_at.
//
// Se CUENTA en el server (count exact + head) y no se bajan las filas. Antes esto
// traía {created_at, estado, abierto_at, clic_at} de las dos tablas SIN paginar y
// contaba en JS: PostgREST corta en 1.000 sin avisar, así que el primer broadcast
// a un segmento grande (ws1 tiene 1.044 «activos») dejaba el KPI «Emails enviados
// (mes)» clavado en 1.000 y las tasas de apertura/clic calculadas sobre una
// muestra arbitraria. Para un número no hacen falta las filas: un conteo no se
// trunca.
async function contarEnviosEmail(desdeISO: string, marca?: 'abierto_at' | 'clic_at'): Promise<number> {
  const supabase = (await getTenantDb());
  const contar = async (tabla: 'nutricion_envios' | 'email_broadcast_envios'): Promise<number> => {
    let q = supabase.from(tabla).select('id', { count: 'exact', head: true })
      .in('estado', ESTADOS_ENVIADO).gte('created_at', desdeISO);
    if (tabla === 'nutricion_envios') q = q.eq('canal', 'email');
    if (marca) q = q.not(marca, 'is', null);
    const { count, error } = await q;
    if (error) throw new Error(`contarEnviosEmail ${tabla}: ${error.message}`);
    return count ?? 0;
  };
  const [nutri, bcast] = await Promise.all([contar('nutricion_envios'), contar('email_broadcast_envios')]);
  return nutri + bcast;
}

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

  const desde30 = haceDiasISO(30);
  const [enviados30, abiertos30, clics30, mes] = await Promise.all([
    contarEnviosEmail(desde30),
    contarEnviosEmail(desde30, 'abierto_at'),
    contarEnviosEmail(desde30, 'clic_at'),
    contarEnviosEmail(inicioMesISO),
  ]);
  const aperturaPct = pct(abiertos30, enviados30);
  const clicPct = pct(clics30, enviados30);

  return [
    { label: 'Suscriptores activos', value: (suscriptores ?? 0).toLocaleString('en-US'), delta: (nuevos30.count ?? 0) > 0 ? `▲ ${nuevos30.count}` : '—', deltaColor: (nuevos30.count ?? 0) > 0 ? GOOD : DIM },
    { label: 'Tasa de apertura', value: enviados30 ? `${aperturaPct}%` : '—', delta: 'últ. 30 días', deltaColor: DIM },
    { label: 'Tasa de clic', value: enviados30 ? `${clicPct}%` : '—', delta: 'últ. 30 días', deltaColor: !enviados30 ? DIM : (clicPct >= 2 ? GOOD : BAD) },
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
  //
  // Los dos se leen PAGINADOS y se agregan al vuelo (de cada fila sobrevive un
  // contador). Antes eran `.select()` sueltos: nutricion_envios suma una fila por
  // cada email que sale y nutricion_inscripciones una por cada lead inscripto, así
  // que pasadas las 1.000 filas PostgREST cortaba sin avisar y los «inscriptos» y
  // los «enviados/abiertos/clics por paso» de la tab /email quedaban calculados
  // sobre una muestra arbitraria — un número plausible, más chico que el real. El
  // orden es por `id` (PK): paginar sin un orden único repite y saltea filas.
  const inscMap = new Map<number, number>();
  // stats[secuencia_id][paso] = {sent, abiertos, clics}
  const statsMap = new Map<number, Map<number, EmailStepStats>>();
  if (ids.length) {
    try {
      await Promise.all([
        leerPorPaginas<{ secuencia_id: number | null }>(
          supabase, 'nutricion_inscripciones', 'id, secuencia_id',
          (filas) => {
            for (const r of filas) {
              if (r.secuencia_id == null) continue;
              inscMap.set(r.secuencia_id, (inscMap.get(r.secuencia_id) ?? 0) + 1);
            }
          },
          { orden: 'id', filtros: (q) => q.in('secuencia_id', ids) as ConsultaPaginada },
        ),
        leerPorPaginas<{ secuencia_id: number | null; paso: number | null; abierto_at: string | null; clic_at: string | null }>(
          supabase, 'nutricion_envios', 'id, secuencia_id, paso, abierto_at, clic_at',
          (filas) => {
            for (const r of filas) {
              if (r.secuencia_id == null || r.paso == null) continue;
              let porPaso = statsMap.get(r.secuencia_id);
              if (!porPaso) { porPaso = new Map(); statsMap.set(r.secuencia_id, porPaso); }
              const s = porPaso.get(r.paso) ?? { sent: 0, abiertos: 0, clics: 0 };
              s.sent += 1;
              if (r.abierto_at) s.abiertos += 1;
              if (r.clic_at) s.clics += 1;
              porPaso.set(r.paso, s);
            }
          },
          // Solo los ENVIADOS: el filtro de estado va en el server (antes se bajaban
          // también los fallidos/saltados para tirarlos en JS).
          { orden: 'id', eq: { canal: 'email' }, filtros: (q) => q.in('secuencia_id', ids).in('estado', ESTADOS_ENVIADO) as ConsultaPaginada },
        ),
      ]);
    } catch (e) {
      throw new Error(`getEmailSecuencias: ${e instanceof Error ? e.message : String(e)}`);
    }
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
  // Las dos mitades de la post-agenda. Se ofrecen aparte porque no reciben lo
  // mismo: al que ya te escuchó no se le puede decir «soy Fulano» de nuevo.
  { value: 'agendado_ya_contactado', label: 'Agendó después de tu bienvenida' },
  { value: 'agendado_primer_contacto', label: 'Agendó sin haber hablado contigo' },
  { value: 'no_show_j1', label: 'No asistió a R1' },
  { value: 'post_j1_sin_avanzar', label: 'Asistió a R1 pero no avanza' },
  { value: 'post_j1_calificado_sin_j2', label: 'Calificado sin R2' },
  { value: 'no_show_j2', label: 'No asistió a R2' },
  { value: 'post_j2_sin_cerrar', label: 'Asistió a R2 pero no cerró' },
  { value: 'confirmado_sin_pago', label: 'Confirmó pero no pagó' },
  { value: 'post_pago', label: 'Post pago (bienvenida)' },
  { value: 'reactivacion_viejo', label: 'Reactivación de lead frío' },
  { value: 'ultimo_intento_antes_noresp', label: 'Último intento' },
  // El residuo con reunión (#790, lib/nutricion-residuo.ts): pasados los 45 días ya
  // no lo alcanza ningún disparador de reunión.
  { value: 'residuo_sin_cierre', label: 'Tuvo reunión hace +45 días y no cerró' },
  { value: 'etapa_actual', label: 'Está en la etapa de la secuencia (funnel)' },
  // La ENTREGA del servicio (el kanban de Customer Success, mig 0188/0189). Trigger
  // propio y no un valor más de `etapa_actual`: las claves de las dos listas de etapas
  // las edita el cliente y podrían chocar — ver lib/nutricion-etapa.ts.
  { value: 'entrega_actual', label: 'Llegó a una etapa de la ENTREGA del servicio' },
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
  // El residuo sin agenda (#790). La decisión es pura y tiene test
  // (`esResiduoFormulario`, lib/nutricion-residuo.ts); acá sólo se la llama.
  { value: SEGMENTO_RESIDUO, label: 'Sin agenda, +45 días', descripcion: 'Abiertos sin reunión ni pago, de hace más de 45 días' },
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
  lt(col: string, val: unknown): LeadFilter;
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
    // Sólo el PREFILTRO: la decisión la toma `esResiduoFormulario` en
    // `leadsDeSegmento`, que además mira la tabla `pagos` (ver `contarSegmento`).
    case SEGMENTO_RESIDUO: out = out.eq('estado_lead', 'abierto').is('fecha_agenda', null)
      .is('fecha_junta_1', null).is('fecha_junta_2', null).is('fecha_primer_pago', null)
      .lt('created_at', haceDiasISO(RESIDUO_DIAS)) as T; break;
    case 'activos':
    default: out = out.in('estado_lead', ['abierto', 'ganado']) as T; break;
  }
  return out;
}

// Resuelve los leads de un segmento (siempre con email y sin opt-out).
export async function leadsDeSegmento(segmento: string): Promise<LeadDestino[]> {
  const supabase = (await getTenantDb());
  if (segmento === SEGMENTO_RESIDUO) return leadsDelResiduo(supabase);
  // Paginado por `id`. Es el destinatario de un envío: el segmento "activos" de
  // ws1 son 1044 leads, el `.select()` suelto devolvía 1000 y el broadcast le
  // llegaba a 1000 — mientras `contarSegmento` (count exact, que sí cuenta bien)
  // le prometía 1044 en pantalla. 44 personas sin su email y ningún log.
  let data: Array<{ id: number; nombre: string | null; email: string | null; empresa: string | null }>;
  try {
    data = await leerTodo(supabase, 'leads', 'id, nombre, email, empresa', {
      filtros: (q) => filtroSegmento(q as unknown as LeadFilter, segmento) as unknown as ConsultaPaginada,
    });
  } catch (e) {
    throw new Error(`leadsDeSegmento: ${e instanceof Error ? e.message : String(e)}`);
  }
  return data
    .filter((l) => !!l.email)
    .map((l) => ({ id: l.id, nombre: l.nombre, email: l.email as string, empresa: l.empresa }));
}

/**
 * Los destinatarios del segmento del residuo: el prefiltro de `filtroSegmento` y,
 * encima, la decisión pura, que además mira la tabla `pagos` (un lead puede tener un
 * pago registrado y la columna `fecha_primer_pago` vacía, y a ése no se le manda).
 * Lanza si no puede leer los pagos: «no pude leer» no es «nadie pagó».
 */
async function leadsDelResiduo(supabase: Awaited<ReturnType<typeof getTenantDb>>): Promise<LeadDestino[]> {
  try {
    const candidatos = await leerTodo<LeadResiduo & { nombre: string | null; empresa: string | null }>(
      supabase, 'leads', `${COLS_RESIDUO}, nombre, empresa`,
      { orden: 'id', filtros: (q) => filtroSegmento(q as unknown as LeadFilter, SEGMENTO_RESIDUO) as unknown as ConsultaPaginada },
    );
    const pagados = new Set<number>();
    for (const tanda of enTandas(candidatos.map((l) => l.id), 200)) {
      const pagos = await leerTodo<{ lead_id: number | null }>(supabase, 'pagos', 'id, lead_id', {
        orden: 'id', eq: { pagado: true }, filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
      });
      for (const p of pagos) if (p.lead_id != null) pagados.add(Number(p.lead_id));
    }
    const ahoraMs = Date.now();
    return candidatos
      .filter((l) => esResiduoFormulario(l, { ahoraMs, pagados }))
      .map((l) => ({ id: l.id, nombre: l.nombre, email: (l.email ?? '').trim(), empresa: l.empresa }));
  } catch (e) {
    throw new Error(`leadsDeSegmento(${SEGMENTO_RESIDUO}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function contarSegmento(segmento: string): Promise<number> {
  // ⚠️ EL RESIDUO SE CUENTA CON LA MISMA FUNCIÓN QUE ARMA LOS DESTINATARIOS. Un
  // `count` del prefiltro contaría también a quien tiene un pago en `pagos`: la
  // pantalla prometería N y el broadcast le llegaría a menos, sin decir por qué.
  if (segmento === SEGMENTO_RESIDUO) return (await leadsDeSegmento(segmento)).length;
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
    // Paginado y agregado al vuelo. Son UNA fila por destinatario de CADA
    // broadcast: un solo envío al segmento «activos» de ws1 (1.044) ya pasa el
    // techo de 1.000 de PostgREST, y el `.select()` suelto de antes cortaba sin
    // avisar → la lista de broadcasts mostraba menos enviados/abiertos/clics de
    // los reales. Orden por `id` (PK), que es lo que hace confiable el OFFSET.
    try {
      await leerPorPaginas<{ broadcast_id: number; estado: string; abierto_at: string | null; clic_at: string | null }>(
        supabase, 'email_broadcast_envios', 'id, broadcast_id, estado, abierto_at, clic_at',
        (filas) => {
          for (const r of filas) {
            const s = statsMap.get(r.broadcast_id) ?? { enviados: 0, abiertos: 0, clics: 0 };
            if (esEnviado(r.estado)) { s.enviados += 1; if (r.abierto_at) s.abiertos += 1; if (r.clic_at) s.clics += 1; }
            statsMap.set(r.broadcast_id, s);
          }
        },
        { orden: 'id', filtros: (q) => q.in('broadcast_id', ids) as ConsultaPaginada },
      );
    } catch (e) {
      throw new Error(`getBroadcasts envios: ${e instanceof Error ? e.message : String(e)}`);
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

// Tope de seguridad por broadcast. EXPORTADO porque la API de MaKo
// (lib/api-mako/areas/email.run.ts) se niega a enviar/programar por encima: pasado
// este número el resto se trunca (`truncado`), el broadcast queda «enviado» y no hay
// forma de mandárselo a los demás. Una cosa, un lugar: el guard lee ESTE número.
export const MAX_DESTINATARIOS = 2000;
const GUARD_HORAS = 20;         // no contactar al mismo lead 2 veces en <20h

export type ResultadoBroadcast = { ok: boolean; enviados: number; simulados: number; fallos: number; saltados: number; total: number; truncado?: boolean; error?: string };

// lead_ids que ya recibieron un email (nutrición o broadcast) en las últimas N
// horas → para no contactarlos de nuevo con un broadcast (guard anti-spam).
//
// Paginado, y LANZA si no puede leer. Las dos cosas son la misma guarda:
//  · Sin paginar, un broadcast grande de hace unas horas (1.044 filas en ws1)
//    dejaba la ventana de 20h en 1.000 filas → 44 personas que YA recibieron un
//    email hoy «no habían sido contactadas» y se les mandaba otro.
//  · Antes el error se ignoraba (`nutri.data ?? []`), así que una lectura caída
//    devolvía un Set vacío = guard apagado en silencio. «No pude leer» no es
//    «nadie recibió nada»: el que llama decide no enviar.
async function leadsContactadosRecientemente(): Promise<Set<number>> {
  const supabase = (await getTenantDb());
  const desde = new Date(Date.now() - GUARD_HORAS * 3600 * 1000).toISOString();
  const set = new Set<number>();
  const juntar = (filas: Array<{ lead_id: number | null }>) => { for (const r of filas) if (r.lead_id != null) set.add(r.lead_id); };
  await Promise.all([
    leerPorPaginas<{ lead_id: number | null }>(supabase, 'nutricion_envios', 'id, lead_id', juntar, {
      orden: 'id', eq: { canal: 'email' },
      filtros: (q) => q.in('estado', ESTADOS_ENVIADO).gte('created_at', desde) as ConsultaPaginada,
    }),
    leerPorPaginas<{ lead_id: number | null }>(supabase, 'email_broadcast_envios', 'id, lead_id', juntar, {
      orden: 'id',
      filtros: (q) => q.in('estado', ESTADOS_ENVIADO).gte('created_at', desde) as ConsultaPaginada,
    }),
  ]);
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
  //
  // ⚠️ Esta lectura es la que evita mandarle DOS VECES el mismo email a alguien,
  // así que va paginada y, si falla, NO se envía. Con el `.select()` suelto de
  // antes, un broadcast de más de 1.000 destinatarios que se reanudaba veía solo
  // 1.000 ya-registrados y les volvía a mandar a los demás; y un error de lectura
  // se tragaba (`yaRows ?? []`) y reanudar era reenviarle a TODO el segmento.
  // Mismo criterio para el guard de 20h: sin poder leerlo, no se manda.
  const yaRegistrados = new Set<number>();
  let recientes: Set<number>;
  try {
    await leerPorPaginas<{ lead_id: number | null }>(
      supabase, 'email_broadcast_envios', 'id, lead_id',
      (filas) => { for (const r of filas) if (r.lead_id != null) yaRegistrados.add(r.lead_id); },
      { orden: 'id', eq: { broadcast_id: id } },
    );
    recientes = await leadsContactadosRecientemente();
  } catch (e) {
    return vacio(`no se pudo leer a quién ya se le envió (no se mandó nada para no repetir): ${e instanceof Error ? e.message : String(e)}`);
  }
  const destinatarios = candidatos.filter((l) => !yaRegistrados.has(l.id));
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
