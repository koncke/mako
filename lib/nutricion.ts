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
import { sendWhatsappTemplate } from '@/lib/chatwoot';

export type CanalNutricion = 'email' | 'whatsapp';

export type PasoSecuencia = {
  orden: number;
  canal: CanalNutricion;
  delay_horas: number;
  asunto: string | null;
  cuerpo: string;
  template_wa: string | null;                 // nombre del template aprobado (WhatsApp)
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
// El envío REAL por WhatsApp solo ocurre con NUTRICION_SEND_ENABLED=true; si no, se simula.
const SEND_ENABLED = process.env.NUTRICION_SEND_ENABLED === 'true';
const MAX_POR_DIA = Number(process.env.NUTRICION_MAX_POR_DIA ?? '40');        // tope en 24h móviles
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

export type SecuenciaConStats = Secuencia & { inscriptos: number; enviados: number };

// Todas las secuencias (activas y pausadas) + conteo de inscriptos y enviados.
// Para la tab /whatsapp. Dos queries (no N+1): trae los ids y cuenta en JS.
export async function getSecuenciasConStats(): Promise<SecuenciaConStats[]> {
  const supabase = getSupabaseServer();
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
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ activa, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaActiva: ${error.message}`);
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

function haceHorasISO(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function dentroDeVentana(): boolean {
  const hLocal = (new Date().getUTCHours() + TZ_OFFSET_MX + 24) % 24;
  return hLocal >= VENTANA_INICIO && hLocal < VENTANA_FIN;
}

async function enviosUltimas24h(): Promise<number> {
  const supabase = getSupabaseServer();
  const { count, error } = await supabase
    .from('nutricion_envios')
    .select('id', { count: 'exact', head: true })
    .in('estado', ['enviado', 'simulado'])
    .gte('created_at', haceHorasISO(24));
  if (error) throw new Error(`enviosUltimas24h: ${error.message}`);
  return count ?? 0;
}

async function leadTuvoEnvioReciente(leadId: number): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { count } = await supabase
    .from('nutricion_envios')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .in('estado', ['enviado', 'simulado'])
    .gte('created_at', haceHorasISO(HS_MIN_ENTRE_MSGS));
  return (count ?? 0) > 0;
}

export type ResultadoProceso = {
  saltado?: string;
  enviados: number;
  simulados: number;
  fallos: number;
  detalle: Array<{ lead_id: number; canal: string; estado: string; nota?: string }>;
};

// Procesa los envíos vencidos con rate-limiting anti-baneo: ventana horaria,
// tope diario (24h móviles), tope por corrida y guard de 20h por lead. Envía de
// verdad por WhatsApp solo si NUTRICION_SEND_ENABLED=true y el paso tiene
// template aprobado; si no, registra el avance como 'simulado'. Un 'fallo' NO
// avanza el paso (se reintenta en la próxima corrida).
export async function procesarEnvios(opts?: { ignorarVentana?: boolean }): Promise<ResultadoProceso> {
  const res: ResultadoProceso = { enviados: 0, simulados: 0, fallos: 0, detalle: [] };

  if (!opts?.ignorarVentana && !dentroDeVentana()) {
    return { ...res, saltado: 'fuera-de-ventana-horaria' };
  }
  const presupuesto = MAX_POR_DIA - (await enviosUltimas24h());
  if (presupuesto <= 0) return { ...res, saltado: 'tope-diario' };
  const cupo = Math.min(MAX_POR_CORRIDA, presupuesto);

  const supabase = getSupabaseServer();
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));

  // Traemos más de `cupo` por si algunos se saltan por el guard por-lead.
  const { data: dueRaw, error } = await supabase
    .from('nutricion_inscripciones')
    .select('id, lead_id, secuencia_id, paso_actual')
    .eq('estado', 'activa')
    .lte('proximo_envio_at', ahoraISO())
    .order('proximo_envio_at', { ascending: true })
    .limit(cupo * 3);
  if (error) throw new Error(`procesarEnvios: ${error.message}`);
  const due = (dueRaw ?? []) as Array<{ id: number; lead_id: number; secuencia_id: number; paso_actual: number }>;
  if (due.length === 0) return res;

  const leadIds = [...new Set(due.map((d) => d.lead_id))];
  const { data: leadsData } = await supabase
    .from('leads')
    .select('id, nombre, telefono')
    .in('id', leadIds);
  const leadMap = new Map(
    ((leadsData ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null }>).map((l) => [l.id, l]),
  );

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

    if (await leadTuvoEnvioReciente(insc.lead_id)) {
      res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'msg <20h' });
      continue; // no avanzar; se reintenta en otra corrida
    }

    const lead = leadMap.get(insc.lead_id);
    let estado: 'enviado' | 'simulado' | 'fallo' = 'simulado';
    let nota: string | undefined;

    if (SEND_ENABLED && paso.canal === 'whatsapp') {
      if (!lead?.telefono) {
        estado = 'fallo';
        nota = 'lead sin teléfono';
      } else if (!paso.template_wa) {
        estado = 'fallo';
        nota = 'paso sin template_wa';
      } else {
        const r = await sendWhatsappTemplate({
          phone: lead.telefono,
          name: lead.nombre ?? '',
          content: paso.cuerpo,
          template: {
            name: paso.template_wa,
            category: paso.template_categoria ?? 'marketing',
            language: paso.template_idioma ?? 'es_MX',
            bodyParams: { [paso.template_param ?? 'nombre']: lead.nombre ?? '' },
          },
        });
        estado = r.ok ? 'enviado' : 'fallo';
        if (!r.ok) nota = r.error;
      }
    }
    // email → 'simulado' hasta el hito de Resend.

    await supabase.from('nutricion_envios').insert({
      inscripcion_id: insc.id,
      lead_id: insc.lead_id,
      secuencia_id: insc.secuencia_id,
      paso: insc.paso_actual + 1,
      canal: paso.canal,
      estado,
      destino: paso.canal === 'whatsapp' ? lead?.telefono ?? null : null,
      asunto: paso.asunto,
    });

    if (estado === 'fallo') {
      res.fallos += 1;
      res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado, nota });
      continue; // no avanzar el paso; se reintenta
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
    else res.simulados += 1;
    res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado });
  }

  return res;
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
