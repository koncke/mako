// =============================================================================
// Leads — types, queries y server actions
// =============================================================================
// Tabla `leads` ya creada en Fase 1. Esta capa concentra TODO el acceso al
// modelo: get, create, update, validaciones lógicas.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';
import { sendMetaCAPIEvent } from './meta-capi';
import type { Stage, FunnelTransition } from './pipeline';
import { DEFAULT_PIPELINE, generateFunnel, terminalEstadoFor, NUTRI_KEYS, deriveStageKey } from './pipeline';
import { stepsForStage, funnelReqInfo, type Step } from './stage-requirements';
import { hoyEnTijuana } from './date-utils';
import { cachedRead, TAG, TTL } from './cache';
import { actualizarEtiquetaLead } from './evolution-labels';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// Desenlace explícito del lead (Fase 8). Fuente de verdad del resultado:
//   - abierto:        en proceso, sin desenlace todavía
//   - ganado:         cerró (equivale a cerro=true)
//   - perdido:        lo trabajamos y no compró (cerro=false)
//   - descalificado:  no era buen fit (cerro=false)
// `cerro` se mantiene en sync (lo derivan las queries de Revenue).
export type EstadoLead = 'abierto' | 'ganado' | 'perdido' | 'descalificado' | 'no_responde';

export type Lead = {
  id: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;

  fecha_agenda: string | null;        // YYYY-MM-DD
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  junta_1_at: string | null;          // ISO con hora (Calendly start_time) — precisión del No Show
  junta_2_at: string | null;

  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  calificado: boolean | null;
  cerro: boolean | null;

  // Desenlace explícito (Fase 8) — coherente con `cerro`
  estado_lead: EstadoLead;
  motivo_perdida: string | null;      // solo aplica a perdido/descalificado

  monto_cierre_usd: number | null;
  fecha_cierre: string | null;

  // Confirmación verbal entre J2 y primer pago (opcional, para medir SCL)
  fecha_confirmacion: string | null;

  // Cobranza — ortogonal a cierre. Cierre = vendido. Estos = cobrado.
  // total_cobrado_usd y fecha_primer_pago se DERIVAN de los pagos (Fase 8-bis).
  fecha_primer_pago: string | null;
  monto_primer_pago: number | null;
  total_cobrado_usd: number | null;
  fecha_inicio_servicio: string | null;

  // Plan de pagos (Fase 8-bis) — genera las filas de `pagos`
  cobro_inicial_usd: number | null;
  monto_cuota_usd: number | null;
  total_cuotas: number | null;    // 1..6
  dia_de_pago: number | null;     // 1..28

  // Venta recurrente / suscripción (#363, mig 0115). 'unico' = pago único (default).
  venta_tipo?: 'unico' | 'suscripcion' | null;
  suscripcion_monto_usd?: number | null;   // importe MENSUAL (MRR)
  suscripcion_meses?: number | null;        // plazo fijo en meses; null = indefinida

  adset_id_origen: string | null;

  // UTMs — vienen del webhook de Calendly (vía landing en Lovable)
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;

  // Respuestas del formulario Calendly (calificación previa a J1)
  respuesta_facturacion: string | null;
  respuesta_colaboradores: string | null;
  respuesta_objetivo: string | null;
  respuesta_cuando_empezar: string | null;
  respuesta_inversion: string | null;   // Q3 (Fase B v3)
  respuesta_decisor: string | null;      // Q6 (Fase B v3)

  // Meta Lead Ads (instant form) — atribución del anuncio de origen
  meta_lead_id: string | null;
  meta_ad_id: string | null;
  meta_ad_name: string | null;
  meta_campaign_name: string | null;
  meta_adset_name: string | null;
  origen_lead: string | null;            // 'instant_form' | 'calendly' | null
  telefono_normalizado: string | null;   // solo dígitos — llave de match

  // UUID anónimo de la landing (cookie nqe_visitor_id, llega como utm_term).
  // Cruza con vsl_events para saber si el lead vio el VSL.
  visitor_id: string | null;

  // Nutrición (v3 Fase G): true si se corrió la serie WhatsApp+email de 7 días
  // sobre un form que no agendó.
  nutricion_realizada: boolean;

  // Rediseño CRM (migración 0020) — opcionales por compatibilidad si la
  // migración aún no se aplicó.
  pipeline_stage?: string | null;   // override manual de la columna del Kanban
  closer?: string | null;           // closer asignado (Datos comerciales)
  setter?: string | null;           // setter asignado (Nutrición - Manual)
  fathom_links?: FathomLink[] | null;
  nutricion_manual_deadline?: string | null;   // deadline de la nutrición manual (migración 0044)

  // Excepciones declaradas (migración 0064): eximen requisitos de etapa de
  // forma PERSISTENTE (antes solo quedaban como eventos y se volvían a exigir).
  sin_r1?: boolean | null;          // cierre sin Reunión 1
  sin_r2?: boolean | null;          // cierre sin Reunión 2
  fathom_omitido?: boolean | null;  // la reunión no se grabó

  // Omisiones/excepciones del wizard "Solucionar" (migración 0069).
  deal_fiscal_doc_omitido?: boolean | null;  // no se sube el documento fiscal del cliente
  comprobante_omitido?: boolean | null;      // no se suben los comprobantes de pago
  empresa_omitido?: boolean | null;          // "Empresa" ignorada: no cuenta en el worklist del CRM
  pendientes_ignorados?: string | null;      // "Datos sin marcar" ignorados a nivel lead (mig 0109): no notifican ni cuentan; timestamp de cuándo se ignoró
  r2_agenda_externa_motivo?: string | null;  // la R2 se agendó fuera de Calendly (motivo) → satisface respuestas R2

  // Contrato subido (migración 0029): archivo en Storage + nombre original.
  contrato_nombre?: string | null;
  contrato_path?: string | null;

  // Deal Details (migración 0060): secciones extraídas del contrato por IA
  // (resumen en lenguaje simple, editable) + identidad fiscal propia elegida.
  deal_fiscal?: { razon?: string | null; id_fiscal?: string | null; domicilio?: string | null; correo?: string | null; doc_path?: string | null; doc_nombre?: string | null } | null;
  deal_servicio?: { que_es?: string | null; fecha_inicio?: string | null; fecha_termino?: string | null; duracion?: string | null; frecuencia?: string | null; modalidad?: string | null; sesiones?: string | null } | null;
  deal_promesa?: { resultado?: string | null; garantia?: string | null } | null;
  deal_obligaciones?: { cliente?: string[]; prestador?: string[] } | null;
  facturado_por_id?: number | null;

  created_at: string;
  updated_at: string;
};

export type FathomLink = { label: string; url: string };

export type LeadCreateInput = {
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;
  fecha_agenda?: string | null;
  fecha_junta_1?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  respuesta_facturacion?: string | null;
  respuesta_colaboradores?: string | null;
  respuesta_objetivo?: string | null;
  respuesta_cuando_empezar?: string | null;
  respuesta_inversion?: string | null;
  respuesta_decisor?: string | null;
  meta_lead_id?: string | null;
  meta_ad_id?: string | null;
  meta_ad_name?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  origen_lead?: string | null;
  telefono_normalizado?: string | null;
  visitor_id?: string | null;
};

export type LeadUpdateInput = {
  // Identificación / contacto
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;

  // Comercial
  fecha_agenda?: string | null;
  fecha_junta_1?: string | null;
  fecha_junta_2?: string | null;
  asistio_j1?: boolean | null;
  asistio_j2?: boolean | null;
  calificado?: boolean | null;
  cerro?: boolean | null;

  // Desenlace (Fase 8). Si viene estado_lead, manda él y deriva cerro.
  estado_lead?: EstadoLead;
  motivo_perdida?: string | null;

  // Nutrición (v3 Fase G)
  nutricion_realizada?: boolean;

  monto_cierre_usd?: number | null;
  fecha_cierre?: string | null;

  // Confirmación verbal entre J2 y primer pago
  fecha_confirmacion?: string | null;

  // Cobranza
  fecha_primer_pago?: string | null;
  monto_primer_pago?: number | null;
  total_cobrado_usd?: number | null;
  fecha_inicio_servicio?: string | null;
};

export type EstadoMadurez = 'madura' | 'madurando' | 'reciente' | 'sin_j1';

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los leads ordenados por created_at desc (más nuevos primero).
 */
