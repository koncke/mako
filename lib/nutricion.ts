// =============================================================================
// Motor de nutrición — VSL funnel (app = cerebro)
// =============================================================================
// La app decide a quién/qué/cuándo nutrir, leyendo el estado del lead + su
// comportamiento del VSL (Camino 1). Canales: email (Resend) y whatsapp
// (Chatwoot) — se enchufan en hitos siguientes.
//
// El envío REAL de cada canal se decide POR WORKSPACE (lib/envio-flags.ts).
// Un paso cuyo canal está apagado ESPERA (no se envía ni avanza): si el cliente
// prende el canal después, la cadencia sigue desde donde quedó. El ?commit=1
// histórico del cron simula los canales apagados ('simulado', avanza).
// =============================================================================

import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getVslEngagementMap } from '@/lib/leads';
import { pipelineStageOf } from '@/lib/pipeline';
import { sendWhatsappTemplate } from '@/lib/chatwoot';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { getInstanciaRow } from '@/lib/evolution';
import { esLeadCliente, enviarYEspejar, enviarAudioYEspejar, crearBorrador, tieneBorradorNutriPendiente } from '@/lib/evolution-envio';
import { getAudio, audioBase64 } from '@/lib/setting-audios';
import { estaBloqueado } from '@/lib/evolution-block';
import { estadoDraftPorNombre } from '@/lib/meta-templates';

export type CanalNutricion = 'email' | 'whatsapp';

export type ProveedorWa = 'oficial' | 'no_oficial';

