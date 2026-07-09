// =============================================================================
// Motor de nutrición — VSL funnel (app = cerebro)
// =============================================================================
// La app decide a quién/qué/cuándo nutrir, leyendo el estado del lead + su
// comportamiento del VSL (Camino 1). Canales: email (Resend) y whatsapp
// (Chatwoot) — se enchufan en hitos siguientes.
//
// Hito 0: NO se envía por ningún canal. El cron corre en dry-run (preview, no
// escribe); con ?commit=1 persiste inscripciones y avanza la máquina de estados
// marcando los envíos como 'simulado'. El envío REAL quedará además detrás del
// flag NUTRICION_SEND_ENABLED.
// =============================================================================

import { getTenantDb } from '@/lib/workspace';
import { getVslEngagementMap } from '@/lib/leads';
import { sendWhatsappTemplate } from '@/lib/chatwoot';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { getInstanciaRow } from '@/lib/evolution';
import { esLeadCliente, enviarYEspejar, crearBorrador, tieneBorradorNutriPendiente } from '@/lib/evolution-envio';

export type CanalNutricion = 'email' | 'whatsapp';

export type ProveedorWa = 'oficial' | 'no_oficial';

export type PasoSecuencia = {
  orden: number;
  canal: CanalNutricion;
  delay_horas: number;
  asunto: string | null;
  preheader?: string | null;                  // email: texto de vista previa (preheader)
  cuerpo: string;
  proveedor?: ProveedorWa;                     // whatsapp: 'oficial' (plantilla/Chatwoot) | 'no_oficial' (Evolution)
  template_wa: string | null;                 // nombre del template aprobado (WhatsApp oficial)
  template_categoria?: 'marketing' | 'utility' | 'authentication';
  template_idioma?: string;                   // ej. 'es_MX'
  template_param?: string;                    // clave del body que recibe el nombre (default 'nombre')
};

export type Secuencia = {
  id: number;
  clave: string;
  nombre: string;
  etapa: string;
  trigger_tipo: string;
  activa: boolean;
  pasos: PasoSecuencia[];
};

// % de retención del VSL a partir del cual consideramos "lo vio en serio".
export const UMBRAL_VSL_PCT = 50;
// No inscribir leads más viejos que esto (días) — evita revivir cohortes muertas.
const VENTANA_DIAS = 30;

// ── Rate-limiter / anti-baneo de WhatsApp (defaults conservadores; override por env) ──
// El envío REAL de cada canal se decide POR WORKSPACE (lib/envio-flags.ts): un
// canal apagado marca sus pasos como 'omitido' (avanza sin enviar ni contar).
const MAX_POR_DIA = Number(process.env.NUTRICION_MAX_POR_DIA ?? '40');        // tope en 24h móviles (por workspace)
const MAX_POR_CORRIDA = Number(process.env.NUTRICION_MAX_POR_CORRIDA ?? '6'); // tope por corrida del cron
const HS_MIN_ENTRE_MSGS = 20;     // no mandar 2 mensajes al mismo lead en <20h
const TZ_OFFSET_MX = -6;          // ventana horaria evaluada en hora de México
const VENTANA_INICIO = 9;
const VENTANA_FIN = 21;

function ahoraISO(): string {
  return new Date().toISOString();
}
function enHorasISO(horas: number): string {
  return new Date(Date.now() + horas * 3600 * 1000).toISOString();
}
function haceDiasISO(dias: number): string {
  return new Date(Date.now() - dias * 86400 * 1000).toISOString();
}

