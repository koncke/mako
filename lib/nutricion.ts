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

import { getSupabaseServer } from '@/lib/supabase';
import { getVslEngagementMap } from '@/lib/leads';

export type CanalNutricion = 'email' | 'whatsapp';

export type PasoSecuencia = {
  orden: number;
  canal: CanalNutricion;
  delay_horas: number;
  asunto: string | null;
  cuerpo: string;
  template_wa: string | null;
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
  const supabase = getSupabaseServer();
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

// ── Cohortes: qué leads dispara cada secuencia ───────────────────────────────
export async function leadsDeCohorte(triggerTipo: string): Promise<number[]> {
  const supabase = getSupabaseServer();
  const desde = haceDiasISO(VENTANA_DIAS);

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

  // trigger desconocido → sin cohorte (no rompe el cron)
  return [];
}

// ── Inscripción ──────────────────────────────────────────────────────────────
export type PlanInscripcion = { secuencia: string; lead_id: number; proximo_envio_at: string };

// Devuelve los leads que se inscribirían (no escribe). Para el dry-run.
export async function planificarInscripciones(): Promise<PlanInscripcion[]> {
  const supabase = getSupabaseServer();
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
  const supabase = getSupabaseServer();
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
  const supabase = getSupabaseServer();
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

// Avanza la máquina de estados de los vencidos SIN enviar de verdad: registra
// el envío como 'simulado' y mueve el paso. Los canales reales (Resend/Chatwoot)
// reemplazan el "simulado" en los hitos 1 y 2.
export async function comprometerEnviosSimulados(): Promise<number> {
  const supabase = getSupabaseServer();
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));
  const due = await inscripcionesVencidas();
  let procesados = 0;

  for (const insc of due) {
    const sec = porId.get(insc.secuencia_id);
    if (!sec) continue;
    const paso = sec.pasos[insc.paso_actual];
    if (!paso) {
      await supabase
        .from('nutricion_inscripciones')
        .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() })
        .eq('id', insc.id);
      continue;
    }

    await supabase.from('nutricion_envios').insert({
      inscripcion_id: insc.id,
      lead_id: insc.lead_id,
      secuencia_id: insc.secuencia_id,
      paso: insc.paso_actual + 1,
      canal: paso.canal,
      estado: 'simulado',
      asunto: paso.asunto,
    });

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
    procesados += 1;
  }
  return procesados;
}

// Pausa la nutrición de un lead cuando responde (lo usará /api/webhooks/chatwoot
// en el hito 2). Marca las inscripciones activas como 'respondio'.
export async function pausarPorRespuesta(leadId: number): Promise<number> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .update({ estado: 'respondio', proximo_envio_at: null, updated_at: ahoraISO() })
    .eq('lead_id', leadId)
    .eq('estado', 'activa')
    .select('id');
  if (error) throw new Error(`pausarPorRespuesta: ${error.message}`);
  return ((data ?? []) as Array<{ id: number }>).length;
}