export type PasoSecuencia = {
  orden: number;
  canal: CanalNutricion;
  delay_horas: number;
  // Anclaje del paso (#18, recordatorios de reunión): sin ancla, delay_horas
  // cuenta desde la inscripción/paso anterior; con ancla 'reunion', delay_horas
  // son horas ANTES de la próxima reunión del lead (R1; R2 si la R1 ya pasó).
  ancla?: 'reunion';
  // Tipo del paso (reunión 31/07: el vehículo del setting son NOTAS DE VOZ del
  // dueño). 'audio' exige audio_id de la biblioteca (lib/setting-audios.ts) y
  // sale SIEMPRE por el canal no oficial: un audio no cabe en una plantilla de
  // Meta. Sin tipo = 'texto' (todo lo anterior sigue igual).
  tipo?: 'texto' | 'audio';
  audio_id?: number | null;
  // Condición para que el paso salga (reunión 31/07). 'respondio' = el lead ya
  // contestó al menos una vez: es la regla del lead magnet ("¿lo querés? es
  // gratis" y recién si contesta se manda). 'sin_respuesta' = el rezagado que
  // nunca contestó — por ahí se degrada a email. Sin condición, siempre sale.
  /**
   * Condición para que este paso salga.
   *
   * `ya_contactado` / `primer_contacto` existen para un caso muy concreto: dos
   * leads que acaban de agendar caen en el MISMO cohorte, pero a uno ya le
   * hablaste (recibió tu audio de bienvenida) y al otro no lo saludaste nunca.
   * Mandarle "hola, soy Fulano" a alguien con quien ya venías conversando suena
   * a robot al instante. Con este par, la secuencia post-agenda lleva DOS pasos
   * de apertura mutuamente excluyentes y sale exactamente uno.
   */
  requiere?: 'respondio' | 'sin_respuesta' | 'ya_contactado' | 'primer_contacto';
  /**
   * Formas distintas de decir lo MISMO. Las escribe MaKo una sola vez, al armar
   * la secuencia, y el motor elige una al azar en cada envío.
   *
   * Existen por dos razones que empujan en la misma dirección: mandarle el mismo
   * texto palabra por palabra a cientos de personas es el patrón que WhatsApp
   * detecta para banear un número, y además se lee como un bot. Generarlas en
   * cada envío costaría una llamada de IA por lead; generarlas una vez y sortear
   * cuesta cero y evita las dos cosas.
   */
  variantes?: string[];
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
// canal apagado deja sus pasos ESPERANDO (reintento en 24h, sin enviar ni avanzar).
const MAX_POR_DIA = Number(process.env.NUTRICION_MAX_POR_DIA ?? '40');        // tope en 24h móviles (por workspace)
const MAX_POR_CORRIDA = Number(process.env.NUTRICION_MAX_POR_CORRIDA ?? '6'); // tope por corrida del cron
const HS_MIN_ENTRE_MSGS = 20;     // no mandar 2 mensajes al mismo lead en <20h (prospección fría)
// Excepción del guard anterior (reunión 31/07): con una reunión encima, la
// cadencia de preparación exige toques cercanos ("si chateo dos veces y le mando
// un audio, ya no falta"). El presupuesto anti-ban de una CONVERSACIÓN abierta o
// de un lead con reunión próxima no es el de la prospección fría.
const HS_MIN_PREPARACION = 3;
const HS_REUNION_CERCA = 48;      // reunión dentro de este plazo → cadencia de preparación
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
    .eq('activa', true)
    // Archivada nunca enrola ni envía, aunque haya quedado con activa=true.
    .is('archivada_at', null);
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

export type SecuenciaConStats = Secuencia & { inscriptos: number; enviados: number; estrategia: unknown };

// Todas las secuencias (activas y pausadas) + conteo de inscriptos y enviados.
// Para la tab /whatsapp y /setting. Dos queries (no N+1): ids y cuenta en JS.
// `estrategia` (jsonb, mig 0107) viaja crudo: el parser vive en setting-estrategia.
export async function getSecuenciasConStats(): Promise<SecuenciaConStats[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia')
    // Las archivadas no se listan, no enrolan y no envían. No se borran porque
    // las inscripciones y los envíos las referencian: borrarlas se llevaría
    // puesto el historial de a quién se le escribió.
    .is('archivada_at', null)
    .order('id', { ascending: true });
  if (error) throw new Error(`getSecuenciasConStats: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown;
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
    estrategia: r.estrategia ?? null,
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

/**
 * El texto que sale en ESTE envío: una de las variantes del paso, al azar, o el
 * cuerpo original si no tiene. El sorteo va acá y no en el que llama para que
 * cualquier canal que mande texto lo herede sin acordarse.
 */
export function textoDelPaso(paso: Pick<PasoSecuencia, 'cuerpo' | 'variantes'>): string {
  const vs = (paso.variantes ?? []).filter((v) => typeof v === 'string' && v.trim());
  if (!vs.length) return paso.cuerpo;
  // El cuerpo original entra al sorteo: es la versión que el dueño aprobó.
  const pool = [paso.cuerpo, ...vs].filter((t) => t.trim());
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function setSecuenciaPasos(id: number, pasos: PasoSecuencia[]): Promise<void> {
  const supabase = (await getTenantDb());

  // Lo que ya está guardado, para MERGEAR los campos que ninguna pantalla edita.
  //
  // Esta función reconstruye cada paso campo por campo, así que lo que el cliente
  // no mande se BORRA. Las variantes las genera MaKo una sola vez al armar la
  // secuencia y no viven en ningún formulario: sin este merge, guardar el copy
  // desde el wizard o desde el editor las borraba todas en silencio, y el motor
  // volvía a mandar el mismo texto a todo el mundo sin que nadie se enterara.
  const { data: previo } = await supabase
    .from('nutricion_secuencias').select('pasos').eq('id', id).maybeSingle();
  const antes = Array.isArray((previo as { pasos?: unknown } | null)?.pasos)
    ? ((previo as { pasos: PasoSecuencia[] }).pasos)
    : [];
  const variantesPrevias = new Map<number, string[]>();
  for (const p of antes) {
    if (Array.isArray(p?.variantes) && p.variantes.length) variantesPrevias.set(Number(p.orden), p.variantes);
  }

  // Normaliza el orden (1..n) y descarta basura.
  const limpio = pasos
    .filter((p) => p && typeof p === 'object')
    .map((p, i) => ({
      orden: i + 1,
      // Un paso de audio es de WhatsApp por definición (no hay nota de voz por email).
      canal: p.canal === 'email' && p.tipo !== 'audio' ? 'email' : 'whatsapp',
      delay_horas: Math.max(0, Math.round(Number(p.delay_horas) || 0)),
      ...(p.ancla === 'reunion' ? { ancla: 'reunion' as const } : {}),
      // Paso de nota de voz: exige audio de la biblioteca (si no, degrada a texto).
      ...(p.tipo === 'audio' && Number(p.audio_id)
        ? { tipo: 'audio' as const, audio_id: Number(p.audio_id) }
        : {}),
      ...(p.requiere === 'respondio' || p.requiere === 'sin_respuesta' || p.requiere === 'ya_contactado' || p.requiere === 'primer_contacto'
        ? { requiere: p.requiere as PasoSecuencia['requiere'] }
        : {}),
      asunto: typeof p.asunto === 'string' ? p.asunto : null,
      preheader: typeof p.preheader === 'string' ? p.preheader : null,
      cuerpo: typeof p.cuerpo === 'string' ? p.cuerpo : '',
      // Un audio SIEMPRE sale por el no oficial: Meta no aprueba plantillas con
      // nota de voz, así que el proveedor no es elegible en ese caso.
      proveedor: (p.tipo === 'audio' && Number(p.audio_id)) || p.proveedor === 'no_oficial' ? 'no_oficial' : 'oficial',
      template_wa: p.template_wa ?? null,
      template_categoria: p.template_categoria,
      template_idioma: p.template_idioma ?? 'es_MX',
      template_param: p.template_param ?? 'nombre',
      // Las variantes las manda el cliente solo si las está editando; si no,
      // sobreviven las que ya había para ese orden.
      ...(() => {
        const vs = Array.isArray(p.variantes) && p.variantes.length ? p.variantes : variantesPrevias.get(i + 1);
        return vs?.length ? { variantes: vs.filter((v) => typeof v === 'string' && v.trim()).slice(0, 8) } : {};
      })(),
    }));
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ pasos: limpio, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaPasos: ${error.message}`);
}

// ── Cohortes: qué leads dispara cada secuencia ───────────────────────────────
// Los 13 triggers "legacy" consultan columnas del funnel estándar. El trigger
// 'etapa_actual' es el camino funnel-agnóstico (#34): la secuencia se cuelga de
// una etapa del funnel derivado (nutricion_secuencias.etapa = stage key) y
// enrola a los leads cuya etapa EFECTIVA (override manual o derivada) coincide —
// sirve para cualquier funnel, incluidas etapas custom del editor.
export async function leadsDeCohorte(triggerTipo: string, etapa?: string | null): Promise<number[]> {
  const supabase = (await getTenantDb());
  const desde = haceDiasISO(VENTANA_DIAS);          // timestamp ISO, para created_at
  const hoy = ahoraISO().slice(0, 10);              // YYYY-MM-DD (UTC), para fechas futuras
  const fechaDesde45 = haceDiasISO(45).slice(0, 10); // YYYY-MM-DD, ventana de hitos recientes

  if (triggerTipo === 'etapa_actual') {
    if (!etapa) return [];
    // Ventana anti-revival de 90 días sobre el ÚLTIMO HITO del lead (no sobre su
    // edad): un lead viejo con una transición fresca (agendó, tuvo reunión)
    // entra; uno sin actividad en 90 días queda afuera.
    const { data, error } = await supabase
      .from('leads')
      .select('id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada, created_at')
      .eq('estado_lead', 'abierto');
    if (error) throw new Error(`cohorte etapa_actual(${etapa}): ${error.message}`);
    type LeadEtapa = { id: number; estado_lead: 'abierto'; pipeline_stage: string | null; fecha_agenda: string | null; fecha_junta_1: string | null; fecha_junta_2: string | null; asistio_j1: boolean | null; asistio_j2: boolean | null; nutricion_realizada: boolean | null; created_at: string };
    const corte = Date.now() - 90 * 86400 * 1000;
    const ultimoHito = (l: LeadEtapa): number => Math.max(
      ...[l.created_at, l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2]
        .filter((x): x is string => Boolean(x))
        .map((x) => Date.parse(x))
        .filter((ms) => Number.isFinite(ms)),
      0,
    );
    return ((data ?? []) as LeadEtapa[])
      .filter((l) => ultimoHito(l) >= corte)
      .filter((l) => pipelineStageOf({ ...l, nutricion_realizada: l.nutricion_realizada ?? undefined }) === etapa)
      .map((l) => l.id);
  }

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

// ── Agenda de pasos ──────────────────────────────────────────────────────────
type JuntasLead = { fecha_junta_1?: string | null; junta_1_at?: string | null; fecha_junta_2?: string | null; junta_2_at?: string | null };

// Offset horario de México en formato ISO (derivado de TZ_OFFSET_MX).
const OFFSET_MX = `${TZ_OFFSET_MX < 0 ? '-' : '+'}${String(Math.abs(TZ_OFFSET_MX)).padStart(2, '0')}:00`;

// fecha_junta_* es DATE ('YYYY-MM-DD'): parsearla directo daría medianoche UTC
// (= la TARDE del día anterior en MX) y una reunión de hoy contaría como pasada.
// Sin hora exacta (junta_*_at, Calendly) asumimos mediodía MX como hora default.
function parseFechaJunta(x: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T12:00:00${OFFSET_MX}` : x);
}

/** Timestamp (ms) de la próxima reunión FUTURA del lead, o null si no tiene. */
function reunionFuturaMs(juntas: JuntasLead | null | undefined): number | null {
  const candidatos = [juntas?.junta_1_at ?? juntas?.fecha_junta_1, juntas?.junta_2_at ?? juntas?.fecha_junta_2]
    .filter((x): x is string => Boolean(x))
    .map(parseFechaJunta)
    .filter((ms) => Number.isFinite(ms) && ms > Date.now());
  return candidatos.length ? Math.min(...candidatos) : null;
}

/**
 * Cuándo toca un paso: delay relativo (default) o, si está anclado a la reunión
 * (#18), delay_horas ANTES de la próxima reunión futura del lead (prefiere la
 * hora exacta junta_*_at; una fecha sin hora cuenta como mediodía MX). Sin
 * reunión futura → ahora: procesarEnvios re-valida el ancla al enviar y cierra
 * la inscripción si la reunión ya pasó.
 */
function proximoEnvioDePaso(paso: PasoSecuencia | undefined, juntas: JuntasLead | null | undefined): string {
  if (paso?.ancla === 'reunion') {
    const reunion = reunionFuturaMs(juntas);
    if (reunion != null) {
      const objetivo = reunion - (paso.delay_horas || 0) * 3600 * 1000;
      return new Date(Math.max(objetivo, Date.now())).toISOString();
    }
    return ahoraISO();
  }
  return enHorasISO(paso?.delay_horas ?? 0);
}

// Copy que sigue con texto de relleno del seed ([tu problema], [resultado]…).
// Los [tu link …] son placeholders del SISTEMA (se reemplazan al enviar) y no
// cuentan. Espejo del heurístico de la UI (NutricionGenerar).
const RX_RELLENO = /\[(?!tu link)[^\]\n]{2,80}\]/i;
const pasoConRelleno = (p: PasoSecuencia): boolean =>
  RX_RELLENO.test(p.cuerpo) || RX_RELLENO.test(p.asunto ?? '');

// ── Inscripción ──────────────────────────────────────────────────────────────
export type PlanInscripcion = { secuencia: string; lead_id: number; proximo_envio_at: string };

// Devuelve los leads que se inscribirían (no escribe). Para el dry-run.
export async function planificarInscripciones(): Promise<PlanInscripcion[]> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const plan: PlanInscripcion[] = [];

  for (const sec of secuencias) {
    const candidatos = await leadsDeCohorte(sec.trigger_tipo, sec.etapa);
    if (candidatos.length === 0) continue;
    const { data: yaInsc, error } = await supabase
      .from('nutricion_inscripciones')
      .select('lead_id')
      .eq('secuencia_id', sec.id)
      .in('lead_id', candidatos);
    if (error) throw new Error(`planificarInscripciones: ${error.message}`);
    const inscriptos = new Set(((yaInsc ?? []) as Array<{ lead_id: number }>).map((r) => r.lead_id));
    const pendientes = candidatos.filter((id) => !inscriptos.has(id));
    const horarios = await horariosDeInscripcion(sec.pasos[0], pendientes);
    for (const lead_id of pendientes) {
      plan.push({ secuencia: sec.clave, lead_id, proximo_envio_at: horarios.get(lead_id) ?? enHorasISO(sec.pasos[0]?.delay_horas ?? 0) });
    }
  }
  return plan;
}

/**
 * Horario del primer paso para cada lead pendiente de inscribir. Con paso 0
 * anclado a la reunión (#18), trae la agenda de cada lead en una query batch;
 * sin ancla, delay relativo. Compartido por el dry-run y el commit para que el
 * preview no mienta sobre el horario.
 */
async function horariosDeInscripcion(paso0: PasoSecuencia | undefined, pendientes: number[]): Promise<Map<number, string>> {
  let juntasMap = new Map<number, JuntasLead>();
  if (paso0?.ancla === 'reunion' && pendientes.length) {
    const supabase = (await getTenantDb());
    const { data: jl } = await supabase
      .from('leads')
      .select('id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at')
      .in('id', pendientes);
    juntasMap = new Map(((jl ?? []) as Array<{ id: number } & JuntasLead>).map((l) => [l.id, l]));
  }
  return new Map(pendientes.map((id) => [id, proximoEnvioDePaso(paso0, juntasMap.get(id))]));
}

// Persiste las inscripciones nuevas. Devuelve cuántas creó.
export async function comprometerInscripciones(): Promise<number> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  let creadas = 0;

  for (const sec of secuencias) {
    const candidatos = await leadsDeCohorte(sec.trigger_tipo, sec.etapa);
    if (candidatos.length === 0) continue;
    const { data: yaInsc } = await supabase
      .from('nutricion_inscripciones')
      .select('lead_id')
      .eq('secuencia_id', sec.id)
      .in('lead_id', candidatos);
    const inscriptos = new Set(((yaInsc ?? []) as Array<{ lead_id: number }>).map((r) => r.lead_id));
    const pendientes = candidatos.filter((id) => !inscriptos.has(id));
    const horarios = await horariosDeInscripcion(sec.pasos[0], pendientes);
    const nuevas = pendientes.map((lead_id) => ({
      lead_id,
      secuencia_id: sec.id,
      paso_actual: 0,
      estado: 'activa',
      proximo_envio_at: horarios.get(lead_id) ?? enHorasISO(sec.pasos[0]?.delay_horas ?? 0),
    }));
    if (nuevas.length === 0) continue;
    const { error } = await supabase.from('nutricion_inscripciones').insert(nuevas);
    if (error) throw new Error(`comprometerInscripciones: ${error.message}`);
    creadas += nuevas.length;
  }
  return creadas;
}

// ── Enrolamiento por EVENTO (inmediatez — reunión 31/07) ─────────────────────
// Regla del negocio: al lead que llena el formulario de Meta hay que escribirle
// casi al instante ("si pasan días, nos van a tratar como extraños"). El cron
// horario no alcanza: estos enganches enrolan y disparan el primer paso YA.
//
// La ventana horaria SÍ se respeta (no despertamos a nadie a las 3am): si el
// evento cae fuera de 9-21 MX, la inscripción queda vencida y la levanta la
// primera corrida del cron de la mañana.

export type EventoNutricion = 'lead_nuevo' | 'agenda_nueva';

// Qué triggers responden a cada evento. Los cohortes siguen siendo la fuente de
// verdad de A QUIÉN le toca: acá solo decidimos QUÉ secuencias mirar ya mismo.
const TRIGGERS_POR_EVENTO: Record<EventoNutricion, string[]> = {
  lead_nuevo: ['instant_form_sin_agenda', 'vio_vsl_sin_agendar', 'vio_poco_vsl'],
  agenda_nueva: ['agendado_sin_confirmar'],
};

/**
 * Enrola a UN lead en las secuencias activas del evento y dispara su primer
 * paso en el acto. Best-effort: nunca tira (lo llaman webhooks — si falla el
 * enrolamiento, el lead igual quedó creado y el cron lo levanta después).
 * Devuelve cuántas inscripciones creó.
 */
export async function enrolarPorEvento(leadId: number, evento: EventoNutricion): Promise<number> {
  try {
    const supabase = await getTenantDb();
    const claves = TRIGGERS_POR_EVENTO[evento] ?? [];
    if (!claves.length) return 0;
    const secuencias = (await getSecuenciasActivas()).filter((s) => claves.includes(s.trigger_tipo));
    if (!secuencias.length) return 0;

    const { data: yaInsc } = await supabase
      .from('nutricion_inscripciones')
      .select('secuencia_id')
      .eq('lead_id', leadId)
      .in('secuencia_id', secuencias.map((s) => s.id));
    const inscripto = new Set(((yaInsc ?? []) as Array<{ secuencia_id: number }>).map((r) => r.secuencia_id));

    const nuevas = secuencias
      .filter((s) => !inscripto.has(s.id))
      .map((s) => ({
        lead_id: leadId,
        secuencia_id: s.id,
        paso_actual: 0,
        estado: 'activa',
        // El primer paso de una secuencia disparada por evento sale YA: el
        // delay configurado cuenta desde el evento, no desde el cron.
        proximo_envio_at: proximoEnvioDePaso(s.pasos[0], null),
      }));
    if (!nuevas.length) return 0;

    const { error } = await supabase.from('nutricion_inscripciones').insert(nuevas);
    if (error) { console.error(`[nutricion] enrolarPorEvento(${evento}) lead ${leadId}: ${error.message}`); return 0; }

    // Vía rápida: intentamos mandar el primer paso ahora mismo, solo de este lead.
    try { await procesarEnvios({ soloLeadId: leadId }); }
    catch (e) { console.error(`[nutricion] envío inmediato lead ${leadId} falló:`, e); }
    return nuevas.length;
  } catch (e) {
    console.error(`[nutricion] enrolarPorEvento(${evento}) lead ${leadId} falló:`, e);
    return 0;
  }
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
/**
 * Leads a los que el negocio YA les habló alguna vez por nutrición.
 *
 * Sirve para el par `ya_contactado` / `primer_contacto`: a alguien que acaba de
 * agendar y ya recibió tu audio de bienvenida no se le manda "hola, soy Fulano"
 * de nuevo — suena a robot al instante.
 *
 * La imprecisión que hay que aceptar: "recibió ALGO" no es idéntico a "recibió
 * LA bienvenida". Cubre bien el caso real (el lead que entró por el formulario
 * y después agendó) y solo se equivoca si recibió otra nutrición distinta antes.
 * Distinguirlo de verdad exigiría rastrear qué secuencia mandó qué, y para la
 * decisión que hay que tomar acá —presentarse o no— no cambia el resultado.
 */
async function leadsYaContactados(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = (await getTenantDb());
  const { data } = await supabase.from('nutricion_envios')
    .select('lead_id').in('lead_id', leadIds).in('estado', ['enviado', 'simulado']);
  for (const r of (data ?? []) as Array<{ lead_id: number | null }>) {
    if (r.lead_id != null) set.add(r.lead_id);
  }
  return set;
}

async function leadsConEnvioReciente(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = (await getTenantDb());
  const desde = haceHorasISO(HS_MIN_ENTRE_MSGS);
  const desdeCorto = haceHorasISO(HS_MIN_PREPARACION);
  const [nutri, bcast, enPreparacion] = await Promise.all([
    supabase.from('nutricion_envios').select('lead_id, created_at')
      .in('lead_id', leadIds).in('estado', ['enviado', 'simulado']).gte('created_at', desde),
    supabase.from('email_broadcast_envios').select('lead_id')
      .in('lead_id', leadIds).in('estado', ['enviado', 'simulado']).gte('created_at', desde),
    // Leads con reunión FUTURA cercana: están en cadencia de preparación.
    supabase.from('leads').select('id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at').in('id', leadIds),
  ]);
  const prep = new Set<number>();
  for (const l of (enPreparacion.data ?? []) as Array<{ id: number } & JuntasLead>) {
    const ms = reunionFuturaMs(l);
    if (ms != null && ms - Date.now() <= HS_REUNION_CERCA * 3600 * 1000) prep.add(l.id);
  }
  for (const r of (nutri.data ?? []) as Array<{ lead_id: number; created_at: string | null }>) {
    // Con reunión encima, el guard baja de 20h a HS_MIN_PREPARACION: los toques
    // de preparación son lo que baja el no-show y no son prospección fría.
    if (prep.has(r.lead_id) && r.created_at && r.created_at < desdeCorto) continue;
    set.add(r.lead_id);
  }
  for (const r of (bcast.data ?? []) as Array<{ lead_id: number }>) set.add(r.lead_id);
  return set;
}

export type ResultadoProceso = {
  saltado?: string;
  enviados: number;
  simulados: number;
  omitidos: number;
  esperando: number;
  borradores: number;
  fallos: number;
  detalle: Array<{ lead_id: number; canal: string; estado: string; nota?: string }>;
};

// Procesa los envíos vencidos con rate-limiting anti-baneo: ventana horaria,
// tope diario (24h móviles), tope por corrida y guard de 20h por lead.
// El envío REAL de cada canal se decide por workspace (envio-flags):
//   · canal habilitado  → envío real (WhatsApp exige template aprobado).
//   · canal apagado     → el paso ESPERA: reintento en 24h, sin enviar ni
//     avanzar. Antes se marcaba 'omitido' y avanzaba — quemaba la cadencia si
//     el cliente prendía el canal después, sin reinscripción posible por el
//     unique(lead, secuencia) (tarea #5).
//   · opts.simularApagados → los canales apagados se marcan 'simulado' (modo
//     prueba de la máquina, el ?commit=1 histórico).
// Un 'fallo' NO avanza el paso (se reintenta), salvo condición terminal.
export async function procesarEnvios(opts?: { ignorarVentana?: boolean; simularApagados?: boolean; soloLeadId?: number }): Promise<ResultadoProceso> {
  const res: ResultadoProceso = { enviados: 0, simulados: 0, omitidos: 0, esperando: 0, borradores: 0, fallos: 0, detalle: [] };
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
    let q = supabase
      .from('nutricion_inscripciones')
      .select('id, lead_id, secuencia_id, paso_actual')
      .eq('estado', 'activa')
      .lte('proximo_envio_at', ahoraISO());
    // Vía rápida de UN lead (enrolamiento por evento): reusa TODO el motor
    // (anti-ban, audio, borradores, gates) sin esperar la corrida del cron.
    if (opts?.soloLeadId) q = q.eq('lead_id', opts.soloLeadId);
    const { data: dueRaw, error } = await q
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
      .select('id, nombre, telefono, empresa, email, email_opt_out, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at')
      .in('id', leadIds);
    const leadMap = new Map(
      ((leadsData ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null; empresa: string | null; email: string | null; email_opt_out: boolean | null } & JuntasLead>).map((l) => [l.id, l]),
    );
    // Ventana anti-baneo de 20h resuelta en batch (no 2 counts por lead en el loop).
    const conEnvioReciente = await leadsConEnvioReciente(leadIds);
    // Quién ya recibió algo alguna vez → decide cuál de los dos pasos de
    // apertura sale (presentarse o retomar). También en batch.
    const yaContactados = await leadsYaContactados(leadIds);

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

      const lead = leadMap.get(insc.lead_id);

      // Pasos ANCLADOS a la reunión (#18): la agenda se re-valida AL MOMENTO de
      // enviar, no solo al programar. (1) Sin reunión futura → la inscripción se
      // cierra sin enviar (un recordatorio tardío es peor que ninguno). (2) Si el
      // objetivo re-calculado quedó en el futuro (reagenda, drift por espera de
      // canal), el paso se re-ancla y espera su hora.
      if (paso.ancla === 'reunion') {
        if (reunionFuturaMs(lead) == null) {
          res.omitidos += 1;
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: 'la reunión ya pasó' });
          await supabase.from('nutricion_inscripciones')
            .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() }).eq('id', insc.id);
          continue;
        }
        const objetivo = proximoEnvioDePaso(paso, lead);
        if (Date.parse(objetivo) > Date.now() + 5 * 60 * 1000) {
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 're-anclado a la reunión' });
          await supabase.from('nutricion_inscripciones')
            .update({ proximo_envio_at: objetivo, updated_at: ahoraISO() }).eq('id', insc.id);
          continue;
        }
      }

      // Los dos pasos de APERTURA de la secuencia post-agenda son mutuamente
      // excluyentes: uno se presenta (nunca le hablamos) y el otro retoma la
      // conversación (ya recibió la bienvenida). Sale exactamente uno; el otro
      // se saltea y la inscripción sigue de largo — a diferencia de
      // `requiere:'respondio'`, acá NO hay nada que esperar: la condición ya
      // está decidida y no va a cambiar.
      if (paso.requiere === 'ya_contactado' || paso.requiere === 'primer_contacto') {
        const yaLeHablamos = yaContactados.has(insc.lead_id);
        const corresponde = paso.requiere === 'ya_contactado' ? yaLeHablamos : !yaLeHablamos;
        if (!corresponde) {
          const siguiente = insc.paso_actual + 1;
          await supabase.from('nutricion_inscripciones').update(
            siguiente < sec.pasos.length
              ? { paso_actual: siguiente, proximo_envio_at: proximoEnvioDePaso(sec.pasos[siguiente], lead), updated_at: ahoraISO() }
              : { estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() },
          ).eq('id', insc.id);
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: paso.requiere === 'ya_contactado' ? 'es primer contacto' : 'ya le habíamos escrito' });
          continue;
        }
      }

      // Paso condicional que espera una respuesta que todavía no llegó: se
      // saltea (la inscripción sigue activa; si el lead contesta, el destrabe de
      // pausarPorRespuesta lo trae de vuelta).
      if (paso.requiere === 'respondio') {
        const siguienteLibre = sec.pasos.findIndex((p, i) => i > insc.paso_actual && p.requiere !== 'respondio');
        await supabase.from('nutricion_inscripciones').update(
          siguienteLibre >= 0
            ? { paso_actual: siguienteLibre, proximo_envio_at: proximoEnvioDePaso(sec.pasos[siguienteLibre], lead), updated_at: ahoraISO() }
            : { estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() },
        ).eq('id', insc.id);
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'espera que el lead responda' });
        continue;
      }

      // Copy que sigue con texto de relleno del seed → NUNCA sale automático:
      // espera (reintento 24h) a que MaKo lo escriba y alguien lo apruebe.
      if (!opts?.simularApagados && pasoConRelleno(paso)) {
        res.esperando += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'copy con [relleno] — escríbelo con MaKo' });
        await supabase.from('nutricion_inscripciones')
          .update({ proximo_envio_at: enHorasISO(24), updated_at: ahoraISO() }).eq('id', insc.id);
        continue;
      }

      // ¿El canal de este paso está apagado para el workspace? Si a la secuencia
      // le queda algún paso posterior por un canal PRENDIDO, este paso se marca
      // 'omitido' y la cadencia sigue (el cliente eligió no usar este canal). Si
      // no queda nada enviable, el paso ESPERA (reintento 24h): prender el canal
      // después retoma desde acá, sin quemar la cadencia (tarea #5).
      const canalOn = (p: PasoSecuencia) => (p.canal === 'whatsapp' ? waOn : emailOn);
      const canalApagado = !opts?.simularApagados && !canalOn(paso);
      if (canalApagado && !sec.pasos.slice(insc.paso_actual + 1).some(canalOn)) {
        res.esperando += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: `canal ${paso.canal} apagado` });
        await supabase.from('nutricion_inscripciones')
          .update({ proximo_envio_at: enHorasISO(24), updated_at: ahoraISO() }).eq('id', insc.id);
        continue;
      }

      if (!canalApagado && conEnvioReciente.has(insc.lead_id)) {
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'msg <20h' });
        continue; // no avanzar; se reintenta en otra corrida
      }

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
        // Queda un paso posterior enviable → este se omite y la cadencia sigue.
        estado = 'omitido';
        nota = `canal ${paso.canal} apagado`;
      } else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {
        // Canal EMPRESA (no oficial, Evolution). Regla dura del PDF: a leads
        // CALIENTES nunca automático directo → borrador para el setter; a CLIENTES
        // (ya pagaron, riesgo bajo) → envío automático con anti-ban.
        // Se sortea entre las variantes que MaKo escribió al armar la secuencia.
        // Mandar el MISMO texto palabra por palabra a cientos de personas es el
        // patrón que WhatsApp detecta para restringir un número — y además se
        // lee como un bot. Sortear no cuesta nada; redactar por lead costaría
        // una llamada de IA por mensaje.
        const cuerpoNO = aplicarVariables(textoDelPaso(paso), valoresVariablesLead(lead ?? {}));
        // Paso de NOTA DE VOZ (reunión 31/07): el binario sale de la biblioteca
        // del workspace. Si el audio no está o no se puede bajar, NO degradamos
        // a texto en silencio (mandaría un mensaje que nadie escribió): falla y
        // se reintenta al día siguiente.
        const esAudio = paso.tipo === 'audio' && Number(paso.audio_id) > 0;
        if (!lead?.telefono) {
          estado = 'fallo'; nota = 'lead sin teléfono'; backoffHoras = 24;
        } else if (!evoConectado) {
          estado = 'fallo'; nota = 'WhatsApp de empresa no conectado'; backoffHoras = 24;
        } else if (await estaBloqueado(lead.telefono)) {
          estado = 'omitido'; nota = 'contacto bloqueado'; // no le mandamos por el no oficial
        } else if (esAudio) {
          const audio = await getAudio(Number(paso.audio_id));
          const b64 = audio ? await audioBase64(audio) : null;
          if (!audio || !b64) {
            estado = 'fallo';
            nota = audio ? 'no pude bajar el audio del paso' : 'el audio del paso ya no existe';
            backoffHoras = 24;
          } else if (await esLeadCliente(lead.id)) {
            const r = await enviarAudioYEspejar({ telefono: lead.telefono, base64: b64, mimetype: audio.media_mime, leadId: lead.id });
            estado = r.ok ? 'enviado' : 'fallo';
            if (!r.ok) nota = r.error;
            // PIE DEL AUDIO: el `cuerpo` de un paso de audio se descartaba, así
            // que un audio que dice "te dejo el link abajo" prometía algo que
            // nunca llegaba. Sale como segundo mensaje inmediato, en el mismo
            // toque — no como paso aparte, que el guard anti-ban de 20h frenaría.
            if (r.ok && cuerpoNO.trim()) {
              await enviarYEspejar({ telefono: lead.telefono, texto: cuerpoNO, leadId: lead.id })
                .catch(() => { /* el audio ya salió: el pie es un extra, no puede tumbar el envío */ });
            }
          } else if (await tieneBorradorNutriPendiente(lead.id)) {
            res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'borrador pendiente' });
            await supabase.from('nutricion_inscripciones')
              .update({ proximo_envio_at: enHorasISO(6), updated_at: ahoraISO() }).eq('id', insc.id);
            continue;
          } else {
            // Lead caliente → el audio también pasa por el setter: queda como
            // borrador con la transcripción para que sepa qué se manda.
            await crearBorrador({
              leadId: lead.id, telefono: lead.telefono,
              texto: `🎙 Nota de voz: «${audio.titulo}»${audio.transcript ? `\n\n${audio.transcript}` : ''}`,
              origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id,
            });
            estado = 'borrador';
          }
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
          // Guard de aprobación: si la plantilla es NUESTRA (borrador de la app)
          // pero Meta aún no la aprobó (pending) o la rechazó, NO la mandamos.
          // Si la mandáramos, Chatwoot acepta el POST y Meta la rechaza async →
          // quedaría contada como 'enviado' sin llegar nunca. Plantillas legacy
          // sin borrador en la app (estadoDraftPorNombre=null) NO se bloquean.
          // FALLA CERRADO: si no podemos verificar el estado (error de DB), NO
          // enviamos (backoff corto) en vez de arriesgar el phantom-send.
          let bloqueo: { nota: string; horas: number } | null = null;
          try {
            const stTpl = await estadoDraftPorNombre(paso.template_wa, paso.template_idioma ?? 'es_MX');
            if (stTpl && stTpl !== 'approved') {
              bloqueo = stTpl === 'rejected'
                ? { nota: 'plantilla rechazada por Meta', horas: 24 }               // permanente hasta re-editar
                : { nota: 'plantilla aún no aprobada por Meta', horas: 1 };          // Meta aprueba en minutos → recheck en 1h
            }
          } catch {
            bloqueo = { nota: 'no pude verificar el estado de la plantilla', horas: 1 }; // fail-closed transitorio
          }
          if (bloqueo) {
            estado = 'fallo';
            nota = bloqueo.nota;
            backoffHoras = bloqueo.horas;
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
          nota = 'remitente sandbox: verifica tu dominio de envío';
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
          proximo_envio_at: siguiente ? proximoEnvioDePaso(siguiente, lead) : null,
          estado: siguiente ? 'activa' : 'completada',
          // El reloj del fallo por silencio se cuenta desde el ÚLTIMO mensaje,
          // no desde que el lead se inscribió: una secuencia con pasos a los 30
          // días se daría por fallida antes de terminar de mandarlos.
          ultimo_paso_at: ahoraISO(),
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

// Pausa la nutrición de un lead cuando responde (webhook de Chatwoot y espejo
// del no oficial). Marca las inscripciones activas como 'respondio'.
//
// MODO ASISTIDO (reunión 31/07): si la secuencia de mensajes que venía corriendo está en modo
// 'asistido', además de pausar se avisa al dueño y MaKo deja un BORRADOR con la
// respuesta sugerida para aprobar con un clic. Es la fase 1 acordada: se
// automatizan los primeros audios y la conversación la sigue un humano.
export async function pausarPorRespuesta(leadId: number, opts?: { texto?: string }): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .update({ estado: 'respondio', proximo_envio_at: null, updated_at: ahoraISO() })
    .eq('lead_id', leadId)
    .eq('estado', 'activa')
    .select('id, secuencia_id');
  if (error) throw new Error(`pausarPorRespuesta: ${error.message}`);
  const pausadas = (data ?? []) as Array<{ id: number; secuencia_id: number }>;

  // PASOS CONDICIONALES (reunión 31/07): un paso con requiere='respondio' está
  // esperando justamente esto — el caso del lead magnet ("¿lo querés? es gratis"
  // y recién si contesta se manda). La respuesta lo DESTRABA: la inscripción
  // vuelve a 'activa' apuntando a ese paso, en vez de quedar pausada para
  // siempre. Los demás pasos condicionales se saltean al llegar el turno.
  if (pausadas.length) {
    try {
      const secs = await getSecuenciasActivas();
      const { data: detalle } = await supabase
        .from('nutricion_inscripciones')
        .select('id, secuencia_id, paso_actual')
        .in('id', pausadas.map((p) => p.id));
      for (const insc of (detalle ?? []) as Array<{ id: number; secuencia_id: number; paso_actual: number }>) {
        const sec = secs.find((s) => s.id === insc.secuencia_id);
        if (!sec) continue;
        const idx = sec.pasos.findIndex((p, i) => i >= insc.paso_actual && p.requiere === 'respondio');
        if (idx < 0) continue;
        await supabase.from('nutricion_inscripciones').update({
          estado: 'activa',
          paso_actual: idx,
          proximo_envio_at: proximoEnvioDePaso(sec.pasos[idx], null),
          updated_at: ahoraISO(),
        }).eq('id', insc.id);
      }
    } catch (e) { console.error('[nutricion] destrabe de pasos condicionales falló:', e); }
  }

  if (pausadas.length) {
    // Best-effort y en segundo plano conceptual: que un fallo del asistido NUNCA
    // rompa el webhook (el lead ya quedó despausado, que es lo crítico).
    try { await asistirRespuesta(leadId, pausadas.map((p) => p.secuencia_id), opts?.texto); }
    catch (e) { console.error(`[nutricion] modo asistido lead ${leadId} falló:`, e); }
  }
  return pausadas.length;
}

/**
 * Modo asistido: avisa al dueño que el lead respondió y le deja el borrador de
 * respuesta que redactó MaKo con la secuencia de mensajes (mismo cerebro del simulador).
 * Silencioso si ninguna de las secuencias pausadas es 'asistido'.
 */
async function asistirRespuesta(leadId: number, secuenciaIds: number[], texto?: string): Promise<void> {
  const { parseEstrategia } = await import('@/lib/setting-estrategia');
  const secs = await getSecuenciasConStats();
  // La secuencia de mensajes asistida más específica que venía corriendo para este lead.
  const secuencia = secs.find((s) => secuenciaIds.includes(s.id) && parseEstrategia(s.estrategia)?.modo === 'asistido');
  if (!secuencia) return;

  const supabase = await getTenantDb();
  const { data: leadRow } = await supabase.from('leads').select('id, nombre, telefono').eq('id', leadId).maybeSingle();
  const lead = leadRow as { id: number; nombre: string | null; telefono: string | null } | null;

  // 0) HAND-OFF, y va PRIMERO: antes de redactar nada hay que saber si esto es
  //    un caso que la secuencia sabe manejar. Si el lead planteó algo que no
  //    está previsto, MaKo NO contesta — ni siquiera un borrador, porque un
  //    borrador plausible es justo lo que alguien aprueba sin leer.
  const estrategia = parseEstrategia(secuencia.estrategia);
  const { clasificarEscenario, registrarHandoff } = await import('@/lib/chat-agent-handoff');
  const clas = await clasificarEscenario(texto ?? '', estrategia?.escenarios ?? []);
  if (!clas.encaja) {
    // La inscripción queda en 'handoff': ni activa (no puede seguir mandando
    // pasos encima de una conversación que no entiende) ni cerrada (ver el
    // comentario del UNIQUE en lib/chat-agent-handoff.ts).
    await supabase.from('nutricion_inscripciones')
      .update({ estado: 'handoff', proximo_envio_at: null, updated_at: ahoraISO() })
      .eq('lead_id', leadId).eq('secuencia_id', secuencia.id);
    await registrarHandoff({
      leadId, secuenciaId: secuencia.id,
      mensaje: texto?.trim() || '(el lead respondió sin texto)',
      motivo: clas.motivo,
      leadNombre: lead?.nombre, secuenciaNombre: secuencia.nombre,
    });
    return;
  }

  // 1) MaKo redacta la respuesta (import dinámico: setting-simulador importa
  //    este módulo, un import estático cerraría el ciclo).
  let sugerida: string | null = null;
  try {
    const { responderSimulador } = await import('@/lib/setting-simulador');
    const r = await responderSimulador(secuencia.id, [{ de: 'lead', texto: texto?.trim() || '(el lead respondió sin texto)' }]);
    if (r.ok) sugerida = r.respuesta;
  } catch { /* sin sugerencia: igual avisamos */ }

  // 2) Borrador para aprobar con un clic (misma bandeja que el resto).
  if (sugerida && lead?.telefono) {
    const { crearBorrador } = await import('@/lib/evolution-envio');
    await crearBorrador({
      leadId, telefono: lead.telefono, texto: sugerida,
      origen: 'setter-asistido', secuenciaId: secuencia.id, paso: null, inscripcionId: null,
    });
  }

  // 3) ¿Califica? (reunión 31/07: ninguna llamada con no calificados). Si hay
  //    evidencia de descalificación, se marca el lead y se AVISA para cancelar
  //    la reunión — cancelarla sola sería una acción externa irreversible.
  let alertaDescalifica = '';
  try {
    const { evaluarCalificacion } = await import('@/lib/setting-simulador');
    const ev = await evaluarCalificacion(secuencia.id, [{ de: 'lead', texto: texto?.trim() || '' }]);
    if (ev.califica === false) {
      await supabase.from('leads').update({ calificado: false, updated_at: ahoraISO() }).eq('id', leadId);
      const { logLeadEvent } = await import('@/lib/leads');
      await logLeadEvent(leadId, 'Setting', `MaKo lo marcó NO calificado por la charla: ${ev.razon}`, 'MaKo');
      alertaDescalifica = `\n\n⚠️ *No califica* (${ev.razon}). Lo marqué en el CRM. Si tiene reunión agendada, conviene cancelarla — te dejo la decisión a ti.`;
    }
  } catch { /* la calificación es un extra: nunca bloquea el aviso */ }

  // 4) Aviso al dueño — el único que pidió Mauricio: "avisame si responden".
  //
  // El `ws` va EXPLÍCITO. Sin él, emitirAviso cae a OWNER_WS: el lead de un
  // cliente respondía y el aviso le llegaba al grupo de la AGENCIA en vez de al
  // del cliente — que además no se entera de que le contestaron.
  const { emitirDelCatalogo } = await import('@/lib/avisos');
  const quien = lead?.nombre?.trim() || `lead ${leadId}`;
  await emitirDelCatalogo('wa-mensaje-entrante', {
    ws: (await getWorkspaceActual()) ?? undefined,
    texto: `💬 *${quien} respondió* a la secuencia de mensajes «${secuencia.nombre}».${texto?.trim() ? `\n\n_"${texto.trim().slice(0, 180)}"_` : ''}${sugerida ? `\n\nTe dejé un borrador listo para aprobar:\n${sugerida.slice(0, 300)}` : ''}${alertaDescalifica}\n\n— MaKo`,
  });
}