// ── Secuencias ───────────────────────────────────────────────────────────────
export async function getSecuenciasActivas(): Promise<Secuencia[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos')
    .eq('activa', true);
  if (error) throw new Error(`getSecuenciasActivas: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown;
  }>;
  return rows.map((r) => ({
    id: r.id,
    clave: r.clave,
    nombre: r.nombre,
    etapa: r.etapa,
    trigger_tipo: r.trigger_tipo,
    activa: r.activa,
    pasos: Array.isArray(r.pasos) ? (r.pasos as PasoSecuencia[]) : [],
  }));
}

export type SecuenciaConStats = Secuencia & { inscriptos: number; enviados: number };

// Todas las secuencias (activas y pausadas) + conteo de inscriptos y enviados.
// Para la tab /whatsapp. Dos queries (no N+1): trae los ids y cuenta en JS.
export async function getSecuenciasConStats(): Promise<SecuenciaConStats[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos')
    .order('id', { ascending: true });
  if (error) throw new Error(`getSecuenciasConStats: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown;
  }>;

  const [insc, env] = await Promise.all([
    supabase.from('nutricion_inscripciones').select('secuencia_id'),
    supabase.from('nutricion_envios').select('secuencia_id').in('estado', ['enviado', 'simulado']),
  ]);
  const tally = (arr: Array<{ secuencia_id: number | null }> | null): Map<number, number> => {
    const m = new Map<number, number>();
    for (const r of arr ?? []) {
      if (r.secuencia_id == null) continue;
      m.set(r.secuencia_id, (m.get(r.secuencia_id) ?? 0) + 1);
    }
    return m;
  };
  const inscMap = tally(insc.data as Array<{ secuencia_id: number | null }> | null);
  const envMap = tally(env.data as Array<{ secuencia_id: number | null }> | null);

  return rows.map((r) => ({
    id: r.id,
    clave: r.clave,
    nombre: r.nombre,
    etapa: r.etapa,
    trigger_tipo: r.trigger_tipo,
    activa: r.activa,
    pasos: Array.isArray(r.pasos) ? (r.pasos as PasoSecuencia[]) : [],
    inscriptos: inscMap.get(r.id) ?? 0,
    enviados: envMap.get(r.id) ?? 0,
  }));
}

export async function setSecuenciaActiva(id: number, activa: boolean): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ activa, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaActiva: ${error.message}`);
}

export async function setSecuenciaPasos(id: number, pasos: PasoSecuencia[]): Promise<void> {
  const supabase = (await getTenantDb());
  // Normaliza el orden (1..n) y descarta basura.
  const limpio = pasos
    .filter((p) => p && typeof p === 'object')
    .map((p, i) => ({
      orden: i + 1,
      canal: p.canal === 'email' ? 'email' : 'whatsapp',
      delay_horas: Math.max(0, Math.round(Number(p.delay_horas) || 0)),
      asunto: typeof p.asunto === 'string' ? p.asunto : null,
      preheader: typeof p.preheader === 'string' ? p.preheader : null,
      cuerpo: typeof p.cuerpo === 'string' ? p.cuerpo : '',
      proveedor: p.proveedor === 'no_oficial' ? 'no_oficial' : 'oficial',
      template_wa: p.template_wa ?? null,
      template_categoria: p.template_categoria,
      template_idioma: p.template_idioma ?? 'es_MX',
      template_param: p.template_param ?? 'nombre',
    }));
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ pasos: limpio, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaPasos: ${error.message}`);
}

