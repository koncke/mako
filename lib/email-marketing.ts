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
import { noSonDelNegocio } from '@/lib/nombres-negocio';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox } from '@/lib/resend';
import { responderADelNegocio } from '@/lib/email-dominio';
import { firmaDelPie, SIN_EMAIL_PROPIO, POR_QUE_SIN_EMAIL } from '@/lib/email-remitente';
import { getWorkspace, getWorkspaceActual } from '@/lib/workspace';
import { envioEmailHabilitado } from '@/lib/envio-flags';
import { enTandas } from '@/lib/ids-con-filas';
import { COLS_RESIDUO, RESIDUO_DIAS, SEGMENTO_RESIDUO, esResiduoFormulario, type LeadResiduo } from '@/lib/nutricion-residuo';
import { etiquetaDeSegmento, PREFIJO_SEGMENTO_ETIQUETA, TRIGGER_ETIQUETA } from '@/lib/etiquetas-reglas';
import { SOLO_DESDE_EL_CRON, MOTIVO_SOLO_DESDE_EL_CRON } from '@/lib/disparadores';
import { repartirVencidas, segmentoNewsletter, segmentoDeNewsletter, ETAPAS_NEWSLETTER, ETAPAS_NEWSLETTER_KEYS, ETAPA_BAJA } from '@/lib/newsletter-reglas';
import { segmentoCrm, segmentoDeCrm } from '@/lib/segmento-crm';

const ahoraISO = () => new Date().toISOString();

/**
 * EL `reply_to` DE LO QUE MANDA EL NEGOCIO (4/11/2026, la campaña de Mauricio: «que te envíe a tu email personal»): la
 * dirección que fijó con `fijar_remitente_email` o en /email (lib/email-dominio.ts). Sin una, nada: las respuestas van al
 * remitente, como antes. Se esparce en los parámetros de `sendEmail`.
 */
async function replyToDelNegocio(): Promise<{ replyTo?: string }> {
  const r = await responderADelNegocio();
  return r ? { replyTo: r } : {};
}
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
  /** La etiqueta del disparador «se le puso una etiqueta» (mig 0223). null = otro disparador, o no se pudo leer. */
  etiqueta_id: number | null;
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

  // La etiqueta del disparador, aparte y TOLERANTE: la columna es de la mig 0223, y una lectura que
  // la nombre en el select de arriba tiraría la tab entera si la migración no estuviera. Sin ella
  // la pantalla sólo no puede mostrar cuál es (y guardar por etiqueta lo rechaza el que guarda).
  const etiquetaDe = new Map<number, number | null>();
  if (ids.length) {
    const { data: ets, error: eEt } = await supabase.from('nutricion_secuencias').select('id, etiqueta_id').in('id', ids);
    if (eEt) console.error(`[email] no pude leer la etiqueta de los disparadores: ${eEt.message}`);
    for (const r of (ets ?? []) as Array<{ id: number; etiqueta_id: number | null }>) etiquetaDe.set(Number(r.id), r.etiqueta_id == null ? null : Number(r.etiqueta_id));
  }

  return secuencias.map((s) => ({
    id: s.id, clave: s.clave, nombre: s.nombre, etapa: s.etapa, trigger_tipo: s.trigger_tipo,
    etiqueta_id: etiquetaDe.get(s.id) ?? null,
    activa: s.activa, pasos: s.pasosArr, inscriptos: inscMap.get(s.id) ?? 0,
    statsPorPaso: s.pasosArr.map((_, i) => statsMap.get(s.id)?.get(i + 1) ?? { sent: 0, abiertos: 0, clics: 0 }),
  }));
}

/** El disparador no se puede guardar así: un error para mostrar tal cual (la ruta lo contesta 400). */
export class DisparadorEmailError extends Error {
  constructor(m: string) { super(m); this.name = 'DisparadorEmailError'; }
}

/**
 * ⚠️ «SE LE PUSO UNA ETIQUETA» SIN ELEGIR CUÁL ERA UNA SECUENCIA MUDA (revisión del 08/10/2026,
 * etiquetas-2). /email ofrecía el disparador en el desplegable y guardaba sólo `trigger_tipo`:
 * `etiqueta_id` quedaba NULL, el evento no la inscribía (exige la etiqueta) y la cohorte devolvía
 * vacío — activa y sin mandar nunca nada, sin un error. Ahora se exige la etiqueta y el que la
 * escribe es la puerta de los disparadores (`setTriggerSecuencia`, lib/setting-secuencias.ts),
 * que la valida contra ESTE negocio y rechaza una archivada. Import dinámico: aquel módulo
 * importa éste (por `TRIGGERS`).
 */
async function fijarDisparadorEtiqueta(id: number, etiquetaId: unknown): Promise<void> {
  const n = typeof etiquetaId === 'string' && etiquetaId.trim() ? Number(etiquetaId) : etiquetaId;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) throw new DisparadorEmailError('Elige la etiqueta que lo dispara.');
  const { setTriggerSecuencia, TriggerInvalidoError } = await import('@/lib/setting-secuencias');
  try {
    await setTriggerSecuencia(id, { trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: n });
  } catch (e) {
    if (e instanceof TriggerInvalidoError) throw new DisparadorEmailError(e.message);
    throw e;
  }
}