// Solo las columnas que consume el CRM (mapToCrmLead + pipelineStageOf +
// origenLegible + calendlyDe). Antes traía select('*') (~50 cols, incl. payloads
// crudos y campos de cobranza que el board no usa).
const LISTA_COLS =
  'id, nombre, email, empresa, telefono, telefono_normalizado, created_at, estado_lead, pipeline_stage, nutricion_realizada, nutricion_manual_deadline, ' +
  'fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, calificado, fecha_confirmacion, fecha_primer_pago, fecha_cierre, ' +
  'monto_cierre_usd, total_cobrado_usd, closer, setter, fathom_links, motivo_perdida, visitor_id, ' +
  'venta_tipo, suscripcion_monto_usd, suscripcion_meses, ' +
  'meta_ad_name, meta_campaign_name, meta_lead_id, meta_ad_id, utm_campaign, ' +
  'respuesta_objetivo, respuesta_facturacion, respuesta_colaboradores, respuesta_cuando_empezar, respuesta_inversion, respuesta_decisor';

export const listLeads = cachedRead('listLeads', _listLeads, { tags: [TAG.leads], revalidate: TTL.user });
async function _listLeads(): Promise<Lead[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select(LISTA_COLS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Error listando leads: ${error.message}`);
  return (data ?? []) as unknown as Lead[];
}

/**
 * Obtiene UN lead por su id.
 */
export async function getLead(id: number): Promise<Lead | null> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Error obteniendo lead ${id}: ${error.message}`);
  return data as Lead | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un lead nuevo. Solo requiere nombre.
 */
export async function createLead(input: LeadCreateInput): Promise<Lead> {
  if (!input.nombre || !input.nombre.trim()) {
    throw new Error('Nombre es requerido');
  }
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .insert({
      nombre: input.nombre.trim(),
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
      // Sin esto el lead manual nunca matchea su chat de WhatsApp ni el
      // instant form / Calendly (la llave de match es telefono_normalizado).
      telefono_normalizado: normalizarTelefono(input.telefono),
      empresa: input.empresa?.trim() || null,
      fecha_agenda: input.fecha_agenda || null,
      fecha_junta_1: input.fecha_junta_1 || null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Error creando lead: ${error.message}`);
  return data as Lead;
}

/**
 * Actualiza un lead con validaciones lógicas.
 *
 * Reglas:
 * - Si fecha_junta_1 es null → asistio_j1 y calificado se fuerzan a null.
 * - Si asistio_j1 != true → calificado se fuerza a null (no aplica).
 * - Si cerro != true → monto_cierre_usd y fecha_cierre se fuerzan a null.
 * - Si cerro = true sin monto → error.
 */
export async function updateLead(
  id: number,
  input: LeadUpdateInput,
): Promise<Lead> {
  const supabase = (await getTenantDb());

  // Trae el lead actual para mergear estado y validar transiciones
  const actual = await getLead(id);
  if (!actual) throw new Error(`Lead ${id} no existe`);

  // Estado fusionado: lo que viene del input gana, lo demás se mantiene
  const merged = { ...actual, ...input };

  // ───────────────────────────────────────────────────────────────────
  // Sincronización estado_lead <-> cerro (Fase 8)
  // ───────────────────────────────────────────────────────────────────
  // estado_lead es la fuente de verdad del desenlace; cerro se deriva para no
  // romper las queries de Revenue que todavía leen cerro.
  //   ganado        -> cerro = true
  //   perdido/descal -> cerro = false
  //   abierto       -> cerro = null
  // Si el caller NO mandó estado_lead pero sí cerro (compat con flujos viejos),
  // derivamos el estado desde cerro.
  if (input.estado_lead !== undefined) {
    if (merged.estado_lead === 'ganado') merged.cerro = true;
    // perdido / descalificado / no_responde: desenlaces que NO cerraron venta.
    else if (
      merged.estado_lead === 'perdido' ||
      merged.estado_lead === 'descalificado' ||
      merged.estado_lead === 'no_responde'
    )
      merged.cerro = false;
    else merged.cerro = null; // abierto
  } else if (input.cerro !== undefined) {
    if (merged.cerro === true) merged.estado_lead = 'ganado';
    else if (merged.cerro === false) {
      // cerro=false puede ser perdido o descalificado; conservamos descalificado
      // si ya estaba, si no, default perdido.
      merged.estado_lead = actual.estado_lead === 'descalificado' ? 'descalificado' : 'perdido';
    } else merged.estado_lead = 'abierto';
  }
  // motivo solo tiene sentido en perdido/descalificado
  if (merged.estado_lead !== 'perdido' && merged.estado_lead !== 'descalificado') {
    merged.motivo_perdida = null;
  }

  // Aplicar reglas de coherencia
  if (!merged.fecha_junta_1) {
    merged.asistio_j1 = null;
    merged.calificado = null;
  }
  if (merged.asistio_j1 !== true) {
    merged.calificado = null;
  }
  if (merged.cerro !== true) {
    merged.monto_cierre_usd = null;
    merged.fecha_cierre = null;
  } else {
    // cerro = true. Monto OPCIONAL (se puede definir luego con el plan de pagos).
    // Así mover una card a "Ganado" siempre sincroniza el estado; antes, sin
    // monto, lanzaba error y la card quedaba en Ganado con estado != ganado.
    if (merged.monto_cierre_usd != null && merged.monto_cierre_usd <= 0) {
      throw new Error('monto_cierre_usd debe ser positivo');
    }
    // fecha_cierre opcional pero recomendada — si no viene, usar fecha actual
    if (!merged.fecha_cierre) {
      const hoy = new Date().toISOString().slice(0, 10);
      merged.fecha_cierre = hoy;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Detección de transiciones para Meta CAPI (Prompts 7 y 8 del mentor)
  // ───────────────────────────────────────────────────────────────────
  // Lead         — calificado pasa a true (no lo era antes)
  // QualifiedLead — asistio_j1=true Y calificado=true ambos juntos, no lo eran antes
  // Se detectan ANTES del save (usando actual vs merged ya validado) y se
  // disparan DESPUÉS del save exitoso. CAPI nunca rompe el flujo.
  // ───────────────────────────────────────────────────────────────────
  const fireLeadEvent =
    actual.calificado !== true && merged.calificado === true;
  const fireQualifiedLeadEvent =
    !(actual.asistio_j1 === true && actual.calificado === true) &&
    merged.asistio_j1 === true && merged.calificado === true;

  // Solo enviamos los campos editables (no id, created_at, updated_at)
  const payload = {
    nombre: merged.nombre,
    email: merged.email,
    telefono: merged.telefono,
    // Si el caller editó el teléfono, recalculamos su forma normalizada (llave de
    // match de webhooks Calendly/Meta/Chatwoot). Sin esto, editar el teléfono a
    // mano dejaba la llave vieja y el próximo webhook creaba un lead duplicado.
    ...(input.telefono !== undefined ? { telefono_normalizado: normalizarTelefono(merged.telefono) } : {}),
    empresa: merged.empresa,
    fecha_agenda: merged.fecha_agenda,
    fecha_junta_1: merged.fecha_junta_1,
    fecha_junta_2: merged.fecha_junta_2,
    asistio_j1: merged.asistio_j1,
    asistio_j2: merged.asistio_j2,
    calificado: merged.calificado,
    cerro: merged.cerro,
    estado_lead: merged.estado_lead,
    motivo_perdida: merged.motivo_perdida,
    nutricion_realizada: merged.nutricion_realizada,
    monto_cierre_usd: merged.monto_cierre_usd,
    fecha_cierre: merged.fecha_cierre,
    fecha_confirmacion: merged.fecha_confirmacion,
    fecha_primer_pago: merged.fecha_primer_pago,
    monto_primer_pago: merged.monto_primer_pago,
    total_cobrado_usd: merged.total_cobrado_usd,
    fecha_inicio_servicio: merged.fecha_inicio_servicio,
  };

  const { data, error } = await supabase
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Error actualizando lead ${id}: ${error.message}`);

  // ───────────────────────────────────────────────────────────────────
  // Disparar eventos CAPI POST-save (con guardia defensiva extra)
  // ───────────────────────────────────────────────────────────────────
  if (fireLeadEvent) {
    try {
      await sendMetaCAPIEvent({
        eventName: 'Lead',
        email: merged.email,
        phone: merged.telefono,
        customData: { lead_type: 'calificado' },
      });
    } catch (err) {
      console.error('[updateLead] error firing Lead CAPI event:', err);
    }
  }

  if (fireQualifiedLeadEvent) {
    try {
      await sendMetaCAPIEvent({
        eventName: 'QualifiedLead',
        email: merged.email,
        phone: merged.telefono,
        customData: { lead_type: 'j1_limpia', value: 1 },
      });
    } catch (err) {
      console.error('[updateLead] error firing QualifiedLead CAPI event:', err);
    }
  }

  // Auto-etiqueta de WhatsApp: si cambió la etapa derivada del lead, ajustamos la
  // etiqueta en el número (best-effort, no bloquea). Solo si hay mapeo configurado.
  void actualizarEtiquetaLead(id).catch(() => {});

  return data as Lead;
}

/**
 * Borra un lead. Hard delete — no hay soft delete en el esquema actual.
 */
export async function deleteLead(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw new Error(`Error borrando lead ${id}: ${error.message}`);
}

/**
 * Normaliza un teléfono a solo dígitos (sin +, espacios, guiones, paréntesis).
 * Llave de match entre instant form (Meta) y Calendly.
 * @returns null si no quedan dígitos.
 */
export function normalizarTelefono(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  return digits || null;
}

/**
 * Upsert desde Meta Lead Ads (instant form) — hermana de upsertLeadFromCalendly.
 *
 * Match por teléfono O email: una persona puede usar un email en el instant
 * form y otro al agendar en Calendly. El teléfono del instant form está
 * verificado por SMS — es la llave más confiable.
 *
 * Reglas:
 * - Idempotente por meta_lead_id: si ya existe un lead con ese leadgen_id,
 *   es un reintento del webhook → retorna el existente sin tocar nada.
 * - Si matchea lead existente (tel O email): actualiza SOLO campos de Meta +
 *   origen_lead. Completa nombre/telefono/empresa solo si estaban vacíos.
 *   NUNCA toca campos manuales (asistio_j1, calificado, cerro, montos, cobranza).
 * - Si no existe: crea con origen_lead='instant_form'. fecha_agenda y
 *   fecha_junta_1 quedan NULL — las completa Calendly cuando agende.
 */
export async function upsertLeadFromMeta(input: {
  email: string | null;
  nombre: string;
  telefono?: string | null;
  empresa?: string | null;
  meta_lead_id: string;
  meta_ad_id?: string | null;
  meta_ad_name?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
}): Promise<{ created: boolean; lead: Lead }> {
  if (!input.meta_lead_id) {
    throw new Error('meta_lead_id es requerido');
  }
  if (!input.nombre || !input.nombre.trim()) {
    throw new Error('Nombre es requerido en lead de Meta');
  }

  const supabase = (await getTenantDb());

  // 1) Idempotencia: ¿ya procesamos este leadgen_id? (reintento de Meta)
  const { data: porLeadId, error: leadIdErr } = await supabase
    .from('leads')
    .select('*')
    .eq('meta_lead_id', input.meta_lead_id)
    .maybeSingle();
  if (leadIdErr) throw new Error(`Error buscando por meta_lead_id: ${leadIdErr.message}`);
  if (porLeadId) {
    return { created: false, lead: porLeadId as Lead };
  }

  // 2) Normalizar señales de identidad
  const emailNorm = input.email?.trim().toLowerCase() || null;
  const telNorm = normalizarTelefono(input.telefono);

  // 3) Buscar existente por teléfono O email
  let existing: Lead | null = null;
  if (telNorm) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('telefono_normalizado', telNorm)
      .maybeSingle();
    if (error) throw new Error(`Error buscando por teléfono: ${error.message}`);
    existing = (data as Lead | null) ?? null;
  }
  if (!existing && emailNorm) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('email', emailNorm)
      .maybeSingle();
    if (error) throw new Error(`Error buscando por email: ${error.message}`);
    existing = (data as Lead | null) ?? null;
  }

  // Campos de Meta — siempre se escriben (es info nueva de atribución)
  const metaFields = {
    meta_lead_id: input.meta_lead_id,
    meta_ad_id: input.meta_ad_id ?? null,
    meta_ad_name: input.meta_ad_name ?? null,
    meta_campaign_name: input.meta_campaign_name ?? null,
    meta_adset_name: input.meta_adset_name ?? null,
    origen_lead: 'instant_form',
  };

  if (existing) {
    // Completar contacto solo si estaba vacío — no pisar datos existentes
    const fillIfEmpty: Record<string, string> = {};
    if (!existing.nombre?.trim() && input.nombre.trim()) {
      fillIfEmpty.nombre = input.nombre.trim();
    }
    if (!existing.email && emailNorm) fillIfEmpty.email = emailNorm;
    if (!existing.telefono && input.telefono?.trim()) {
      fillIfEmpty.telefono = input.telefono.trim();
    }
    if (!existing.empresa && input.empresa?.trim()) {
      fillIfEmpty.empresa = input.empresa.trim();
    }
    if (!existing.telefono_normalizado && telNorm) {
      fillIfEmpty.telefono_normalizado = telNorm;
    }

    const { data, error } = await supabase
      .from('leads')
      .update({ ...metaFields, ...fillIfEmpty })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`Error actualizando lead ${existing.id} desde Meta: ${error.message}`);
    return { created: false, lead: data as Lead };
  }

  // INSERT nuevo — fechas de agenda/J1 NULL (las pone Calendly al agendar)
  const { data, error } = await supabase
    .from('leads')
    .insert({
      nombre: input.nombre.trim(),
      email: emailNorm,
      telefono: input.telefono?.trim() || null,
      empresa: input.empresa?.trim() || null,
      telefono_normalizado: telNorm,
      ...metaFields,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Error creando lead desde Meta: ${error.message}`);
  return { created: true, lead: data as Lead };
}

/**
 * Busca un lead por teléfono normalizado O email — misma lógica de match que
 * upsertLeadFromMeta. Usado por el ruteo de J2 y las cancelaciones (Fase 10).
 */
export async function findLeadByContacto(
  email: string | null,
  telefono: string | null,
): Promise<Lead | null> {
  const supabase = (await getTenantDb());
  const telNorm = normalizarTelefono(telefono);
  if (telNorm) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('telefono_normalizado', telNorm)
      .maybeSingle();
    if (error) throw new Error(`Error buscando lead por teléfono: ${error.message}`);
    if (data) return data as Lead;
  }
  const emailNorm = email?.trim().toLowerCase();
  if (emailNorm) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('email', emailNorm)
      .maybeSingle();
    if (error) throw new Error(`Error buscando lead por email: ${error.message}`);
    if (data) return data as Lead;
  }
  return null;
}

/**
 * Setea SOLO fecha_junta_2 en un lead (J2 entrante de Calendly, Fase 10).
 * Nunca toca otros campos.
 */
export async function setFechaJunta2(leadId: number, fechaJ2: string, juntaAtIso?: string | null): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase
    .from('leads')
    .update({ fecha_junta_2: fechaJ2, ...(juntaAtIso ? { junta_2_at: juntaAtIso } : {}) })
    .eq('id', leadId);
  if (error) throw new Error(`Error seteando fecha_junta_2 en lead ${leadId}: ${error.message}`);
}

/**
 * Marca una reunión (R1/R2) a mano, SIN Calendly — para casos viejos donde la
 * reunión ya ocurrió. Setea la fecha (+ asistencia si se sabe) y limpia el
 * override de etapa para que el lead avance por derivación (p.ej. R2 asistida → Facturando).
 */
export async function setMeetingManual(leadId: number, which: 'agenda' | 'agendaj2', fecha: string, asistio: boolean | null): Promise<void> {
  // La fecha + asistencia pasan por updateLead para respetar invariantes y
  // disparar Meta CAPI (Lead/QualifiedLead) igual que cualquier edición humana.
  // Antes era un UPDATE directo que bypaseaba el CAPI.
  const input: LeadUpdateInput = {};
  if (which === 'agenda') { input.fecha_junta_1 = fecha; if (asistio != null) input.asistio_j1 = asistio; }
  else { input.fecha_junta_2 = fecha; if (asistio != null) input.asistio_j2 = asistio; }
  // Esta función solo se invoca desde flujos de MOVIMIENTO (Kanban/worklist):
  // si el lead estaba en un desenlace terminal (p.ej. Ganado) hay que REABRIRLO,
  // si no la derivación lo devuelve a la columna terminal y el movimiento "no
  // hace nada" (bug: Ganado → R2 no cambiaba el status).
  const actual = await getLead(leadId);
  if (actual && actual.estado_lead !== 'abierto') input.estado_lead = 'abierto';
  await updateLead(leadId, input);
  // Limpiar el override para que el lead avance por derivación (p.ej. R2 asistida
  // → Facturando). No lo toca updateLead (pipeline_stage no es campo editable ahí).
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('leads').update({ pipeline_stage: null }).eq('id', leadId);
  if (error) throw new Error(`Error limpiando override del lead ${leadId}: ${error.message}`);
}

/**
 * Aplica una grabación de Fathom a un lead: marca asistencia a R1/R2 (solo si
 * estaba sin marcar — nunca pisa una decisión humana) y agrega el link de la
 * grabación a fathom_links. `attended` puede venir confirmado por el transcript
 * (true/false) o desconocido (null → asumimos que asistió, porque hubo grabación
 * con el invitado externo presente).
 */
export async function applyFathomRecording(
  lead: Lead,
  which: 'j1' | 'j2',
  shareUrl: string | null,
  attended: boolean | null,
): Promise<{ markedAsistencia: boolean; addedLink: boolean }> {
  const supabase = (await getTenantDb());
  const asistField = which === 'j1' ? 'asistio_j1' : 'asistio_j2';
  const yaMarcado = which === 'j1' ? lead.asistio_j1 : lead.asistio_j2;
  const asistValue = attended ?? true;

  const markedAsistencia = yaMarcado == null;

  let addedLink = false;
  let newLinks: FathomLink[] | null = null;
  if (shareUrl) {
    const links = lead.fathom_links ?? [];
    if (!links.some((l) => l.url === shareUrl)) {
      newLinks = [...links, { label: which === 'j1' ? 'Reunión 1' : 'Reunión 2', url: shareUrl }];
      addedLink = true;
    }
  }

  if (!markedAsistencia && !addedLink) return { markedAsistencia: false, addedLink: false };

  // La asistencia pasa por updateLead → dispara Meta CAPI QualifiedLead si el lead
  // ya estaba calificado (antes el UPDATE directo bypaseaba el CAPI). Los links no
  // son campo de updateLead, así que van por update directo.
  if (markedAsistencia) {
    await updateLead(lead.id, which === 'j1' ? { asistio_j1: asistValue } : { asistio_j2: asistValue });
  }
  if (newLinks) {
    const { error } = await supabase.from('leads').update({ fathom_links: newLinks }).eq('id', lead.id);
    if (error) throw new Error(`Error aplicando grabación Fathom a lead ${lead.id}: ${error.message}`);
  }
  const after = { ...lead, ...(markedAsistencia ? { [asistField]: asistValue } : {}), ...(newLinks ? { fathom_links: newLinks } : {}) } as Lead;
  await logLeadChanges(lead.id, lead, after, 'Fathom');
  return { markedAsistencia, addedLink };
}

// ── Audit log (historial real de cambios por lead) ──────────────────────────
export type LeadAuditRow = { id: number; campo: string; valor_anterior: string | null; valor_nuevo: string | null; autor: string; created_at: string };

const AUDIT_FIELDS: Array<{ k: keyof Lead; label: string }> = [
  { k: 'nombre', label: 'Nombre' },
  { k: 'email', label: 'Email' },
  { k: 'telefono', label: 'Teléfono' },
  { k: 'empresa', label: 'Empresa' },
  { k: 'pipeline_stage', label: 'Etapa' },
  { k: 'estado_lead', label: 'Estado' },
  { k: 'fecha_agenda', label: 'Fecha de agendamiento' },
  { k: 'asistio_j1', label: 'Asistió R1' },
  { k: 'asistio_j2', label: 'Asistió R2' },
  { k: 'calificado', label: 'Calificado' },
  { k: 'fecha_junta_1', label: 'Fecha R1' },
  { k: 'fecha_junta_2', label: 'Fecha R2' },
  { k: 'closer', label: 'Closer' },
  { k: 'setter', label: 'Setter' },
  { k: 'monto_cierre_usd', label: 'Monto de cierre' },
  { k: 'motivo_perdida', label: 'Motivo' },
  { k: 'fecha_confirmacion', label: 'Confirmación de pago' },
  { k: 'nutricion_manual_deadline', label: 'Deadline de nutrición manual' },
  { k: 'fathom_links', label: 'Links de Fathom' },
];

function auditVal(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.length ? `${v.length} link(s)` : null;
  return String(v);
}

/** Inserta en lead_audit una fila por cada campo trackeado que cambió. No rompe la mutación si falla. */
export async function logLeadChanges(leadId: number, before: Lead | null, after: Lead | null, autor: string): Promise<void> {
  if (!before || !after) return;
  const rows = AUDIT_FIELDS.flatMap(({ k, label }) => {
    const a = auditVal(before[k]);
    const b = auditVal(after[k]);
    return a === b ? [] : [{ lead_id: leadId, campo: label, valor_anterior: a, valor_nuevo: b, autor }];
  });
  if (!rows.length) return;
  try {
    const { error } = await (await getTenantDb()).from('lead_audit').insert(rows);
    if (error) console.error(`[audit] insert falló: ${error.message}`);
  } catch (e) {
    console.error('[audit] insert excepción', e);
  }
}

/** Registra un evento suelto en el historial (ej. el motivo de una nutrición manual). */
export async function logLeadEvent(leadId: number, campo: string, valor: string, autor = 'CRM'): Promise<void> {
  try {
    const { error } = await (await getTenantDb()).from('lead_audit').insert([{ lead_id: leadId, campo, valor_anterior: null, valor_nuevo: valor, autor }]);
    if (error) console.error(`[audit] event falló: ${error.message}`);
  } catch (e) {
    console.error('[audit] event excepción', e);
  }
}

/** Historial de cambios de un lead (más reciente primero). Vacío si la tabla no existe. */
export async function getLeadAudit(leadId: number): Promise<LeadAuditRow[]> {
  try {
    const { data, error } = await (await getTenantDb())
      .from('lead_audit')
      .select('id, campo, valor_anterior, valor_nuevo, autor, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return [];
    return (data ?? []) as LeadAuditRow[];
  } catch {
    return [];
  }
}

/**
 * Aplica una cancelación de Calendly al lead (Fase 10).
 * - Si la fecha cancelada es la fecha_junta_2 y NO pasó → fecha_junta_2 = NULL.
 * - Si es la fecha_junta_1 y NO pasó → fecha_junta_1 = NULL (fecha_agenda se
 *   conserva: es el ancla histórica de cuándo agendó).
 * - Si la junta ya pasó (o no matchea ninguna fecha) → no toca nada.
 * Un reagendamiento llega como canceled + created, así que la fecha nueva la
 * vuelve a llenar el created.
 * @returns descripción de lo que cambió, para el log.
 */
export async function cancelarJuntaEnLead(
  lead: Lead,
  fechaCancelada: string,
  hoy: string,
): Promise<string> {
  const yaPaso = fechaCancelada < hoy;
  if (yaPaso) return 'reunión ya pasó — sin cambios';

  let campo: 'fecha_junta_2' | 'fecha_junta_1' | null = null;
  if (lead.fecha_junta_2 && fechaCancelada === lead.fecha_junta_2) {
    campo = 'fecha_junta_2';
  } else if (lead.fecha_junta_1 && fechaCancelada === lead.fecha_junta_1) {
    campo = 'fecha_junta_1';
  }
  if (!campo) return 'fecha cancelada no coincide con R1/R2 — sin cambios';

  const supabase = (await getTenantDb());
  const { error } = await supabase
    .from('leads')
    .update({ [campo]: null })
    .eq('id', lead.id);
  if (error) throw new Error(`Error cancelando ${campo} en lead ${lead.id}: ${error.message}`);
  return `${campo} = NULL (cancelación de reunión futura)`;
}

/**
 * Upsert por teléfono O email — usado por el webhook de Calendly.
 *
 * - Match (4B-bis): busca primero por telefono_normalizado, después por
 *   email. Así un lead que entró por instant form (teléfono verificado por
 *   SMS) se completa con su fecha de J1 cuando agenda en Calendly, aunque
 *   use un email distinto.
 * - Si existe: actualiza SOLO los campos que vienen de Calendly (nombre,
 *   email, fechas, empresa, telefono). NUNCA toca los campos manuales
 *   (asistio_j1, calificado, cerro, monto, fecha_cierre) ni los meta_*.
 * - UTMs y respuestas en UPDATE: solo sobrescribe si viene con valor.
 * - Si no existe: crea uno nuevo con origen_lead='calendly'.
 *
 * @returns { created: true } si fue insert, { created: false } si fue update.
 */
export async function upsertLeadFromCalendly(
  input: {
    email: string;
    nombre: string;
    fecha_agenda: string;
    fecha_junta_1: string;
    junta_1_at?: string | null;         // ISO con hora del start_time de Calendly
    empresa?: string | null;
    telefono?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    respuesta_facturacion?: string | null;
    respuesta_colaboradores?: string | null;
    respuesta_objetivo?: string | null;
    respuesta_cuando_empezar?: string | null;
    respuesta_inversion?: string | null;
    respuesta_decisor?: string | null;
    visitor_id?: string | null;
  },
  opts?: {
    // Backfill histórico (Fase 2-bis): backdatea created_at del lead SOLO
    // al crearlo, para que la fila refleje cuándo agendó realmente.
    fechaCreacion?: string;
    // Backfill histórico: en UPDATE solo completa campos vacíos del lead
    // existente — NUNCA pisa datos ya cargados (fechas más recientes,
    // empresa puesta a mano, etc.). El webhook en vivo usa false (default):
    // refresca fechas porque Calendly es la fuente fresca.
    soloCompletarVacios?: boolean;
  },
): Promise<{ created: boolean; lead: Lead }> {
  if (!input.email || !input.email.includes('@')) {
    throw new Error('Email inválido en payload de Calendly');
  }
  const emailNorm = input.email.trim().toLowerCase();
  const telNorm = normalizarTelefono(input.telefono);
  const soloVacios = opts?.soloCompletarVacios ?? false;

  const supabase = (await getTenantDb());

  // Match 4B-bis: primero por teléfono normalizado (la señal más confiable
  // — la comparte con el instant form de Meta), después por email.
  let existing: Lead | null = null;
  if (telNorm) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('telefono_normalizado', telNorm)
      .maybeSingle();
    if (error) throw new Error(`Error buscando lead por teléfono: ${error.message}`);
    existing = (data as Lead | null) ?? null;
  }
  if (!existing) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('email', emailNorm)
      .maybeSingle();
    if (error) throw new Error(`Error buscando lead por email: ${error.message}`);
    existing = (data as Lead | null) ?? null;
  }

  // Base de payload — campos de contacto / agenda.
  const basePayload = {
    nombre: input.nombre.trim(),
    email: emailNorm,
    fecha_agenda: input.fecha_agenda,
    fecha_junta_1: input.fecha_junta_1,
    ...(input.junta_1_at ? { junta_1_at: input.junta_1_at } : {}),
    empresa: input.empresa?.trim() || null,
    telefono: input.telefono?.trim() || null,
    ...(telNorm ? { telefono_normalizado: telNorm } : {}),
  };

  if (existing) {
    let updatePayload: Record<string, unknown>;

    if (soloVacios) {
      // BACKFILL: solo rellena lo que está vacío en el lead existente.
      // Nunca pisa fechas, empresa, ni atribución ya cargada.
      updatePayload = {};
      const setIfEmpty = (campo: keyof Lead, valor: string | null | undefined) => {
        const actual = existing![campo];
        if ((actual === null || actual === undefined || actual === '') && valor) {
          updatePayload[campo] = valor;
        }
      };
      setIfEmpty('email', emailNorm);
      setIfEmpty('telefono', input.telefono?.trim() || null);
      setIfEmpty('telefono_normalizado', telNorm);
      setIfEmpty('empresa', input.empresa?.trim() || null);
      setIfEmpty('fecha_agenda', input.fecha_agenda);
      setIfEmpty('fecha_junta_1', input.fecha_junta_1);
      setIfEmpty('junta_1_at', input.junta_1_at);
      setIfEmpty('utm_source', input.utm_source);
      setIfEmpty('utm_medium', input.utm_medium);
      setIfEmpty('utm_campaign', input.utm_campaign);
      setIfEmpty('utm_content', input.utm_content);
      setIfEmpty('respuesta_facturacion', input.respuesta_facturacion);
      setIfEmpty('respuesta_colaboradores', input.respuesta_colaboradores);
      setIfEmpty('respuesta_objetivo', input.respuesta_objetivo);
      setIfEmpty('respuesta_cuando_empezar', input.respuesta_cuando_empezar);
      setIfEmpty('respuesta_inversion', input.respuesta_inversion);
      setIfEmpty('respuesta_decisor', input.respuesta_decisor);
      setIfEmpty('visitor_id', input.visitor_id);

      // Nada que completar → no escribir
      if (Object.keys(updatePayload).length === 0) {
        return { created: false, lead: existing };
      }
    } else {
      // WEBHOOK EN VIVO: refresca contacto/agenda; UTMs y respuestas solo
      // si vienen con valor (no borrar lo que ya estaba).
      const extraUpdates: Record<string, string> = {};
      if (input.utm_source)               extraUpdates.utm_source               = input.utm_source;
      if (input.utm_medium)               extraUpdates.utm_medium               = input.utm_medium;
      if (input.utm_campaign)             extraUpdates.utm_campaign             = input.utm_campaign;
      if (input.utm_content)              extraUpdates.utm_content              = input.utm_content;
      if (input.respuesta_facturacion)    extraUpdates.respuesta_facturacion    = input.respuesta_facturacion;
      if (input.respuesta_colaboradores)  extraUpdates.respuesta_colaboradores  = input.respuesta_colaboradores;
      if (input.respuesta_objetivo)       extraUpdates.respuesta_objetivo       = input.respuesta_objetivo;
      if (input.respuesta_cuando_empezar) extraUpdates.respuesta_cuando_empezar = input.respuesta_cuando_empezar;
      if (input.respuesta_inversion)      extraUpdates.respuesta_inversion      = input.respuesta_inversion;
      if (input.respuesta_decisor)        extraUpdates.respuesta_decisor        = input.respuesta_decisor;
      if (input.visitor_id)               extraUpdates.visitor_id               = input.visitor_id;
      updatePayload = { ...basePayload, ...extraUpdates };
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`Error actualizando lead ${existing.id}: ${error.message}`);
    return { created: false, lead: data as Lead };
  }

  // INSERT: incluimos todo aunque sean null (lead nuevo, no hay nada que pisar)
  const insertPayload = {
    ...basePayload,
    origen_lead:              'calendly',
    utm_source:               input.utm_source               ?? null,
    utm_medium:               input.utm_medium               ?? null,
    utm_campaign:             input.utm_campaign             ?? null,
    utm_content:              input.utm_content              ?? null,
    respuesta_facturacion:    input.respuesta_facturacion    ?? null,
    respuesta_colaboradores:  input.respuesta_colaboradores  ?? null,
    respuesta_objetivo:       input.respuesta_objetivo       ?? null,
    respuesta_cuando_empezar: input.respuesta_cuando_empezar ?? null,
    respuesta_inversion:      input.respuesta_inversion      ?? null,
    respuesta_decisor:        input.respuesta_decisor        ?? null,
    visitor_id:               input.visitor_id               ?? null,
    // Backdatear created_at SOLO en backfill, para reflejar cuándo agendó
    ...(opts?.fechaCreacion ? { created_at: opts.fechaCreacion } : {}),
  };

  const { data, error } = await supabase
    .from('leads')
    .insert(insertPayload)
    .select('*')
    .single();
  if (error) throw new Error(`Error creando lead desde Calendly: ${error.message}`);
  return { created: true, lead: data as Lead };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el estado de madurez de la cohorte de UN lead según su fecha_junta_1.
 * Mismos thresholds que la vista v_cohortes_semanales.
 */
export function estadoMadurezLead(lead: Lead, hoy: Date = new Date()): EstadoMadurez {
  if (!lead.fecha_junta_1) return 'sin_j1';
  const dias = diasDesdeJ1(lead.fecha_junta_1, hoy);
  if (dias === null) return 'sin_j1';
  // J1 en el futuro (dias < 0): la cohorte recién arranca → 'reciente', nunca
  // 'madura'. Evita el bug de "−9 días desde J1" / madurez falsa (Fase 8).
  if (dias < 0) return 'reciente';
  if (dias >= 14) return 'madura';
  if (dias >= 5) return 'madurando';
  return 'reciente';
}

/**
 * Días (enteros) entre la J1 y hoy. Negativo si la J1 es futura.
 * @returns null si no hay fecha_junta_1.
 */
export function diasDesdeJ1(fechaJ1: string | null, hoy: Date = new Date()): number | null {
  if (!fechaJ1) return null;
  const [y, m, d] = fechaJ1.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  return Math.floor((hoyUTC.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Texto humano de la cohorte para la ficha del lead (Fase 8).
 * J1 futura → "faltan X días para J1"; J1 pasada → "X días desde J1".
 * @returns null si no hay J1.
 */
export function textoCohorteJ1(fechaJ1: string | null, hoy: Date = new Date()): string | null {
  const dias = diasDesdeJ1(fechaJ1, hoy);
  if (dias === null) return null;
  if (dias < 0) {
    const faltan = Math.abs(dias);
    return `faltan ${faltan} ${faltan === 1 ? 'día' : 'días'} para R1`;
  }
  if (dias === 0) return 'R1 es hoy';
  return `${dias} ${dias === 1 ? 'día' : 'días'} desde R1`;
}

/**
 * Devuelve emoji + label para el estado de madurez.
 */
export function labelMadurez(estado: EstadoMadurez): { emoji: string; label: string; color: string } {
  switch (estado) {
    case 'madura':
      return { emoji: '🟢', label: 'Madura', color: 'var(--accent-green)' };
    case 'madurando':
      return { emoji: '🟡', label: 'Madurando', color: 'var(--accent-yellow)' };
    case 'reciente':
      return { emoji: '⚪', label: 'Reciente', color: 'var(--text-dim)' };
    case 'sin_j1':
      return { emoji: '—', label: 'Sin R1', color: 'var(--text-pending)' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VSL tracking (Fase 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cuenta cuántos eventos vsl_play tiene un visitor_id en vsl_events.
 * Para la ficha del lead (Fase 7): "vio el VSL N veces".
 * @returns 0 si visitorId es null o no hay eventos.
 */
export async function contarVslPlays(visitorId: string | null): Promise<number> {
  if (!visitorId) return 0;
  const supabase = (await getTenantDb());
  const { count, error } = await supabase
    .from('vsl_events')
    .select('id', { count: 'exact', head: true })
    .eq('visitor_id', visitorId)
    .eq('event', 'vsl_play');
  if (error) {
    console.error(`[contarVslPlays] falló: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

/**
 * Engagement del VSL por persona (v3 Fase A): plays + el % MÁXIMO alcanzado.
 * Reemplaza el conteo simple en la ficha, las cards de juntas y la cola.
 *   - plays: eventos de tipo 'play' (compat: event='vsl_play').
 *   - max_pct: mayor `porcentaje` de los milestones de watchtime (null si no hay).
 *   - sin_datos: true si el visitor_id es null (no afirmar que no vio).
 * @returns { plays:0, max_pct:null, sin_datos:true } si visitorId es null.
 */
export type VslEngagement = { plays: number; max_pct: number | null; sin_datos: boolean };

export async function getVslEngagement(visitorId: string | null): Promise<VslEngagement> {
  if (!visitorId) return { plays: 0, max_pct: null, sin_datos: true };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('vsl_events')
    .select('tipo_evento, porcentaje, event')
    .eq('visitor_id', visitorId);
  if (error) {
    console.error(`[getVslEngagement] falló: ${error.message}`);
    return { plays: 0, max_pct: null, sin_datos: true };
  }
  const rows = (data ?? []) as Array<{ tipo_evento: string | null; porcentaje: number | null; event: string | null }>;
  const plays = rows.filter((r) => r.tipo_evento === 'play' || r.event === 'vsl_play').length;
  // Retención = SOLO avance POSITIVO (hitos pNN o exit con % > 0). El 'play' guarda
  // porcentaje:0 (centinela "arrancó") y un exit en 0% = arrancó y salió sin avanzar:
  // ninguno es una medición real de retención. Contar el 0 hacía que un lead que
  // reprodujo se viera como "reprodujo · 0%". Sin avance positivo → max_pct = null
  // ("sin dato de avance"), nunca 0.
  const pcts = rows
    .filter((r) => r.tipo_evento !== 'play' && r.event !== 'vsl_play')
    .map((r) => r.porcentaje)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  const max_pct = pcts.length > 0 ? Math.max(...pcts) : null;
  return { plays, max_pct, sin_datos: false };
}

/**
 * Engagement del VSL para VARIOS visitors en UNA sola query (evita el N+1 de
 * llamar getVslEngagement por lead en un loop). Devuelve un Map por visitor_id;
 * los visitors sin filas no aparecen (el caller los trata como 'sin_datos').
 */
export async function getVslEngagementMap(
  visitorIds: Array<string | null>,
): Promise<Map<string, VslEngagement>> {
  const ids = [...new Set(visitorIds.filter((v): v is string => !!v))];
  const map = new Map<string, VslEngagement>();
  if (ids.length === 0) return map;
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('vsl_events')
    .select('visitor_id, tipo_evento, porcentaje, event')
    .in('visitor_id', ids);
  if (error) {
    console.error(`[getVslEngagementMap] falló: ${error.message}`);
    return map;
  }
  const porVisitor = new Map<string, Array<{ tipo_evento: string | null; porcentaje: number | null; event: string | null }>>();
  for (const r of (data ?? []) as Array<{ visitor_id: string; tipo_evento: string | null; porcentaje: number | null; event: string | null }>) {
    const arr = porVisitor.get(r.visitor_id) ?? [];
    arr.push(r);
    porVisitor.set(r.visitor_id, arr);
  }
  for (const [vid, rows] of porVisitor) {
    const plays = rows.filter((r) => r.tipo_evento === 'play' || r.event === 'vsl_play').length;
    // Retención solo de avance POSITIVO (>0); el play (0) y el exit-en-0 no cuentan.
    const pcts = rows
      .filter((r) => r.tipo_evento !== 'play' && r.event !== 'vsl_play')
      .map((r) => r.porcentaje)
      .filter((p): p is number => typeof p === 'number' && p > 0);
    map.set(vid, { plays, max_pct: pcts.length > 0 ? Math.max(...pcts) : null, sin_datos: false });
  }
  return map;
}

// ── Respuestas del form de Calendly POR REUNIÓN (migración 0062) ────────────
// R1 y R2 tienen formularios propios: se guarda el set crudo por reunión y la
// ficha muestra el más reciente de cada una. Las columnas respuesta_* del lead
// quedan como fallback legacy para R1 (leads anteriores a la tabla).

export type RespuestaQA = { q: string; a: string };

export async function saveLeadRespuestas(
  leadId: number,
  reunion: 'R1' | 'R2',
  qa: Array<{ question?: string; answer?: string }> | undefined | null,
  eventoInicio: string | null,
): Promise<void> {
  const respuestas: RespuestaQA[] = (qa ?? [])
    .filter((x) => x?.question?.trim() && x?.answer?.trim())
    .map((x) => ({ q: x.question!.trim(), a: x.answer!.trim() }));
  if (!respuestas.length) return;
  try {
    const db = await getTenantDb();
    // Idempotencia (backfill / reintentos del webhook): no duplicar si ya hay una
    // fila para el mismo (lead, reunión, evento).
    if (eventoInicio) {
      const { data: ya } = await db
        .from('lead_respuestas')
        .select('id')
        .eq('lead_id', leadId)
        .eq('reunion', reunion)
        .eq('evento_inicio', eventoInicio)
        .limit(1);
      if (ya && ya.length) return;
    }
    const { error } = await db
      .from('lead_respuestas')
      .insert({ lead_id: leadId, reunion, respuestas, evento_inicio: eventoInicio });
    if (error) console.error(`[lead_respuestas] insert falló: ${error.message}`);
  } catch (e) {
    console.error('[lead_respuestas] excepción', e);
  }
}

/** Último set de respuestas por reunión. R1 cae a las columnas legacy si no hay fila. */
export async function getLeadRespuestas(lead: Lead): Promise<{ R1: RespuestaQA[]; R2: RespuestaQA[] }> {
  const out: { R1: RespuestaQA[]; R2: RespuestaQA[] } = { R1: [], R2: [] };
  try {
    const { data } = await (await getTenantDb())
      .from('lead_respuestas')
      .select('reunion, respuestas, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(20);
    for (const r of (data ?? []) as Array<{ reunion: 'R1' | 'R2'; respuestas: RespuestaQA[] }>) {
      if (!out[r.reunion].length && Array.isArray(r.respuestas)) out[r.reunion] = r.respuestas;
    }
  } catch { /* fallback legacy abajo */ }
  if (!out.R1.length) {
    const legacy: Array<[string, string | null]> = [
      ['¿Qué quiere lograr?', lead.respuesta_objetivo],
      ['¿Puede invertir?', lead.respuesta_inversion],
      ['¿Cuántos colaboradores?', lead.respuesta_colaboradores],
      ['¿Factura +$20M MXN?', lead.respuesta_facturacion],
      ['¿Alguien más decide?', lead.respuesta_decisor],
      ['¿Cuándo quiere empezar?', lead.respuesta_cuando_empezar],
    ];
    out.R1 = legacy.filter(([, a]) => a?.trim()).map(([q, a]) => ({ q, a: a! }));
  }
  return out;
}

// ── Timeline de comportamiento por lead (tab Tracking) ──────────────────────
// Merge cronológico de landing_visits + vsl_events del visitor: cada visita a
// la landing (con URL si la manda el beacon nuevo), cada play del VSL y los
// hitos de retención/abandono, todos con fecha y hora reales (created_at).

export type TrackingEvent = {
  ts: string;                                   // ISO
  tipo: 'pageview' | 'play' | 'retencion' | 'exit';
  porcentaje: number | null;                    // retención/abandono
  landing_url: string | null;
  referrer: string | null;
  video_id: string | null;
  vsl_titulo: string | null;
};

export async function getTrackingEvents(visitorId: string | null, limit = 120): Promise<TrackingEvent[]> {
  if (!visitorId) return [];
  try {
    const supabase = (await getTenantDb());
    const [visitas, eventos] = await Promise.all([
      supabase.from('landing_visits')
        .select('created_at, landing_url, referrer')
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase.from('vsl_events')
        .select('created_at, tipo_evento, porcentaje, event, video_id, vsl_titulo')
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);
    const out: TrackingEvent[] = [];
    for (const v of (visitas.data ?? []) as Array<{ created_at: string; landing_url: string | null; referrer: string | null }>) {
      out.push({ ts: v.created_at, tipo: 'pageview', porcentaje: null, landing_url: v.landing_url, referrer: v.referrer, video_id: null, vsl_titulo: null });
    }
    for (const e of (eventos.data ?? []) as Array<{ created_at: string; tipo_evento: string | null; porcentaje: number | null; event: string | null; video_id: string | null; vsl_titulo: string | null }>) {
      const esPlay = e.tipo_evento === 'play' || e.event === 'vsl_play';
      const tipo: TrackingEvent['tipo'] = esPlay ? 'play' : e.tipo_evento === 'exit' ? 'exit' : 'retencion';
      out.push({ ts: e.created_at, tipo, porcentaje: e.porcentaje, landing_url: null, referrer: null, video_id: e.video_id, vsl_titulo: e.vsl_titulo });
    }
    out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline del CRM — etapas editables + Closer/Setter/Fathom (migración 0020)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración del funnel (etapas + transiciones) en una sola fila JSON
 * (`funnel_config`, id=1). El CRM y la tab /funnel leen de acá. Si la tabla no
 * existe (migración 0025 sin aplicar) o no hay fila, cae a los defaults del
 * código — todo sigue renderizando, solo que los cambios no persisten aún.
 */
// Lo que se PERSISTE es el pipeline (Activo) + las nutriciones suprimidas; el
// funnel completo (stages + transitions) se DERIVA con generateFunnel.
export type FunnelConfig = { stages: Stage[]; transitions: FunnelTransition[]; pipeline: Stage[]; suppressed: string[] };

function buildFunnel(pipeline: Stage[], suppressed: string[]): FunnelConfig {
  const { stages, transitions } = generateFunnel(pipeline, suppressed);
  return { stages, transitions, pipeline, suppressed };
}

export async function getFunnel(): Promise<FunnelConfig> {
  try {
    const supabase = (await getTenantDb());
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    const { data, error } = await supabase
      .from('funnel_config')
      .select('data')
      .eq('workspace_id', ws)
      .maybeSingle();
    if (error || !data || !data.data) return buildFunnel(DEFAULT_PIPELINE, []);
    const cfg = data.data as { pipeline?: Stage[]; suppressed?: string[] };
    const pipeline = Array.isArray(cfg.pipeline) && cfg.pipeline.length ? cfg.pipeline : DEFAULT_PIPELINE;
    const suppressed = Array.isArray(cfg.suppressed) ? cfg.suppressed : [];
    return buildFunnel(pipeline, suppressed);
  } catch {
    return buildFunnel(DEFAULT_PIPELINE, []);
  }
}

/** Guarda la config del funnel del workspace actual (una fila por workspace). */
export async function saveFunnel(pipeline: Stage[], suppressed: string[]): Promise<void> {
  const supabase = (await getTenantDb());
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const { error } = await supabase
    .from('funnel_config')
    .upsert(
      { id: ws, workspace_id: ws, data: { pipeline, suppressed }, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' },
    );
  if (error) throw new Error(`Error guardando el funnel: ${error.message}`);
}

/** Etapas del pipeline (backed by funnel_config) — las consume el Kanban del CRM. */
export async function getPipelineStages(): Promise<Stage[]> {
  return (await getFunnel()).stages;
}

/** Transiciones del funnel (backed by funnel_config) — alimentan "Datos sin marcar". */
export async function getFunnelTransitions(): Promise<FunnelTransition[]> {
  return (await getFunnel()).transitions;
}

/**
 * Mueve un lead a una etapa del tablero. Persiste el override `pipeline_stage`
 * y, en desenlaces terminales, sincroniza estado_lead (vía updateLead) para que
 * Revenue/CAPI sigan correctos. Para "ganado" exige monto.
 */
export async function setPipelineStage(
  id: number,
  stageKey: string,
  opts?: { monto?: number | null; motivo?: string | null; asistio_j1?: boolean | null; asistio_j2?: boolean | null; deadline?: string | null },
): Promise<void> {
  const supabase = (await getTenantDb());
  const estado = terminalEstadoFor(stageKey);

  // 1) Sincronizar PRIMERO el desenlace canónico (invariantes + Meta CAPI). Si
  //    falla (p.ej. monto inválido), propagamos el error y NO tocamos el override:
  //    antes el error se tragaba y el tablero quedaba mostrando una etapa cuyo
  //    estado_lead nunca cambió (Revenue/CAPI divergían en silencio).
  const sync: LeadUpdateInput = { estado_lead: estado };
  if (estado === 'ganado' && opts?.monto != null) sync.monto_cierre_usd = opts.monto;
  if ((estado === 'perdido' || estado === 'descalificado') && opts?.motivo != null) {
    sync.motivo_perdida = opts.motivo;
  }
  // Asistencia a J1/J2 — la setean las resoluciones de "Datos sin marcar" (tipos
  // A y C), que existen justamente porque asistio_j1/j2 está en null.
  if (opts?.asistio_j1 !== undefined) sync.asistio_j1 = opts.asistio_j1;
  if (opts?.asistio_j2 !== undefined) sync.asistio_j2 = opts.asistio_j2;
  // En etapas de nutrición marcamos la bandera para los pendientes/tab Nutrición.
  if (NUTRI_KEYS.includes(stageKey)) {
    sync.nutricion_realizada = true;
  }
  await updateLead(id, sync);

  // 2) Guardar el override de la columna del tablero. El deadline de nutrición
  //    manual solo vive mientras el lead está en 'manual'; al moverlo a cualquier
  //    otra etapa se limpia (el lead dejó de estar aparcado).
  const patch: Record<string, unknown> = {
    pipeline_stage: stageKey,
    nutricion_manual_deadline: stageKey === 'manual' ? (opts?.deadline ?? null) : null,
  };
  const { error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(`Error moviendo lead ${id} a ${stageKey}: ${error.message}`);
  void actualizarEtiquetaLead(id).catch(() => {}); // etiqueta WA por etapa (best-effort; cubre 'manual')
}

/** Campos editables desde la ficha del rediseño (Closer/Setter/Fathom/motivo/fechas). */
export type LeadMetaInput = {
  closer?: string | null;
  setter?: string | null;
  fathom_links?: FathomLink[];
  motivo_perdida?: string | null;
  fecha_junta_1?: string | null;   // fecha de la J1, editable al mover a Agenda J1
  fecha_junta_2?: string | null;   // fecha de la J2, editable al mover a Agenda J2 / Facturando
  // Contacto (editable a mano desde la ficha, con confirmación en la UI).
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;
};

/**
 * Persiste SOLO el override de la columna del tablero (pipeline_stage) y el
 * deadline de nutrición manual, sin tocar estado_lead (el editor ya lo sincroniza
 * vía updateLead). El deadline solo vive en 'manual'; en otra etapa se limpia.
 * stageKey=null limpia el override (vuelve a la derivación automática).
 */
export async function setBoardStageOverride(id: number, stageKey: string | null, deadline: string | null): Promise<void> {
  const patch: Record<string, unknown> = {
    pipeline_stage: stageKey,
    nutricion_manual_deadline: stageKey === 'manual' ? (deadline ?? null) : null,
  };
  if (stageKey && NUTRI_KEYS.includes(stageKey)) patch.nutricion_realizada = true;
  const { error } = await (await getTenantDb()).from('leads').update(patch).eq('id', id);
  if (error) throw new Error(`Error guardando etapa del lead ${id}: ${error.message}`);
}

export async function saveLeadMeta(id: number, meta: LeadMetaInput): Promise<void> {
  const supabase = (await getTenantDb());
  const payload: Record<string, unknown> = {};
  if (meta.closer !== undefined) payload.closer = meta.closer;
  if (meta.setter !== undefined) payload.setter = meta.setter;
  if (meta.fathom_links !== undefined) payload.fathom_links = meta.fathom_links;
  if (meta.motivo_perdida !== undefined) payload.motivo_perdida = meta.motivo_perdida;
  if (meta.fecha_junta_1 !== undefined) payload.fecha_junta_1 = meta.fecha_junta_1;
  if (meta.fecha_junta_2 !== undefined) payload.fecha_junta_2 = meta.fecha_junta_2;
  if (meta.nombre !== undefined && meta.nombre) payload.nombre = meta.nombre;
  if (meta.email !== undefined) payload.email = meta.email;
  if (meta.empresa !== undefined) payload.empresa = meta.empresa;
  if (meta.telefono !== undefined) { payload.telefono = meta.telefono; payload.telefono_normalizado = normalizarTelefono(meta.telefono); }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('leads').update(payload).eq('id', id);
  if (error) throw new Error(`Error guardando datos del lead ${id}: ${error.message}`);
}

/**
 * "Datos sin marcar": TODOS los datos completables que la etapa ACTUAL del lead
 * adeuda (asistencia, calificado, Fathom de reuniones pasadas, monto, plan,
 * motivo, setter…), respetando las excepciones persistidas (sin_r1/sin_r2/
 * fathom_omitido). Fuente única para la ficha, el badge del Kanban y el worklist.
 * Solo pide lo POSIBLE de conseguir (el Fathom de una reunión futura no cuenta).
 */
export function faltantesDeLead(
  lead: Lead,
  tienePlan?: boolean,
  extra?: { comprobantesFaltantes?: number; r2RespuestasOk?: boolean; pipeline?: Stage[] },
): Step[] {
  const stage = (lead.pipeline_stage && lead.pipeline_stage.trim()) ? lead.pipeline_stage : deriveStageKey(lead);
  // Si el caller pasa el funnel del workspace, derivamos nivel/reuniones/venta de
  // SU pipeline (funnels no-default); si no, stepsForStage cae al funnel default.
  const info = extra?.pipeline ? funnelReqInfo(extra.pipeline, stage) : undefined;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);
  const oblig = lead.deal_obligaciones;
  const tieneR2 = !!lead.fecha_junta_2 || lead.asistio_j2 != null;
  return stepsForStage(stage, {
    fechaJ1: lead.fecha_junta_1,
    asistioJ1: lead.asistio_j1,
    calificado: lead.calificado,
    fechaJ2: lead.fecha_junta_2,
    asistioJ2: lead.asistio_j2,
    hasFathomUrl: links.length > 0,
    monto: lead.monto_cierre_usd,
    motivo: lead.motivo_perdida,
    setter: lead.setter,
    closer: lead.closer,
    telefono: lead.telefono,
    empresa: lead.empresa,
    // Deal Details desglosado (solo se evalúa en ganado).
    dealServicioOk: !!(lead.deal_servicio?.que_es?.trim()),
    dealPromesaOk: !!(lead.deal_promesa?.resultado?.trim()),
    dealFiscalOk: !!(lead.deal_fiscal?.razon?.trim()),
    // Documento fiscal: presente O declarado omitido (no se vuelve a exigir).
    dealFiscalDocOk: !!(lead.deal_fiscal?.doc_path?.trim()) || !!lead.deal_fiscal_doc_omitido,
    dealObligacionesOk: !!((oblig?.cliente?.length ?? 0) > 0 || (oblig?.prestador?.length ?? 0) > 0),
    // Comprobantes: si se declararon omitidos, no faltan.
    comprobantesFaltantes: lead.comprobante_omitido ? 0 : extra?.comprobantesFaltantes,
    tieneR2,
    // Respuestas R2: las de Calendly O el motivo de haberse agendado fuera de Calendly.
    r2RespuestasOk: (extra?.r2RespuestasOk ?? false) || !!lead.r2_agenda_externa_motivo?.trim(),
    tienePlan,
    hoyISO: hoyEnTijuana(),
    // Timestamps con hora (Calendly): "ya pasó" mira la hora real, no solo el día,
    // así una reunión de HOY que ya terminó exige cargar el Fathom.
    atJ1: lead.junta_1_at,
    atJ2: lead.junta_2_at,
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
    nivel: info?.nivel,
    numReuniones: info?.numReuniones,
    esVenta: info?.esVenta,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing visits (migración 0021) — pageviews de la landing, aparte del VSL
// ─────────────────────────────────────────────────────────────────────────────

export type VisitasLanding = {
  total_visitas: number;
  dias_distintos: number;
  primera_visita: string | null;
  ultima_visita: string | null;
  fechas: string[]; // YYYY-MM-DD distintas, ascendente
};

const SIN_VISITAS: VisitasLanding = {
  total_visitas: 0, dias_distintos: 0, primera_visita: null, ultima_visita: null, fechas: [],
};

function resumirVisitas(rows: Array<{ created_at: string }>): VisitasLanding {
  if (rows.length === 0) return { ...SIN_VISITAS };
  const ordenadas = rows.map((r) => r.created_at).sort();
  const fechas = [...new Set(ordenadas.map((c) => c.slice(0, 10)))].sort();
  return {
    total_visitas: rows.length,
    dias_distintos: fechas.length,
    primera_visita: ordenadas[0],
    ultima_visita: ordenadas[ordenadas.length - 1],
    fechas,
  };
}

/**
 * Resumen de visitas a la landing de UN visitor_id. No toca vsl_events.
 */
export async function contarVisitasLanding(visitorId: string | null): Promise<VisitasLanding> {
  if (!visitorId) return { ...SIN_VISITAS };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('landing_visits')
    .select('created_at')
    .eq('visitor_id', visitorId);
  if (error) {
    console.error(`[contarVisitasLanding] falló: ${error.message}`);
    return { ...SIN_VISITAS };
  }
  return resumirVisitas((data ?? []) as Array<{ created_at: string }>);
}

/**
 * Versión por lote: visitas por visitor_id para una lista (evita N queries en
 * la tabla del CRM). Devuelve un Map visitor_id → VisitasLanding.
 */
export async function getVisitasLandingMap(
  visitorIds: Array<string | null | undefined>,
): Promise<Map<string, VisitasLanding>> {
  const ids = [...new Set(visitorIds.filter((v): v is string => !!v))];
  const out = new Map<string, VisitasLanding>();
  if (ids.length === 0) return out;
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('landing_visits')
    .select('visitor_id, created_at')
    .in('visitor_id', ids);
  if (error) {
    console.error(`[getVisitasLandingMap] falló: ${error.message}`);
    return out;
  }
  const porVisitor = new Map<string, Array<{ created_at: string }>>();
  for (const r of (data ?? []) as Array<{ visitor_id: string; created_at: string }>) {
    const arr = porVisitor.get(r.visitor_id) ?? [];
    arr.push({ created_at: r.created_at });
    porVisitor.set(r.visitor_id, arr);
  }
  for (const [vid, rows] of porVisitor) out.set(vid, resumirVisitas(rows));
  return out;
}