// ── Cohortes: qué leads dispara cada secuencia ───────────────────────────────
export async function leadsDeCohorte(triggerTipo: string): Promise<number[]> {
  const supabase = (await getTenantDb());
  const desde = haceDiasISO(VENTANA_DIAS);          // timestamp ISO, para created_at
  const hoy = ahoraISO().slice(0, 10);              // YYYY-MM-DD (UTC), para fechas futuras
  const fechaDesde45 = haceDiasISO(45).slice(0, 10); // YYYY-MM-DD, ventana de hitos recientes

  if (triggerTipo === 'instant_form_sin_agenda') {
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .not('meta_lead_id', 'is', null)
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .gte('created_at', desde);
    if (error) throw new Error(`cohorte form-sin-agenda: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'vio_vsl_sin_agendar') {
    const { data, error } = await supabase
      .from('leads')
      .select('id, visitor_id')
      .not('visitor_id', 'is', null)
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .gte('created_at', desde);
    if (error) throw new Error(`cohorte vio-vsl: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: number; visitor_id: string }>;
    const eng = await getVslEngagementMap(rows.map((r) => r.visitor_id));
    return rows
      .filter((r) => (eng.get(r.visitor_id)?.max_pct ?? 0) >= UMBRAL_VSL_PCT)
      .map((r) => r.id);
  }

  if (triggerTipo === 'vio_poco_vsl') {
    // Tiene tracking de visitante (entró a la landing) pero NO alcanzó el umbral
    // de retención del VSL y no agendó. Complemento exacto de vio_vsl_sin_agendar.
    const { data, error } = await supabase
      .from('leads')
      .select('id, visitor_id')
      .not('visitor_id', 'is', null)
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .gte('created_at', desde);
    if (error) throw new Error(`cohorte vio-poco-vsl: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: number; visitor_id: string }>;
    const eng = await getVslEngagementMap(rows.map((r) => r.visitor_id));
    return rows
      .filter((r) => (eng.get(r.visitor_id)?.max_pct ?? 0) < UMBRAL_VSL_PCT)
      .map((r) => r.id);
  }

  if (triggerTipo === 'agendado_sin_confirmar') {
    // J1 futura y todavía sin asistencia registrada. El modelo no tiene un campo
    // "confirmó asistencia" → usamos la J1 próxima como disparador del recordatorio.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .not('fecha_junta_1', 'is', null)
      .gte('fecha_junta_1', hoy)
      .is('asistio_j1', null)
      .eq('estado_lead', 'abierto');
    if (error) throw new Error(`cohorte agendado-sin-confirmar: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'no_show_j1') {
    // No asistió a J1 (asistio_j1 = false), todavía abierto, J1 reciente.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('asistio_j1', false)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_1', fechaDesde45);
    if (error) throw new Error(`cohorte no-show-j1: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'post_j1_sin_avanzar') {
    // Asistió a J1 pero sigue sin calificar y sin J2 agendada.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('asistio_j1', true)
      .is('calificado', null)
      .is('fecha_junta_2', null)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_1', fechaDesde45);
    if (error) throw new Error(`cohorte post-j1-sin-avanzar: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'post_j1_calificado_sin_j2') {
    // Calificado en J1 pero todavía no agendó la J2.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('calificado', true)
      .is('fecha_junta_2', null)
      .is('asistio_j2', null)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_1', fechaDesde45);
    if (error) throw new Error(`cohorte calificado-sin-j2: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'no_show_j2') {
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('asistio_j2', false)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_2', fechaDesde45);
    if (error) throw new Error(`cohorte no-show-j2: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'post_j2_sin_cerrar') {
    // Asistió a J2 pero todavía no hay cierre.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('asistio_j2', true)
      .is('cerro', null)
      .is('fecha_cierre', null)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_2', fechaDesde45);
    if (error) throw new Error(`cohorte post-j2-sin-cerrar: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'confirmado_sin_pago') {
    // Confirmó verbalmente (fecha_confirmacion) pero todavía no registró el primer pago.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .not('fecha_confirmacion', 'is', null)
      .is('fecha_primer_pago', null)
      .in('estado_lead', ['abierto', 'ganado'])
      .gte('fecha_confirmacion', fechaDesde45);
    if (error) throw new Error(`cohorte confirmado-sin-pago: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'post_pago') {
    // Registró el primer pago hace poco → bienvenida (una sola vez por dedup de inscripción).
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .not('fecha_primer_pago', 'is', null)
      .gte('fecha_primer_pago', fechaDesde45)
      .in('estado_lead', ['abierto', 'ganado']);
    if (error) throw new Error(`cohorte post-pago: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'reactivacion_viejo') {
    // Frío: nunca agendó, abierto, creado entre 30 y 90 días atrás.
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .lt('created_at', desde)
      .gte('created_at', haceDiasISO(90));
    if (error) throw new Error(`cohorte reactivacion-viejo: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  if (triggerTipo === 'ultimo_intento_antes_noresp') {
    // Último intento antes de marcar no-responde: nunca agendó, abierto, creado
    // entre 90 y 365 días atrás (más viejo que la reactivación).
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .lt('created_at', haceDiasISO(90))
      .gte('created_at', haceDiasISO(365));
    if (error) throw new Error(`cohorte ultimo-intento: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  }

  // trigger desconocido → sin cohorte (no rompe el cron)
  return [];
}

// ── Inscripción ──────────────────────────────────────────────────────────────
export type PlanInscripcion = { secuencia: string; lead_id: number; proximo_envio_at: string };

// Devuelve los leads que se inscribirían (no escribe). Para el dry-run.
export async function planificarInscripciones(): Promise<PlanInscripcion[]> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const plan: PlanInscripcion[] = [];

  for (const sec of secuencias) {
    const candidatos = await leadsDeCohorte(sec.trigger_tipo);
    if (candidatos.length === 0) continue;
    const { data: yaInsc, error } = await supabase
      .from('nutricion_inscripciones')
      .select('lead_id')
      .eq('secuencia_id', sec.id)
      .in('lead_id', candidatos);
    if (error) throw new Error(`planificarInscripciones: ${error.message}`);
    const inscriptos = new Set(((yaInsc ?? []) as Array<{ lead_id: number }>).map((r) => r.lead_id));
    const delay0 = sec.pasos[0]?.delay_horas ?? 0;
    for (const lead_id of candidatos) {
      if (inscriptos.has(lead_id)) continue;
      plan.push({ secuencia: sec.clave, lead_id, proximo_envio_at: enHorasISO(delay0) });
    }
  }
  return plan;
}

// Persiste las inscripciones nuevas. Devuelve cuántas creó.
export async function comprometerInscripciones(): Promise<number> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  let creadas = 0;

  for (const sec of secuencias) {
    const candidatos = await leadsDeCohorte(sec.trigger_tipo);
    if (candidatos.length === 0) continue;
    const { data: yaInsc } = await supabase
      .from('nutricion_inscripciones')
      .select('lead_id')
      .eq('secuencia_id', sec.id)
      .in('lead_id', candidatos);
    const inscriptos = new Set(((yaInsc ?? []) as Array<{ lead_id: number }>).map((r) => r.lead_id));
    const delay0 = sec.pasos[0]?.delay_horas ?? 0;
    const nuevas = candidatos
      .filter((id) => !inscriptos.has(id))
      .map((lead_id) => ({
        lead_id,
        secuencia_id: sec.id,
        paso_actual: 0,
        estado: 'activa',
        proximo_envio_at: enHorasISO(delay0),
      }));
    if (nuevas.length === 0) continue;
    const { error } = await supabase.from('nutricion_inscripciones').insert(nuevas);
    if (error) throw new Error(`comprometerInscripciones: ${error.message}`);
    creadas += nuevas.length;
  }
  return creadas;
}

// ── Envíos vencidos ───────────────────────────────────────────────────────────
type InscripcionVencida = {
  id: number;
  lead_id: number;
  secuencia_id: number;
  paso_actual: number;
};

export type PlanEnvio = {
  inscripcion_id: number;
  lead_id: number;
  secuencia: string;
  paso: number;
  canal: CanalNutricion | null;
  detalle: string;
};

async function inscripcionesVencidas(): Promise<InscripcionVencida[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .select('id, lead_id, secuencia_id, paso_actual')
    .eq('estado', 'activa')
    .lte('proximo_envio_at', ahoraISO());
  if (error) throw new Error(`inscripcionesVencidas: ${error.message}`);
  return (data ?? []) as InscripcionVencida[];
}

// Devuelve qué se enviaría ahora (no escribe). Para el dry-run.
export async function planificarEnvios(): Promise<PlanEnvio[]> {
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));
  const due = await inscripcionesVencidas();
  return due.map((insc) => {
    const sec = porId.get(insc.secuencia_id);
    const paso = sec?.pasos[insc.paso_actual];
    return {
      inscripcion_id: insc.id,
      lead_id: insc.lead_id,
      secuencia: sec?.clave ?? `#${insc.secuencia_id}`,
      paso: insc.paso_actual + 1,
      canal: paso?.canal ?? null,
      detalle: paso ? `${paso.canal}: ${paso.asunto ?? paso.cuerpo.slice(0, 40)}` : 'sin paso → se completaría',
    };
  });
}

function haceHorasISO(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function dentroDeVentana(): boolean {
  const hLocal = (new Date().getUTCHours() + TZ_OFFSET_MX + 24) % 24;
  return hLocal >= VENTANA_INICIO && hLocal < VENTANA_FIN;
}

// Tope diario: cuenta SOLO envíos reales — una corrida de prueba (?commit=1,
// simulados) no debe consumir el presupuesto anti-baneo del workspace.
async function enviosUltimas24h(): Promise<number> {
  const supabase = (await getTenantDb());
  const { count, error } = await supabase
    .from('nutricion_envios')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado')
    .gte('created_at', haceHorasISO(24));
  if (error) throw new Error(`enviosUltimas24h: ${error.message}`);
  return count ?? 0;
}

// Set de lead_ids que ya recibieron un envío (nutrición o broadcast) en las
// últimas HS_MIN_ENTRE_MSGS horas — calculado en 2 queries batch para TODOS los
// leads de la corrida (antes eran 2 count-queries POR lead dentro del loop: N+1).
async function leadsConEnvioReciente(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = (await getTenantDb());
  const desde = haceHorasISO(HS_MIN_ENTRE_MSGS);
  const [nutri, bcast] = await Promise.all([
    supabase.from('nutricion_envios').select('lead_id')
      .in('lead_id', leadIds).in('estado', ['enviado', 'simulado']).gte('created_at', desde),
    supabase.from('email_broadcast_envios').select('lead_id')
      .in('lead_id', leadIds).in('estado', ['enviado', 'simulado']).gte('created_at', desde),
  ]);
  for (const r of (nutri.data ?? []) as Array<{ lead_id: number }>) set.add(r.lead_id);
  for (const r of (bcast.data ?? []) as Array<{ lead_id: number }>) set.add(r.lead_id);
  return set;
}

export type ResultadoProceso = {
  saltado?: string;
  enviados: number;
  simulados: number;
  omitidos: number;
  borradores: number;
  fallos: number;
  detalle: Array<{ lead_id: number; canal: string; estado: string; nota?: string }>;
};

// Procesa los envíos vencidos con rate-limiting anti-baneo: ventana horaria,
// tope diario (24h móviles), tope por corrida y guard de 20h por lead.
// El envío REAL de cada canal se decide por workspace (envio-flags):
//   · canal habilitado  → envío real (WhatsApp exige template aprobado).
//   · canal apagado     → 'omitido': avanza el paso SIN enviar y sin contar en
//     KPIs/guard/tope — el cliente eligió no usar ese canal y la cadencia sigue.
//   · opts.simularApagados → los canales apagados se marcan 'simulado' (modo
//     prueba de la máquina, el ?commit=1 histórico).
// Un 'fallo' NO avanza el paso (se reintenta), salvo condición terminal.
export async function procesarEnvios(opts?: { ignorarVentana?: boolean; simularApagados?: boolean }): Promise<ResultadoProceso> {
  const res: ResultadoProceso = { enviados: 0, simulados: 0, omitidos: 0, borradores: 0, fallos: 0, detalle: [] };
  const [waOn, emailOn, sandbox, remitente, instEvo] = await Promise.all([
    envioWhatsappHabilitado(),
    envioEmailHabilitado(),
    remitenteEsSandbox(),
    getEmailFrom(),
    getInstanciaRow(),
  ]);
  // Firma del footer de los emails = display name del remitente DEL WORKSPACE.
  const fromNameWs = displayNameDe(remitente);
  // ¿El número no oficial (Evolution) está conectado? (para los pasos proveedor='no_oficial')
  const evoConectado = instEvo?.estado === 'conectado';

  if (!opts?.ignorarVentana && !dentroDeVentana()) {
    return { ...res, saltado: 'fuera-de-ventana-horaria' };
  }
  const presupuesto = MAX_POR_DIA - (await enviosUltimas24h());
  if (presupuesto <= 0) return { ...res, saltado: 'tope-diario' };
  const cupo = Math.min(MAX_POR_CORRIDA, presupuesto);

  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));

  // Cola PAGINADA: los 'omitido'/'saltado' no consumen cupo, así que una sola
  // ventana de cupo*3 podía llenarse de filas sin envío real y postergar los
  // envíos de verdad. Iteramos lotes (dedup por id de inscripción) hasta llenar
  // el cupo o drenar la cola de vencidas.
  const LOTE = cupo * 3;
  const vistos = new Set<number>();
  let rondas = 0;

  while (res.enviados + res.simulados < cupo && rondas < 6) {
    rondas += 1;
    const { data: dueRaw, error } = await supabase
      .from('nutricion_inscripciones')
      .select('id, lead_id, secuencia_id, paso_actual')
      .eq('estado', 'activa')
      .lte('proximo_envio_at', ahoraISO())
      .order('proximo_envio_at', { ascending: true })
      .limit(LOTE);
    if (error) throw new Error(`procesarEnvios: ${error.message}`);
    const fetched = (dueRaw ?? []) as Array<{ id: number; lead_id: number; secuencia_id: number; paso_actual: number }>;
    const due = fetched.filter((d) => !vistos.has(d.id));
    if (due.length === 0) break;
    for (const d of due) vistos.add(d.id);

    const leadIds = [...new Set(due.map((d) => d.lead_id))];
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, nombre, telefono, empresa, email, email_opt_out')
      .in('id', leadIds);
    const leadMap = new Map(
      ((leadsData ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null; empresa: string | null; email: string | null; email_opt_out: boolean | null }>).map((l) => [l.id, l]),
    );
    // Ventana anti-baneo de 20h resuelta en batch (no 2 counts por lead en el loop).
    const conEnvioReciente = await leadsConEnvioReciente(leadIds);

    for (const insc of due) {
      if (res.enviados + res.simulados >= cupo) break;

      const sec = porId.get(insc.secuencia_id);
      const paso = sec?.pasos[insc.paso_actual];
      if (!sec || !paso) {
        await supabase
          .from('nutricion_inscripciones')
          .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() })
          .eq('id', insc.id);
        continue;
      }

      // ¿El canal de este paso está apagado para el workspace? → va directo a
      // 'omitido' (no envía nada), así que el guard de 20h no aplica.
      const canalApagado = !opts?.simularApagados
        && ((paso.canal === 'whatsapp' && !waOn) || (paso.canal === 'email' && !emailOn));

      if (!canalApagado && conEnvioReciente.has(insc.lead_id)) {
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'msg <20h' });
        continue; // no avanzar; se reintenta en otra corrida
      }

      const lead = leadMap.get(insc.lead_id);
      let estado: 'enviado' | 'simulado' | 'omitido' | 'borrador' | 'fallo' = 'simulado';
      let nota: string | undefined;
      let proveedorId: string | null = null;
      // terminal = la condición no se resuelve reintentando (opt-out, sin email):
      // se cierra la inscripción en vez de dejarla reintentando para siempre.
      let terminal = false;
      // Horas hasta el próximo intento de un fallo NO terminal. Sin backoff, una
      // inscripción fallada conserva el proximo_envio_at MÁS viejo y monopoliza
      // la cabeza del ORDER BY para siempre (starvation + una fila de fallo por
      // corrida). 4h para fallos transitorios; 24h para los casi-permanentes.
      let backoffHoras = 4;

      if (canalApagado) {
        estado = 'omitido';
        nota = `canal ${paso.canal} apagado`;
      } else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {
        // Canal EMPRESA (no oficial, Evolution). Regla dura del PDF: a leads
        // CALIENTES nunca automático directo → borrador para el setter; a CLIENTES
        // (ya pagaron, riesgo bajo) → envío automático con anti-ban.
        const cuerpoNO = aplicarVariables(paso.cuerpo, valoresVariablesLead(lead ?? {}));
        if (!lead?.telefono) {
          estado = 'fallo'; nota = 'lead sin teléfono'; backoffHoras = 24;
        } else if (!evoConectado) {
          estado = 'fallo'; nota = 'WhatsApp de empresa no conectado'; backoffHoras = 24;
        } else if (await esLeadCliente(lead.id)) {
          const r = await enviarYEspejar({ telefono: lead.telefono, texto: cuerpoNO, leadId: lead.id });
          estado = r.ok ? 'enviado' : 'fallo';
          if (!r.ok) nota = r.error;
        } else if (await tieneBorradorNutriPendiente(lead.id)) {
          // Ya hay un borrador de nutrición pendiente para este lead → NO apilamos
          // otro y NO avanzamos: la cadencia espera a que el setter lo mande o
          // descarte. Reintentamos en 6h (no en cada corrida).
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'borrador pendiente' });
          await supabase.from('nutricion_inscripciones')
            .update({ proximo_envio_at: enHorasISO(6), updated_at: ahoraISO() }).eq('id', insc.id);
          continue;
        } else {
          // Lead caliente → BORRADOR (el setter lo manda con 1 clic).
          await crearBorrador({ leadId: lead.id, telefono: lead.telefono, texto: cuerpoNO, origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id });
          estado = 'borrador';
        }
      } else if (waOn && paso.canal === 'whatsapp') {
        if (!lead?.telefono) {
          estado = 'fallo';
          nota = 'lead sin teléfono';
          backoffHoras = 24; // casi-permanente: 1 reintento/día por si le cargan el teléfono
        } else if (!paso.template_wa) {
          estado = 'fallo';
          nota = 'paso sin template_wa';
          backoffHoras = 24; // error de config: 1 reintento/día hasta que lo arreglen
        } else {
          const r = await sendWhatsappTemplate({
            phone: lead.telefono,
            name: lead.nombre ?? '',
            content: paso.cuerpo,
            template: {
              name: paso.template_wa,
              category: paso.template_categoria ?? 'marketing',
              language: paso.template_idioma ?? 'es_MX',
              // Rellena TODAS las variables del catálogo (nombre, apellido, empresa…);
              // la plantilla usa las que necesite.
              bodyParams: valoresVariablesLead(lead),
            },
          });
          estado = r.ok ? 'enviado' : 'fallo';
          if (!r.ok) nota = r.error;
        }
      } else if (emailOn && paso.canal === 'email') {
        if (lead?.email_opt_out) {
          estado = 'fallo'; terminal = true;
          nota = 'lead dado de baja del email';
        } else if (!lead?.email) {
          estado = 'fallo'; terminal = true;
          nota = 'lead sin email';
        } else if (sandbox) {
          // Remitente sandbox (resend.dev) NO entrega a terceros: abortamos con un
          // error claro en vez de quemar el paso. Se resuelve al verificar dominio.
          estado = 'fallo';
          nota = 'remitente sandbox: verificá tu dominio de envío';
          backoffHoras = 24; // config pendiente: 1 reintento/día
        } else {
          const vars = valoresVariablesLead(lead);
          const cuerpo = aplicarVariables(paso.cuerpo, vars);
          const asunto = aplicarVariables(paso.asunto ?? '', vars) || '(sin asunto)';
          const unsubUrl = buildUnsubscribeUrl(insc.lead_id);
          const r = await sendEmail({
            to: lead.email,
            subject: asunto,
            html: renderEmailHtml({
              subject: asunto,
              bodyText: cuerpo,
              preheader: aplicarVariables(paso.preheader ?? '', vars) || undefined,
              unsubscribeUrl: unsubUrl,
              fromName: fromNameWs,
            }),
            text: cuerpo,
            headers: unsubUrl ? { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
            tags: [{ name: 'tipo', value: 'nutricion' }, { name: 'secuencia_id', value: String(insc.secuencia_id) }],
          });
          estado = r.ok ? 'enviado' : 'fallo';
          if (r.ok) proveedorId = r.id; else nota = r.error;
        }
      }
      // (con simularApagados, un paso de canal apagado cae acá como 'simulado')

      await supabase.from('nutricion_envios').insert({
        inscripcion_id: insc.id,
        lead_id: insc.lead_id,
        secuencia_id: insc.secuencia_id,
        paso: insc.paso_actual + 1,
        canal: paso.canal,
        estado,
        destino: paso.canal === 'whatsapp' ? lead?.telefono ?? null : lead?.email ?? null,
        asunto: paso.asunto,
        proveedor_id: proveedorId,
      });

      if (estado === 'fallo') {
        res.fallos += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado, nota });
        if (terminal) {
          // Condición permanente (opt-out / sin email): cerramos la inscripción para
          // que no se reintente eternamente y no acumule filas 'fallo' por corrida.
          await supabase
            .from('nutricion_inscripciones')
            .update({ estado: 'cancelada', proximo_envio_at: null, updated_at: ahoraISO() })
            .eq('id', insc.id);
        } else {
          // Backoff: corre el próximo intento para que la fila no bloquee la
          // cola ni genere una fila de 'fallo' por corrida.
          await supabase
            .from('nutricion_inscripciones')
            .update({ proximo_envio_at: enHorasISO(backoffHoras), updated_at: ahoraISO() })
            .eq('id', insc.id);
        }
        continue;
      }

      const siguiente = sec.pasos[insc.paso_actual + 1];
      await supabase
        .from('nutricion_inscripciones')
        .update({
          paso_actual: insc.paso_actual + 1,
          proximo_envio_at: siguiente ? enHorasISO(siguiente.delay_horas) : null,
          estado: siguiente ? 'activa' : 'completada',
          updated_at: ahoraISO(),
        })
        .eq('id', insc.id);

      if (estado === 'enviado') res.enviados += 1;
      else if (estado === 'omitido') res.omitidos += 1;
      else if (estado === 'borrador') res.borradores += 1;
      else res.simulados += 1;
      res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado, ...(nota ? { nota } : {}) });
    }

    if (fetched.length < LOTE) break; // cola drenada: no quedan más vencidas
  }

  return res;
}

// Pausa la nutrición de un lead cuando responde (lo usará /api/webhooks/chatwoot
// en el hito 2). Marca las inscripciones activas como 'respondio'.
export async function pausarPorRespuesta(leadId: number): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .update({ estado: 'respondio', proximo_envio_at: null, updated_at: ahoraISO() })
    .eq('lead_id', leadId)
    .eq('estado', 'activa')
    .select('id');
  if (error) throw new Error(`pausarPorRespuesta: ${error.message}`);
  return ((data ?? []) as Array<{ id: number }>).length;
}