/**
 * EL CRM DE UNA SECUENCIA (4/11/2026, la campaña de Mauricio: «un CRM nuevo "Email Marketing" con esos leads»). Sin el
 * embudo, el CRON por etapa mira sólo la CASA de cada lead (`leadsDeCohorte`, lib/nutricion.ts) y los AGREGADOS a ese CRM
 * no entran nunca, sin un error: la secuencia queda activa y no le escribe a nadie. Se guarda por la puerta de los CRON
 * (`publicarCrons` → `guardarDisparadores`, AGENTS.md: «Todo CRON se guarda por guardarDisparadores»), que valida que la etapa sea de ese
 * CRM. Cambia el PRIMER CRON y deja los demás como están. Imports dinámicos: esos módulos importan éste.
 */
async function fijarCrmDelDisparador(id: number, cambio: { trigger_tipo?: string; etapa?: string; funnel_id: number | null; etiqueta_id?: number | null }): Promise<void> {
  // Por `publicarCrons` y no `guardarDisparadores` a secas: lo pide una persona (la API), y cambiar a quién le escribe una
  // ACTIVA es activarla de nuevo para esa gente: pregunta por la duplicada (tests/automations-activar-todos-los-caminos).
  const { publicarCrons } = await import('@/lib/disparadores-guardar');
  const { disparadoresDe } = await import('@/lib/disparadores');
  const { TriggerInvalidoError } = await import('@/lib/setting-secuencias');
  const { DuplicadaError } = await import('@/lib/nutricion');
  const supabase = await getTenantDb();
  const cols = 'id, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at';
  let fila = await supabase.from('nutricion_secuencias').select(`${cols}, disparadores`).eq('id', id).maybeSingle();
  if (fila.error) fila = await supabase.from('nutricion_secuencias').select(cols).eq('id', id).maybeSingle();
  if (fila.error) throw new Error(`fijarCrmDelDisparador: ${fila.error.message}`);
  if (!fila.data) throw new DisparadorEmailError('Esa secuencia no existe en este negocio.');
  const lista = disparadoresDe(fila.data as Parameters<typeof disparadoresDe>[0]);
  const primero = lista[0] ?? { id: 'd1', trigger_tipo: 'manual' };
  const nuevo = {
    ...primero,
    trigger_tipo: cambio.trigger_tipo || primero.trigger_tipo,
    ...(cambio.etapa ? { etapa: cambio.etapa, etapas: null } : {}),
    funnel_id: cambio.funnel_id,
    ...(cambio.etiqueta_id !== undefined ? { etiqueta_id: cambio.etiqueta_id } : {}),
  };
  try {
    await publicarCrons(id, [nuevo, ...lista.slice(1)]);
  } catch (e) {
    if (e instanceof TriggerInvalidoError || e instanceof DuplicadaError) throw new DisparadorEmailError(e.message);
    throw e;
  }
}

// Crea una secuencia de email nueva (pausada) con un paso vacío. `funnelId` (4/11/2026): el CRM cuyos leads inscribe,
// también los AGREGADOS a él (`fijarCrmDelDisparador`).
export async function crearEmailSecuencia(nombre: string, etapa: string, trigger: string, etiquetaId?: unknown, funnelId?: number | null): Promise<number> {
  // Un evento de un canal o el Recurrente al grupo se eligen en el CRON: por acá quedarían mudos.
  if (SOLO_DESDE_EL_CRON.has(trigger)) throw new DisparadorEmailError(MOTIVO_SOLO_DESDE_EL_CRON);
  const conCrm = typeof funnelId === 'number' && Number.isInteger(funnelId) && funnelId > 0;
  const porEtiqueta = trigger === TRIGGER_ETIQUETA;
  // Lo que se puede saber sin escribir, antes de escribir: una secuencia creada a medias quedaría
  // en la lista sin disparador.
  if (porEtiqueta && !(typeof etiquetaId === 'number' || (typeof etiquetaId === 'string' && etiquetaId.trim()))) {
    throw new DisparadorEmailError('Elige la etiqueta que lo dispara.');
  }
  const supabase = (await getTenantDb());
  const clave = `email-${Date.now().toString(36)}`;
  const pasoInicial: PasoSecuencia = { orden: 1, canal: 'email', delay_horas: 0, asunto: '', preheader: '', cuerpo: '', template_wa: null };
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    // Por etiqueta (o con CRM) nace «manual» y el disparador lo fija su puerta (abajo): así hay UN lugar que
    // valida la etiqueta y la etapa del CRM. Si la rechaza, la fila se borra y el error llega tal cual.
    .insert({ clave, nombre: nombre || 'Nueva secuencia de email', etapa: etapa || 'nutri', trigger_tipo: porEtiqueta || conCrm ? 'manual' : (trigger || 'manual'), activa: false, pasos: [pasoInicial] })
    .select('id')
    .single();
  if (error) throw new Error(`crearEmailSecuencia: ${error.message}`);
  const id = (data as { id: number }).id;
  if (porEtiqueta || conCrm) {
    try {
      if (conCrm) {
        const n = typeof etiquetaId === 'string' && etiquetaId.trim() ? Number(etiquetaId) : etiquetaId;
        await fijarCrmDelDisparador(id, { trigger_tipo: trigger || 'manual', ...(etapa ? { etapa } : {}), funnel_id: funnelId as number, ...(porEtiqueta ? { etiqueta_id: typeof n === 'number' ? n : null } : {}) });
      } else await fijarDisparadorEtiqueta(id, etiquetaId);
    } catch (e) {
      const { error: eDel } = await supabase.from('nutricion_secuencias').delete().eq('id', id);
      if (eDel) console.error(`[email] la secuencia ${id} quedó sin disparador y no se pudo borrar: ${eDel.message}`);
      throw e;
    }
  }
  return id;
}

// Actualiza metadata de una secuencia (nombre / etapa / trigger). Solo toca los
// campos provistos. El disparador por etiqueta exige `etiqueta_id` (ver `fijarDisparadorEtiqueta`).
// `funnel_id` (4/11/2026): el CRM cuyos leads inscribe (null = todos los CRM, sólo la casa de cada lead). Presente, el
// CRON se guarda ENTERO por su puerta (`fijarCrmDelDisparador`) con lo que se mandó de etapa y trigger.
export async function actualizarMetaEmailSecuencia(id: number, patch: { nombre?: string; etapa?: string; trigger_tipo?: string; etiqueta_id?: unknown; funnel_id?: number | null }): Promise<void> {
  if (typeof patch.trigger_tipo === 'string' && SOLO_DESDE_EL_CRON.has(patch.trigger_tipo)) throw new DisparadorEmailError(MOTIVO_SOLO_DESDE_EL_CRON);
  const supabase = (await getTenantDb());
  if (patch.funnel_id !== undefined) {
    const n = typeof patch.etiqueta_id === 'string' && patch.etiqueta_id.trim() ? Number(patch.etiqueta_id) : patch.etiqueta_id;
    await fijarCrmDelDisparador(id, {
      ...(patch.trigger_tipo ? { trigger_tipo: patch.trigger_tipo } : {}), ...(patch.etapa ? { etapa: patch.etapa } : {}), funnel_id: patch.funnel_id,
      ...(typeof n === 'number' ? { etiqueta_id: n } : {}),
    });
    if (typeof patch.nombre === 'string') {
      const { error } = await supabase.from('nutricion_secuencias').update({ nombre: patch.nombre, updated_at: ahoraISO() }).eq('id', id);
      if (error) throw new Error(`actualizarMetaEmailSecuencia: ${error.message}`);
    }
    return;
  }
  const upd: Record<string, unknown> = { updated_at: ahoraISO() };
  if (typeof patch.nombre === 'string') upd.nombre = patch.nombre;
  if (typeof patch.etapa === 'string' && patch.etapa) upd.etapa = patch.etapa;
  const porEtiqueta = patch.trigger_tipo === TRIGGER_ETIQUETA;
  if (typeof patch.trigger_tipo === 'string' && patch.trigger_tipo && !porEtiqueta) {
    upd.trigger_tipo = patch.trigger_tipo;
    // El disparador dejó de ser por etiqueta: la que tenía no puede seguir contando como «la
    // usa una automatización» al archivarla (usoDeEtiqueta cuenta por esta columna).
    upd.etiqueta_id = null;
  }
  // La etiqueta PRIMERO: si se rechaza, no se escribió nada del resto del pedido.
  if (porEtiqueta) await fijarDisparadorEtiqueta(id, patch.etiqueta_id);
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
  // El recordatorio de la reunión (lib/recordatorio-automatizacion.ts): lo manda su emisor, no el motor.
  { value: 'reunion_recordatorio', label: 'Agendó una reunión' },
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
  // Las ETIQUETAS del CRM (mig 0224, punto 12 del rediseño de /automations). El cohorte lo resuelve el
  // motor (parte M: `nutricion_secuencias.etiqueta_id` + `enrolarPorEvento(…, 'etiqueta')`); este
  // renglón es sólo el nombre en el selector. Literal y no la constante TRIGGER_ETIQUETA: el guard
  // de los tres registros (tests/nutricion-triggers-registros.test.ts) lee el fuente.
  { value: 'etiqueta_puesta', label: 'Se le puso una etiqueta' },
  // Los SEIS del CRON de la sexta tanda (lib/disparadores.ts, `TRIGGERS_NUEVOS`). Acá van por su
  // NOMBRE: sin el renglón, `labelDe(TRIGGERS, …)` (la API de email) devolvía el slug crudo y
  // `setTriggerSecuencia` los rechazaba. ⚠️ Cuatro necesitan un dato que este selector no tiene (el
  // evento del canal, o el horario): se eligen en el CRON y las puertas de /email los rechazan
  // (`SOLO_DESDE_EL_CRON`). Literales, como el de arriba: el guard de los tres registros lee el fuente.
  { value: 'etiqueta_agregada', label: 'Se agrega etiqueta a un lead' },
  { value: 'etiqueta_quitada', label: 'Se elimina etiqueta a un lead' },
  { value: 'instagram', label: 'Un evento de Instagram' },
  { value: 'messenger', label: 'Un evento de Messenger' },
  { value: 'email_recibido', label: 'Recibes un email' },
  // Los pagos de la pasarela (11/10/2026, `TRIGGER_PAGO`): necesitan el evento (`subtipo`), así que se eligen en
  // el CRON y /email los rechaza (`SOLO_DESDE_EL_CRON`).
  { value: 'pago', label: 'Un evento de pago' },
  // «Envió el formulario» (14/11/2026, `TRIGGER_FORMULARIO`): necesita CUÁL formulario (`pieza`), así que se elige en el CRON
  // y /email lo rechaza (`SOLO_DESDE_EL_CRON`).
  { value: 'formulario_enviado', label: 'Envió un formulario' },
  { value: 'grupo_mako', label: 'Recurrente al grupo de MaKo' },
  // «MaKo en WhatsApp» como automatización (11/10/2026, `TRIGGER_AVISO_MAKO`): lo emite el código de cada
  // aviso (lib/aviso-evento.ts), no el motor. Nace de la galería con su evento: /email lo rechaza.
  { value: 'aviso_mako', label: 'Evento de MaKo' },
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
/**
 * ¿Es un segmento que se sabe resolver? Los fijos de arriba, `etiqueta:<id>` (mig 0224) y el CRM del newsletter
 * (`newsletter:<funnelId>[:<etapa>]`, lib/newsletter-reglas.ts). La FORMA: que la etiqueta o el CRM existan en este
 * negocio lo mira `validarSegmento`, que lee la base.
 */
export const esSegmentoValido = (s: string): boolean => SEGMENTO_VALIDO.has(s) || etiquetaDeSegmento(s) != null || segmentoNewsletter(s) != null || segmentoCrm(s) != null;

/**
 * El segmento, validado CONTRA LA BASE, o un error que lo dice.
 *
 * ⚠️ HASTA EL 08/10/2026 UN SEGMENTO QUE NO SE CONOCÍA SE GUARDABA COMO «activos»: `crearBroadcast`
 * hacía `esSegmentoValido(x) ? x : 'activos'`, `actualizarBroadcast` lo ignoraba en silencio y
 * `filtroSegmento` caía a «activos» en su `default`. Con las etiquetas eso pasa de molesto a grave:
 * un envío a «etiqueta Cualificado» con el validador viejo le escribía a TODOS los activos (1.044 en
 * ws1), sin un error. Ahora un segmento que no existe NO SE GUARDA ni se manda: tira.
 */
export async function validarSegmento(segmento: unknown): Promise<string> {
  const s = typeof segmento === 'string' ? segmento.trim() : '';
  if (!esSegmentoValido(s)) throw new Error(`El segmento «${s}» no existe.`);
  const etiquetaId = etiquetaDeSegmento(s);
  if (etiquetaId != null) {
    const { data, error } = await (await getTenantDb()).from('crm_etiquetas').select('id, archivada_at').eq('id', etiquetaId).limit(1);
    if (error) throw new Error(`No pude leer la etiqueta del segmento: ${error.message}`);
    const e = ((data ?? []) as Array<{ id: number; archivada_at: string | null }>)[0];
    if (!e) throw new Error('Esa etiqueta no existe en este negocio.');
    if (e.archivada_at) throw new Error('Esa etiqueta está archivada.');
  }
  const nl = segmentoNewsletter(s);
  if (nl) {
    const { existeCrm } = await import('@/lib/newsletter');
    if (!(await existeCrm(nl.funnelId))) throw new Error('Ese CRM del newsletter no existe en este negocio (o está archivado).');
  }
  const crm = segmentoCrm(s);
  if (crm) {
    const { productosConEtapas } = await import('@/lib/setting-secuencias');
    const p = (await productosConEtapas()).find((x) => x.funnelId === crm.funnelId);
    if (!p) throw new Error('Ese CRM no existe en este negocio (o está archivado).');
    if (crm.etapa && !p.etapas.some((e) => e.value === crm.etapa)) throw new Error(`«${crm.etapa}» no es una etapa de ${p.nombre}.`);
  }
  return s;
}

/**
 * Los segmentos que se ofrecen en la pantalla de broadcasts: los fijos y uno por etiqueta viva del
 * negocio. Si las etiquetas no se pueden leer, quedan los fijos (y el error en el log): la pantalla
 * de broadcasts no se cae por una tabla de otra feature.
 */
export async function segmentosDisponibles(): Promise<Segmento[]> {
  try {
    const { data, error } = await (await getTenantDb()).from('crm_etiquetas').select('id, nombre').is('archivada_at', null)
      .order('orden', { ascending: true }).order('id', { ascending: true });
    if (error) throw new Error(error.message);
    const deEtiquetas = ((data ?? []) as Array<{ id: number; nombre: string }>).map((e) => ({
      value: `${PREFIJO_SEGMENTO_ETIQUETA}${Number(e.id)}`, label: `Etiqueta «${e.nombre}»`, descripcion: 'Leads con esa etiqueta',
    }));
    return [...SEGMENTOS, ...deEtiquetas, ...await segmentosDelNewsletter(), ...await segmentosDeLosCrm()];
  } catch (e) {
    console.error(`[email] segmentos de etiquetas: ${e instanceof Error ? e.message : String(e)}`);
    return [...SEGMENTOS, ...await segmentosDelNewsletter(), ...await segmentosDeLosCrm()];
  }
}

/**
 * CUALQUIER CRM Y CUALQUIER ETAPA (14/11/2026, la llamada con Julio Mazariegos, docs/relevo/llamada-julio-13-11.md): «todos
 * los de «Regalo»» y «los de «Regalo» en «Lead entrante»». Hasta acá /email sólo ofrecía los fijos, las etiquetas y el CRM del
 * newsletter. El del newsletter no se repite (ya tiene los suyos, sin la baja). Nunca tira: sin poder leerlos, no se ofrecen.
 */
async function segmentosDeLosCrm(): Promise<Segmento[]> {
  try {
    const [{ productosConEtapas }, { crmDelNewsletter }] = await Promise.all([import('@/lib/setting-secuencias'), import('@/lib/newsletter')]);
    const [productos, nl] = await Promise.all([productosConEtapas(), crmDelNewsletter().catch(() => null)]);
    return productos
      .filter((p): p is typeof p & { funnelId: number } => p.funnelId != null && p.funnelId !== nl?.id)
      .flatMap((p) => [
        { value: segmentoDeCrm(p.funnelId), label: `${p.nombre}: todos`, descripcion: 'Todos los del CRM, en cualquier etapa' },
        ...p.etapas.map((e) => ({ value: segmentoDeCrm(p.funnelId, e.value), label: `${p.nombre}: ${e.label}`, descripcion: `Los del CRM en «${e.label}»` })),
      ]);
  } catch (e) {
    console.error(`[email] segmentos de los CRM: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/**
 * Los destinatarios de un segmento de CRM (`crm:<funnelId>[:<etapa>]`): los de CASA y los AGREGADOS (`lead_funnel`), en la etapa
 * pedida, con el mismo piso que todos (email no vacío y sin baja). El CRM del negocio guarda su casa como NULL (medido el
 * 30/09/2026 en los 6 negocios): se lee por los dos lados.
 */
async function leadsDeCrm(supabase: Awaited<ReturnType<typeof getTenantDb>>, funnelId: number, etapa: string | null): Promise<LeadDestino[]> {
  const { listarFunnels } = await import('@/lib/funnels');
  const { pipelineStageOf } = await import('@/lib/pipeline');
  const f = (await listarFunnels()).find((x) => x.id === funnelId);
  if (!f) return [];
  const cols = 'id, nombre, email, empresa, email_opt_out, funnel_id, pipeline_stage, estado_lead, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada';
  type Fila = { id: number; nombre: string | null; email: string | null; empresa: string | null; email_opt_out: boolean | null } & Record<string, unknown>;
  const piso = (q: ConsultaPaginada) => (q as unknown as LeadFilter).not('email', 'is', null).neq('email', '').eq('email_opt_out', false) as unknown as ConsultaPaginada;
  const deCasa = await leerTodo<Fila>(supabase, 'leads', cols, {
    orden: 'id', filtros: (q) => piso(f.esDefault ? (q as unknown as { or: (s: string) => ConsultaPaginada }).or(`funnel_id.is.null,funnel_id.eq.${funnelId}`) : (q as unknown as LeadFilter).eq('funnel_id', funnelId) as unknown as ConsultaPaginada),
  });
  const filas = await leerTodo<{ id: number; lead_id: number; etapa: string | null }>(supabase, 'lead_funnel', 'id, lead_id, etapa', { orden: 'id', eq: { funnel_id: funnelId } });
  const yaEnCasa = new Set(deCasa.map((l) => Number(l.id)));
  const out: LeadDestino[] = [];
  for (const l of deCasa) {
    if (etapa && pipelineStageOf(l as never) !== etapa) continue;
    if (l.email) out.push({ id: Number(l.id), nombre: l.nombre, email: l.email, empresa: l.empresa });
  }
  const etapaDe = new Map(filas.map((x) => [Number(x.lead_id), x.etapa ?? '']));
  const ids = [...etapaDe.keys()].filter((id) => !yaEnCasa.has(id) && (!etapa || etapaDe.get(id) === etapa));
  for (const tanda of enTandas(ids, 200)) {
    const leads = await leerTodo<Fila>(supabase, 'leads', 'id, nombre, email, empresa, email_opt_out', { orden: 'id', filtros: (q) => piso((q as unknown as LeadFilter).in('id', tanda) as unknown as ConsultaPaginada) });
    for (const l of leads) if (l.email) out.push({ id: Number(l.id), nombre: l.nombre, email: l.email, empresa: l.empresa });
  }
  return out.sort((a, b) => a.id - b.id);
}

/**
 * Los segmentos del CRM del newsletter, si el negocio tiene uno: todo el CRM y cada etapa a la que se le escribe (la baja
 * no). Así una edición se ve con su nombre en /email, y desde ahí también se le puede escribir a la lista. Nunca tira:
 * sin poder leerlo, no se ofrece.
 */
async function segmentosDelNewsletter(): Promise<Segmento[]> {
  try {
    const { crmDelNewsletter } = await import('@/lib/newsletter');
    const crm = await crmDelNewsletter();
    if (!crm) return [];
    return [
      { value: segmentoDeNewsletter(crm.id), label: `${crm.nombre}: todos`, descripcion: 'Los suscriptos del newsletter, menos las bajas' },
      ...ETAPAS_NEWSLETTER_KEYS.filter((k) => k !== ETAPA_BAJA).map((k) => {
        const label = ETAPAS_NEWSLETTER.find((e) => e.key === k)?.label ?? k;
        return { value: segmentoDeNewsletter(crm.id, k), label: `${crm.nombre}: ${label}`, descripcion: `Los suscriptos en «${label}»` };
      }),
    ];
  } catch (e) {
    console.error(`[email] segmentos del newsletter: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

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
    case 'activos': out = out.in('estado_lead', ['abierto', 'ganado']) as T; break;
    // ⚠️ SIN DEFAULT A «activos» (08/10/2026): un segmento que no se conoce le escribía a todos los
    // activos. Las etiquetas se resuelven antes, en `leadsDeSegmento` (no son un filtro de `leads`).
    default: throw new Error(`El segmento «${segmento}» no existe.`);
  }
  return out;
}

// Resuelve los leads de un segmento (siempre con email y sin opt-out).
export async function leadsDeSegmento(segmento: string): Promise<LeadDestino[]> {
  const supabase = (await getTenantDb());
  if (segmento === SEGMENTO_RESIDUO) return leadsDelResiduo(supabase);
  const etiquetaId = etiquetaDeSegmento(segmento);
  if (etiquetaId != null) return leadsDeEtiqueta(supabase, etiquetaId);
  // El CRM del newsletter: su casa Y sus agregados, en la etapa pedida y sin las bajas (lib/newsletter.ts).
  const nl = segmentoNewsletter(segmento);
  if (nl) return (await import('@/lib/newsletter')).destinatariosDeNewsletter(nl);
  // Cualquier CRM y etapa (14/11/2026): su casa y sus agregados.
  const crm = segmentoCrm(segmento);
  if (crm) return leadsDeCrm(supabase, crm.funnelId, crm.etapa);
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

/**
 * Los destinatarios de un segmento de ETIQUETA (`etiqueta:<id>`): los leads que la tienen, con el
 * mismo piso que todos los segmentos (email no vacío y sin baja). Sin filtro de estado: la etiqueta
 * es la decisión de a quién, y la puso una persona o una automatización a propósito.
 * Paginado por las dos puntas: la tabla de etiquetas crece con el uso.
 */
async function leadsDeEtiqueta(supabase: Awaited<ReturnType<typeof getTenantDb>>, etiquetaId: number): Promise<LeadDestino[]> {
  try {
    const filas = await leerTodo<{ id: number; lead_id: number }>(supabase, 'crm_lead_etiquetas', 'id, lead_id', { orden: 'id', eq: { etiqueta_id: etiquetaId } });
    const ids = [...new Set(filas.map((f) => Number(f.lead_id)))];
    const out: LeadDestino[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const tanda = ids.slice(i, i + 200);
      const leads = await leerTodo<{ id: number; nombre: string | null; email: string | null; empresa: string | null }>(
        supabase, 'leads', 'id, nombre, email, empresa',
        { orden: 'id', filtros: (q) => (q as unknown as LeadFilter).in('id', tanda).not('email', 'is', null).neq('email', '').eq('email_opt_out', false) as unknown as ConsultaPaginada },
      );
      for (const l of leads) if (l.email) out.push({ id: l.id, nombre: l.nombre, email: l.email, empresa: l.empresa });
    }
    return out.sort((a, b) => a.id - b.id);
  } catch (e) {
    throw new Error(`leadsDeSegmento(etiqueta ${etiquetaId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function contarSegmento(segmento: string): Promise<number> {
  // ⚠️ EL RESIDUO SE CUENTA CON LA MISMA FUNCIÓN QUE ARMA LOS DESTINATARIOS. Un
  // `count` del prefiltro contaría también a quien tiene un pago en `pagos`: la
  // pantalla prometería N y el broadcast le llegaría a menos, sin decir por qué.
  if (segmento === SEGMENTO_RESIDUO) return (await leadsDeSegmento(segmento)).length;
  // Lo mismo una etiqueta y el newsletter: el conteo es el largo de los destinatarios.
  if (etiquetaDeSegmento(segmento) != null || segmentoNewsletter(segmento) != null || segmentoCrm(segmento) != null) return (await leadsDeSegmento(segmento)).length;
  const supabase = (await getTenantDb());
  const q = supabase.from('leads').select('id', { count: 'exact', head: true });
  const { count, error } = await filtroSegmento(q as unknown as LeadFilter, segmento) as unknown as { count: number | null; error: { message: string } | null };
  if (error) throw new Error(`contarSegmento: ${error.message}`);
  return count ?? 0;
}

export async function contarTodosSegmentos(segmentos?: readonly Segmento[]): Promise<Record<string, number>> {
  const lista = segmentos ?? SEGMENTOS;
  const entries = await Promise.all(lista.map(async (s) => [s.value, await contarSegmento(s.value)] as const));
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
  // Sin segmento, el borrador nace en «activos» (se elige después en el editor). Con uno que no
  // existe, NO nace: ver `validarSegmento`.
  const segmento = input.segmento ? await validarSegmento(input.segmento) : 'activos';
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('email_broadcasts')
    .insert({
      asunto: input.asunto ?? 'Nuevo broadcast',
      preheader: input.preheader ?? null,
      cuerpo: input.cuerpo ?? '',
      segmento,
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
  if (patch.segmento !== undefined) upd.segmento = await validarSegmento(patch.segmento);
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

/**
 * LA FIRMA DEL PIE de un broadcast: el nombre del NEGOCIO del workspace en curso (`firmaDelPie`,
 * lib/email-remitente.ts), la MISMA regla que la nutrición de /automations (lib/nutricion.ts).
 *
 * ⚠️ ERA `displayNameDe(getEmailFrom())`, el nombre visible del remitente, y es el mismo bug que
 *    Martín vio en el email de un flujo (cuarta tanda del Chatbot, 09/10/2026, punto 16: «Abajo del
 *    todo pusiste "MaKo / Si no quieres recibir más estos correos, darme de baja." eso no tiene
 *    sentido»): el remitente del ws1 es «MaKo <equipo@hola-mako.com>», así que los broadcasts que el
 *    ws1 le manda a SUS leads salían firmados «MaKo»; y en un workspace sin dominio el sandbox
 *    firmaba con el nombre de otro cliente. El remitente sigue decidiendo el From; la firma no.
 *    Sin poder leer el negocio, sin firma: no se inventa una.
 */
async function firmaDelNegocioActual(): Promise<string> {
  try {
    const ws = await getWorkspaceActual();
    return ws ? firmaDelPie((await getWorkspace(ws))?.nombre) : '';
  } catch {
    return '';
  }
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
    html: renderEmailHtml({ subject: asunto, bodyText: aplicarVariables(b.cuerpo, vars), preheader: aplicarVariables(b.preheader ?? '', vars) || undefined, fromName: await firmaDelNegocioActual() }),
    text: aplicarVariables(b.cuerpo, vars),
    // Adónde van las respuestas (4/11/2026, lib/email-dominio.ts): la prueba se ve igual que lo que reciben los leads.
    ...(await replyToDelNegocio()),
    tags: [{ name: 'tipo', value: 'broadcast-prueba' }],
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * El HTML de un broadcast como lo va a ver un lead: el mismo render que la prueba y el envío, con un lead de ejemplo y un
 * link de baja que no da de baja a nadie. No manda nada (la vista previa de la tab Newsletters).
 */
export async function vistaPreviaBroadcast(id: number): Promise<{ ok: true; asunto: string; html: string } | { ok: false; error: string }> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('email_broadcasts').select('asunto, preheader, cuerpo').eq('id', id).single();
  if (error) return { ok: false, error: error.message };
  const b = data as { asunto: string; preheader: string | null; cuerpo: string };
  const vars = valoresVariablesLead({ nombre: 'Ana', empresa: 'Tu negocio' });
  const asunto = aplicarVariables(b.asunto, vars) || '(sin asunto)';
  const html = renderEmailHtml({
    subject: asunto, bodyText: aplicarVariables(b.cuerpo, vars), preheader: aplicarVariables(b.preheader ?? '', vars) || undefined,
    unsubscribeUrl: '#', fromName: await firmaDelNegocioActual(),
  });
  return { ok: true, asunto, html };
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
  // activo pero el negocio no tiene remitente propio, no mandamos. No marcamos enviado.
  // ⚠️ Desde la undécima tanda «sandbox» = «sin remitente propio»: `getEmailFrom` (lib/resend.ts) devuelve el
  // sandbox también con el email de MaKo en un cliente (el ws1). Sin este corte, `sendEmail` se negaría con
  // cada destinatario y quedaría anotado como un fallo, o sea como ya intentado, que es lo que el reanudable
  // saltea: conectar después el dominio propio no les mandaba el broadcast.
  const emailOn = await envioEmailHabilitado();
  if (emailOn && (await remitenteEsSandbox())) {
    return vacio(`${SIN_EMAIL_PROPIO}. ${POR_QUE_SIN_EMAIL}`);
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
  const fromNameWs = await firmaDelNegocioActual();
  // Adónde van las respuestas de los leads (4/11/2026): UNA lectura por broadcast, no por lead.
  const replyTo = await replyToDelNegocio();

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

  const noSon = await noSonDelNegocio();
  for (const lead of destinatarios) {
    if (Date.now() - tInicio > TIEMPO_MAX_MS) { completo = false; break; }
    if (recientes.has(lead.id)) {
      res.saltados += 1;
      filas.push({ broadcast_id: id, lead_id: lead.id, destino: lead.email, estado: 'saltado', error: 'contacto reciente (<20h)' });
      if (filas.length >= CHUNK) await flush();
      continue;
    }
    const vars = valoresVariablesLead(lead, { noSon });
    const asunto = aplicarVariables(b.asunto, vars) || '(sin asunto)';
    const cuerpo = aplicarVariables(b.cuerpo, vars);
    // Con el broadcast: la baja queda atribuida a ESTE envío (`baja_at`, las métricas de cada edición del newsletter).
    const unsubUrl = buildUnsubscribeUrl(lead.id, id);

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
        ...replyTo,
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
    supabase.from('email_broadcasts').select('id, segmento, programado_at').eq('estado', 'programado').lte('programado_at', ahoraISO()),
    supabase.from('email_broadcasts').select('id').eq('estado', 'enviando').lt('updated_at', hace10min),
  ]);
  if (prog.error) throw new Error(`procesarBroadcastsProgramados: ${prog.error.message}`);
  // Las ediciones del newsletter tienen su propia regla (`repartirVencidas`, lib/newsletter-reglas.ts): las demás, como siempre.
  const vencidas = (prog.data ?? []) as Array<{ id: number; segmento: string; programado_at: string | null }>;
  let crms: ReadonlySet<number> | null = new Set<number>();
  if (vencidas.some((r) => segmentoNewsletter(r.segmento))) {
    crms = await (await import('@/lib/funnels')).listarFunnels().then((fs) => new Set(fs.map((f) => f.id)))
      .catch((e: unknown) => { console.error(`[email] no pude leer los CRM del newsletter: ${e instanceof Error ? e.message : String(e)}`); return null; });
  }
  const { salen, aBorrador, cancelar } = repartirVencidas(vencidas, crms, Date.now());
  // Condicional en el estado: si alguien la desprogramó o la tomó recién, no se la pisa.
  if (aBorrador.length) await supabase.from('email_broadcasts').update({ estado: 'borrador', programado_at: null, updated_at: ahoraISO() }).in('id', aBorrador).eq('estado', 'programado');
  if (cancelar.length) await supabase.from('email_broadcasts').update({ estado: 'cancelado', updated_at: ahoraISO() }).in('id', cancelar).eq('estado', 'programado');
  const ids = [...new Set([
    ...salen,
    ...((stuck.data ?? []) as Array<{ id: number }>).map((r) => r.id),
  ])];
  const detalle: ResultadoBroadcast[] = [];
  for (const id of ids) {
    // Una edición del newsletter escrita en el Copywriter sale con lo último que tiene su guion (lib/newsletter.ts). Si
    // el guion no se puede leer, sale con lo que la edición ya tenía: no se frena un envío programado por eso.
    await (await import('@/lib/newsletter')).traerEdicionDelCopy(id)
      .catch((e: unknown) => console.error(`[email] la edición ${id} con su guion del Copywriter: ${e instanceof Error ? e.message : String(e)}`));
    detalle.push(await enviarBroadcast(id));
  }
  return { procesados: ids.length, detalle };
}

// ── Webhook de Resend: marca abierto/clic/rebote por proveedor_id ─────────────
// DELIBERADAMENTE SIN SCOPE de workspace (getSupabaseServer, no getTenantDb):
// el webhook llega sin sesión (getTenantDb colapsaría al dueño y los eventos de
// los emails de un CLIENTE jamás matchearían). El proveedor_id es el id del
// email en Resend — único global — así que buscar cross-workspace es correcto
// y no filtra datos: solo estampa timestamps en la fila dueña de ese id.
//
// ⚠️ DEVUELVE LA FILA QUE MARCÓ (4/11/2026), o null si no marcó nada (ya estaba, o no es de nadie): con ella el webhook
// mueve la tarjeta del CRM de la automatización (`moverPorEventoEmail`, lib/email-eventos-crm.ts) en el workspace de la
// FILA. Sólo la primera vez que se marca: un segundo «abrió» del mismo email no mueve nada.
export type FilaEventoEmail = { tabla: 'nutricion_envios' | 'email_broadcast_envios'; id: number; workspace_id: number | null; lead_id: number | null; secuencia_id: number | null };
export async function marcarEventoEmail(
  proveedorId: string, tipo: 'abierto' | 'clic' | 'rebote' | 'queja', whenISO: string,
  /** Sólo las filas de ESTE negocio: el evento llegó por la cuenta de Resend de un negocio (4/11/2026, el webhook con `?cuenta=`). */
  soloWs?: number,
): Promise<FilaEventoEmail | null> {
  const supabase = getSupabaseServer();
  // El rebote y la queja (4/11/2026, mig 0380, el freno de lib/email-reputacion.ts). Sin la columna, el update da error y
  // vuelve null: el webhook sigue (da de baja al lead igual) y el freno no tiene qué contar.
  const col = ({ abierto: 'abierto_at', clic: 'clic_at', rebote: 'rebotado_at', queja: 'queja_at' } as const)[tipo];
  let fila: FilaEventoEmail | null = null;
  for (const tabla of ['nutricion_envios', 'email_broadcast_envios'] as const) {
    let q = supabase
      .from(tabla)
      .update({ [col]: whenISO })
      .eq('proveedor_id', proveedorId)
      .is(col, null);
    if (soloWs != null) q = q.eq('workspace_id', soloWs);
    const { data, error } = await q
      .select(tabla === 'nutricion_envios' ? 'id, workspace_id, lead_id, secuencia_id' : 'id, workspace_id, lead_id');
    const r = (!error ? ((data ?? []) as unknown as Array<Record<string, unknown>>) : [])[0];
    if (r && !fila) {
      const n = (v: unknown) => (v == null ? null : Number(v));
      fila = { tabla, id: Number(r.id), workspace_id: n(r.workspace_id), lead_id: n(r.lead_id), secuencia_id: n(r.secuencia_id) };
    }
  }
  return fila;
}

/**
 * LA TARJETA SIGUE AL EMAIL (4/11/2026): la columna que la automatización eligió para «abrió» o «hizo clic»
 * (lib/email-eventos-crm.ts). Sólo un envío de una automatización (un broadcast no tiene columnas). NUNCA TIRA: lo llama el
 * webhook, que contesta 200 igual. `rebote` (13/11/2026, ticket #93): a la columna «Rebotado» de su CRM.
 */
export async function moverPorEventoDeEmail(fila: FilaEventoEmail | null, tipo: 'abierto' | 'clic' | 'rebote'): Promise<void> {
  if (!fila || fila.tabla !== 'nutricion_envios' || fila.workspace_id == null || fila.lead_id == null || fila.secuencia_id == null) return;
  try {
    // Dinámico: lib/email-eventos-crm.ts trae el CRM entero (leads, lead-funnel) y este módulo lo importa medio repo.
    const { moverPorEventoEmail } = await import('@/lib/email-eventos-crm');
    const evento = tipo === 'abierto' ? 'abrio' : tipo;
    await moverPorEventoEmail({ ws: fila.workspace_id, leadId: fila.lead_id, secuenciaId: fila.secuencia_id, evento });
  } catch (e) {
    console.error(`[email] mover la tarjeta por «${tipo}» (envío ${fila.id}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Rebote/queja → además de loguear, da de baja al lead (supresión). Igual que
// marcarEventoEmail: sin scope, el proveedor_id identifica la fila exacta y el
// update de leads va por PK global.
// Con `soloWs` (el evento llegó por la cuenta de Resend de un negocio, 4/11/2026), sólo un envío y un lead de ESE negocio.
export async function suprimirPorRebote(proveedorId: string, soloWs?: number): Promise<void> {
  const supabase = getSupabaseServer();
  // Encontrar el lead por el proveedor_id en cualquiera de los dos logs.
  for (const tabla of ['nutricion_envios', 'email_broadcast_envios'] as const) {
    let q = supabase.from(tabla).select('lead_id').eq('proveedor_id', proveedorId);
    if (soloWs != null) q = q.eq('workspace_id', soloWs);
    const { data } = await q.limit(1);
    const leadId = ((data ?? []) as Array<{ lead_id: number | null }>)[0]?.lead_id;
    if (leadId) {
      let u = supabase.from('leads').update({ email_opt_out: true }).eq('id', leadId);
      if (soloWs != null) u = u.eq('workspace_id', soloWs);
      await u;
      return;
    }
  }
}
