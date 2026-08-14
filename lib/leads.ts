// =============================================================================
// Leads — types, queries y server actions
// =============================================================================
// Tabla `leads` ya creada en Fase 1. Esta capa concentra TODO el acceso al
// modelo: get, create, update, validaciones lógicas.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './auth-session';
import { getUsuarioActual } from './auth';
import { sendMetaCAPIEvent } from './meta-capi';
import type { Stage, FunnelTransition, EntradaId, EventoFunnel } from './pipeline';
export type { EventoFunnel };
import { DEFAULT_PIPELINE, generateFunnel, terminalEstadoFor, NUTRI_KEYS, deriveStageKey, pipelineStageOf, MAKO_SETTER, parseEntradas, parseEvento, sanearPipeline, mergeFunnelData } from './pipeline';
import { AUTOR_SISTEMA, CAMPO_ETAPA, cambioDeEtapa, marcarEtapaVista } from './etapa-historial';
import { stepsForStage, funnelReqInfo, type Step } from './stage-requirements';
// La etapa de ORIGEN de un movimiento se deriva con la MISMA función que usa la
// ficha (override chequeado contra el funnel vigente): con el override crudo, el
// validador y la pantalla discrepan justo en los leads con etapas huérfanas.
import { etapaVigenteDe } from './funnel-etapas';
import { avanceDe } from './vsl-retencion';
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
  // Última etapa efectiva que el historial YA registró (migración 0122). No es
  // la etapa del lead: es la memoria del historial, y existe porque la etapa que
  // ve el usuario es derivada y puede cambiar sin que nadie escriba nada. Ver
  // lib/etapa-historial.ts.
  etapa_vista?: string | null;
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
/**
 * En qué workspace vive un lead, MIRANDO POR ENCIMA DEL SCOPE. Solo el super
 * admin, y fail-closed: cualquier otra sesión —o ninguna— recibe null antes de
 * que la consulta corra.
 *
 * ⚠️ ESTO CRUZA INQUILINOS A PROPÓSITO, que es la cosa que el resto del archivo
 * evita. Existe por un caso concreto: el super admin abre desde WhatsApp el link
 * del lead de un cliente estando parado en otro workspace, y `getLead` —que
 * scopea— devuelve null como si el lead no existiera. La alternativa era que él
 * tuviera que adivinar el `?ws=` a mano.
 *
 * Devuelve SOLO el número de workspace, nunca datos del lead: con eso alcanza
 * para mandarlo a `?ws=N`, y de ahí en adelante manda el camino de siempre
 * (proxy.ts valida que la sesión firmada sea admin y recién ahí lo deja pasar).
 * Así esta función no se convierte en una segunda puerta a los datos ajenos.
 */
export async function workspaceDeLeadParaAdmin(id: number): Promise<number | null> {
  const { getSesionAdmin } = await import('./auth');
  if (!(await getSesionAdmin())) return null;
  const { data } = await getSupabaseServer()
    .from('leads')
    .select('workspace_id')
    .eq('id', id)
    .maybeSingle();
  const ws = (data as { workspace_id: number | null } | null)?.workspace_id;
  return typeof ws === 'number' ? ws : null;
}

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
 * Nombre del ÚNICO vendedor del workspace, o null si hay 0 o más de 1 (#2:
 * auto-asignar setter/closer cuando hay una sola persona). Excluye admin y MaKo,
 * igual que getEquipoAction. Corre en el workspace actual (webhook o sesión).
 */
export async function vendedorUnicoDelWorkspace(): Promise<string | null> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return null;
    const { data } = await getSupabaseServer()
      .from('usuarios')
      .select('nombre, email, rol, estado, workspace_id')
      .eq('workspace_id', ws)
      .neq('estado', 'suspendido');
    const sellers = ((data ?? []) as Array<{ nombre: string | null; email: string; rol: string; workspace_id: number | null }>)
      .filter((u) => u.rol !== 'admin' && u.workspace_id === ws && (u.nombre?.trim() || u.email))
      .map((u) => u.nombre?.trim() || u.email)
      .filter((n) => n && n !== MAKO_SETTER);
    return sellers.length === 1 ? sellers[0] : null;
  } catch { return null; }
}

/**
 * Crea un lead nuevo. Solo requiere nombre.
 */
export async function createLead(input: LeadCreateInput): Promise<Lead> {
  if (!input.nombre || !input.nombre.trim()) {
    throw new Error('Nombre es requerido');
  }
  const supabase = (await getTenantDb());
  const solo = await vendedorUnicoDelWorkspace(); // #2: auto-asignar si hay 1 vendedor
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
      ...(solo ? { setter: solo, closer: solo } : {}),
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
  const soloMeta = await vendedorUnicoDelWorkspace(); // #2: auto-asignar si hay 1 vendedor
  const { data, error } = await supabase
    .from('leads')
    .insert({
      nombre: input.nombre.trim(),
      email: emailNorm,
      telefono: input.telefono?.trim() || null,
      empresa: input.empresa?.trim() || null,
      telefono_normalizado: telNorm,
      ...(soloMeta ? { setter: soloMeta, closer: soloMeta } : {}),
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

// OJO: 'pipeline_stage' NO está en esta lista. La etapa se audita aparte (campo
// 'Etapa', ver más abajo) porque lo que le importa al usuario es la etapa
// EFECTIVA — el override si lo hay, y si no la derivada. Diffear la columna
// cruda registraba "— → ganado" cuando el lead venía de "agenda", y no registraba
// NADA cuando la etapa cambiaba por derivación (el caso del lead 1395).
const AUDIT_FIELDS: Array<{ k: keyof Lead; label: string }> = [
  { k: 'nombre', label: 'Nombre' },
  { k: 'email', label: 'Email' },
  { k: 'telefono', label: 'Teléfono' },
  { k: 'empresa', label: 'Empresa' },
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

// Ventana del anti-duplicado. Un mismo movimiento pasa hoy por DOS capas que
// auditan (setPipelineStage escribe su diff y el caller vuelve a llamar a
// logLeadChanges con un `before` anterior a todo), así que la misma línea llega
// dos veces con milisegundos de diferencia. 60s cubre de sobra un request y es
// demasiado corto para tapar un cambio real repetido a mano.
const DEDUP_MS = 60_000;

/**
 * Inserta en lead_audit una fila por cada campo trackeado que cambió. No rompe la
 * mutación si falla.
 *
 * Dos cosas que no son obvias:
 *  · La ETAPA se calcula, no se diffea: se compara la etapa efectiva (override o
 *    derivada) contra `etapa_vista`, la última que el historial dio por
 *    registrada. Así la línea sale una sola vez aunque la escritura pase por dos
 *    capas, y sale con el valor anterior REAL en vez de un "—".
 *  · Todas las filas entran en UN insert para que compartan created_at: la ficha
 *    agrupa por instante para mostrar (y revertir) un movimiento completo —
 *    Etapa + Estado + Monto juntos. Partirlo rompe el "Deshacer".
 */
export async function logLeadChanges(leadId: number, before: Lead | null, after: Lead | null, autor: string): Promise<void> {
  if (!before || !after) return;
  const rows = AUDIT_FIELDS.flatMap(({ k, label }) => {
    const a = auditVal(before[k]);
    const b = auditVal(after[k]);
    return a === b ? [] : [{ lead_id: leadId, campo: label, valor_anterior: a, valor_nuevo: b, autor }];
  });
  if (!rows.length && !cambioDeEtapa(after, pipelineStageOf(before))) return;
  try {
    const db = await getTenantDb();
    // La etapa NO pasa por el anti-duplicado por ventana: ya tiene el suyo, exacto
    // (etapa_vista). Si pasara, un lead movido A→B→A→B en el mismo minuto perdería
    // la tercera línea por parecerse a la primera.
    const nuevas = await sinRepetidas(db, leadId, rows);
    // `after` viene de getLead (select *), así que trae la etapa_vista que ya
    // escribió una capa anterior de esta misma mutación; si no la trae (lead
    // armado a mano, o migración 0122 sin aplicar), cae a la etapa del `before`.
    const etapa = cambioDeEtapa(after, pipelineStageOf(before));
    if (etapa) nuevas.push({ lead_id: leadId, campo: CAMPO_ETAPA, valor_anterior: etapa.desde, valor_nuevo: etapa.hacia, autor });
    if (!nuevas.length) return;
    const { error } = await db.from('lead_audit').insert(nuevas);
    if (error) { console.error(`[audit] insert falló: ${error.message}`); return; }
    // La columna se mueve DESPUÉS de la línea: si esto falla, el peor caso es que
    // la pasada de los pendientes vuelva a detectar el cambio (una línea de más),
    // no que el cambio se pierda.
    if (etapa) await marcarEtapaVista([leadId], etapa.hacia);
  } catch (e) {
    console.error('[audit] insert excepción', e);
  }
}

type FilaAudit = { lead_id: number; campo: string; valor_anterior: string | null; valor_nuevo: string | null; autor: string };

/** Descarta las filas idénticas a una ya escrita hace segundos (mismo movimiento auditado dos veces). */
async function sinRepetidas(db: Awaited<ReturnType<typeof getTenantDb>>, leadId: number, rows: FilaAudit[]): Promise<FilaAudit[]> {
  if (!rows.length) return rows;
  const clave = (r: { campo: string; valor_anterior: string | null; valor_nuevo: string | null }) =>
    `${r.campo}|${r.valor_anterior ?? ''}|${r.valor_nuevo ?? ''}`;
  try {
    const { data, error } = await db
      .from('lead_audit')
      .select('campo, valor_anterior, valor_nuevo')
      .eq('lead_id', leadId)
      .gte('created_at', new Date(Date.now() - DEDUP_MS).toISOString());
    if (error) return rows; // ante la duda, mejor una línea de más que perder el rastro
    const ya = new Set((data ?? []).map((r) => clave(r as FilaAudit)));
    return rows.filter((r) => !ya.has(clave(r)));
  } catch {
    return rows;
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

  // #2: auto-asignar setter/closer al único vendedor (el que agendó/cerrará es él).
  const soloCal = await vendedorUnicoDelWorkspace();
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
    setter:                   soloCal ?? null,
    closer:                   soloCal ?? null,
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
export type VslEngagement = {
  plays: number;
  /** El mayor avance sobre CUALQUIER video. Sirve para ordenar y filtrar la
   *  lista; para la ficha del lead lo que vale es `porVideo`, porque «vio el
   *  80%» sin decir de QUÉ no significa nada cuando hay más de uno. */
  max_pct: number | null;
  sin_datos: boolean;
  porVideo: VideoEngagement[];
};

/**
 * Duración de cada VSL en segundos, según lo que el cron de Panda ya guarda en
 * marketing_metrics_daily (plataforma 'panda', raw_payload.duration_seconds).
 *
 * Es la pieza que faltaba para cerrar la mig 0121: el navegador manda `segundos`
 * (el dato crudo, siempre disponible) y el % se deriva ACÁ. Sin esto, un evento
 * medido en segundos no tenía con qué porcentuarse y la ficha mostraba "—".
 */
export async function getDuracionesVsl(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const supabase = await getTenantDb();
    const { data } = await supabase
      .from('marketing_metrics_daily')
      .select('video_id, raw_payload, fecha')
      .eq('plataforma', 'panda')
      .not('video_id', 'is', null)
      .order('fecha', { ascending: false })
      .limit(400);
    for (const r of (data ?? []) as Array<{ video_id: string | null; raw_payload: { duration_seconds?: number } | null }>) {
      const vid = r.video_id?.trim();
      const dur = Number(r.raw_payload?.duration_seconds);
      if (vid && !out.has(vid) && Number.isFinite(dur) && dur > 0) out.set(vid, dur);
    }
  } catch (e) {
    console.error('[getDuracionesVsl] falló:', e instanceof Error ? e.message : e);
  }
  return out;
}

/**
 * Cómo se resuelve la duración de cada evento, sabiendo QUÉ VIDEOS hay en juego.
 *
 * ⚠️ El respaldo de «la única duración conocida» era incondicional:
 *
 *     return durs.size === 1 ? [...durs.values()][0] : null;
 *
 * Con un solo video eso es correcto y resuelve un caso real (el `video_id` de
 * `vsl_events` no siempre coincide con el que reporta el cron de Panda). Con dos,
 * es un porcentaje INVENTADO: al testimonio de 40 s se le aplica la duración del
 * VSL de 20 minutos y su avance sale ~0% para siempre. Y se ve exactamente igual
 * que uno correcto — nadie lo revisa, ninguna pantalla lo dice.
 *
 * La regla: un respaldo que asume «hay uno solo» tiene que CHEQUEAR que haya uno
 * solo. Si no se sabe de qué video es la duración, se devuelve null y la pantalla
 * muestra «—», que es la verdad.
 */
function resolverDuracion(videosEnJuego: Set<string>, durs: Map<string, number>): (videoId: string | null | undefined) => number | null {
  const unica = durs.size === 1 ? [...durs.values()][0] : null;
  const hayUnoSolo = videosEnJuego.size <= 1;
  return (videoId) => {
    const v = videoId?.trim();
    if (v && durs.has(v)) return durs.get(v)!;
    return hayUnoSolo ? unica : null;
  };
}

/** Los video_id distintos que aparecen en un lote de eventos (ignora los vacíos). */
function videosDe(rows: Array<{ video_id: string | null }>): Set<string> {
  const s = new Set<string>();
  for (const r of rows) { const v = r.video_id?.trim(); if (v) s.add(v); }
  return s;
}

/** Lo que se midió de UN video, para poder mostrarlo aparte de los otros. */
export type VideoEngagement = {
  /** null = eventos que no se pudieron atribuir a ningún video (datos viejos). */
  videoId: string | null;
  /** El título que reportó el player, si lo había. El nombre que puso la persona
   *  lo resuelve la pantalla contra el catálogo `landing.videos`. */
  titulo: string | null;
  plays: number;
  maxPct: number | null;
};

export async function getVslEngagement(visitorId: string | null): Promise<VslEngagement> {
  if (!visitorId) return { plays: 0, max_pct: null, sin_datos: true, porVideo: [] };
  const supabase = (await getTenantDb());
  const [{ data, error }, durs] = await Promise.all([
    supabase.from('vsl_events').select('tipo_evento, porcentaje, event, segundos, video_id, vsl_titulo').eq('visitor_id', visitorId),
    getDuracionesVsl(),
  ]);
  if (error) {
    console.error(`[getVslEngagement] falló: ${error.message}`);
    return { plays: 0, max_pct: null, sin_datos: true, porVideo: [] };
  }
  const rows = (data ?? []) as Array<{ tipo_evento: string | null; porcentaje: number | null; event: string | null; segundos: number | null; video_id: string | null; vsl_titulo: string | null }>;
  const dur = resolverDuracion(videosDe(rows), durs);
  const esPlay = (r: { tipo_evento: string | null; event: string | null }) => r.tipo_evento === 'play' || r.event === 'vsl_play';

  // Un acumulador POR VIDEO. La clave es el id, con un balde aparte para lo que no
  // se pudo atribuir: esos eventos NO se tiran —son mediciones reales, de datos
  // anteriores a la v5 del snippet— pero tampoco se le suman a un video concreto,
  // que es como se contamina una curva sin que se note.
  const porVideo = new Map<string, VideoEngagement>();
  const balde = (r: { video_id: string | null; vsl_titulo: string | null }): VideoEngagement => {
    const id = r.video_id?.trim() || null;
    const k = id ?? '';
    let e = porVideo.get(k);
    if (!e) { e = { videoId: id, titulo: null, plays: 0, maxPct: null }; porVideo.set(k, e); }
    // El título del player puede venir en unos eventos y no en otros: se queda el
    // primero que llegue, en vez de pisarlo con null a mitad de camino.
    if (!e.titulo && r.vsl_titulo?.trim()) e.titulo = r.vsl_titulo.trim();
    return e;
  };

  for (const r of rows) {
    const e = balde(r);
    if (esPlay(r)) { e.plays++; continue; }
    // El avance sale de avanceDe(): usa el % si vino positivo y, si no, DERIVA el %
    // con los segundos + la duración de Panda (mig 0121). El 'play' se excluye: su
    // porcentaje 0 / segundos 0 es el centinela de "arrancó", no una medición.
    const p = avanceDe({ visitor_id: visitorId, tipo_evento: r.tipo_evento, porcentaje: r.porcentaje, segundos: r.segundos, video_id: r.video_id }, dur(r.video_id));
    if (typeof p === 'number' && p > 0) e.maxPct = Math.max(e.maxPct ?? 0, p);
  }

  const lista = [...porVideo.values()]
    // Los que tienen algo medido primero; entre esos, el que más se vio. Un video
    // que nadie reprodujo no puede encabezar la lista de lo que esta persona vio.
    .sort((a, b) => (b.maxPct ?? -1) - (a.maxPct ?? -1) || b.plays - a.plays);

  const plays = lista.reduce((n, e) => n + e.plays, 0);
  const avances = lista.map((e) => e.maxPct).filter((p): p is number => typeof p === 'number');
  return { plays, max_pct: avances.length > 0 ? Math.max(...avances) : null, sin_datos: false, porVideo: lista };
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
  const [{ data, error }, durs] = await Promise.all([
    supabase.from('vsl_events').select('visitor_id, tipo_evento, porcentaje, event, segundos, video_id').in('visitor_id', ids),
    getDuracionesVsl(),
  ]);
  if (error) {
    console.error(`[getVslEngagementMap] falló: ${error.message}`);
    return map;
  }
  type Fila = { tipo_evento: string | null; porcentaje: number | null; event: string | null; segundos: number | null; video_id: string | null };
  const porVisitor = new Map<string, Fila[]>();
  for (const r of (data ?? []) as Array<Fila & { visitor_id: string }>) {
    const arr = porVisitor.get(r.visitor_id) ?? [];
    arr.push(r);
    porVisitor.set(r.visitor_id, arr);
  }
  // ⚠️ Los videos en juego se cuentan sobre el LOTE ENTERO, no sobre las filas de
  // cada visitor. Es la mejor señal que hay acá de cuántos videos tiene este
  // negocio: si un visitor miró uno solo pero el workspace tiene dos, aplicarle
  // «la única duración conocida» sigue siendo inventar un porcentaje.
  const dur = resolverDuracion(videosDe((data ?? []) as Array<{ video_id: string | null }>), durs);
  for (const [vid, rows] of porVisitor) {
    const plays = rows.filter((r) => r.tipo_evento === 'play' || r.event === 'vsl_play').length;
    // Igual que getVslEngagement: % directo si vino positivo, o derivado de los
    // segundos con la duración de Panda. El play y el exit-en-0 no son medición.
    // Acá NO se desglosa por video: esta función alimenta la lista de leads, donde
    // la columna es un número por fila. El desglose vive en la ficha.
    const avances = rows
      .filter((r) => r.tipo_evento !== 'play' && r.event !== 'vsl_play')
      .map((r) => avanceDe({ visitor_id: vid, tipo_evento: r.tipo_evento, porcentaje: r.porcentaje, segundos: r.segundos, video_id: r.video_id }, dur(r.video_id)))
      .filter((p): p is number => typeof p === 'number' && p > 0);
    map.set(vid, { plays, max_pct: avances.length > 0 ? Math.max(...avances) : null, sin_datos: false, porVideo: [] });
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
// Lo que se PERSISTE es el pipeline (Activo) + las nutriciones suprimidas + cómo
// ENTRA el lead; el funnel completo (stages + transitions) se DERIVA con
// generateFunnel.
export type FunnelConfig = {
  stages: Stage[];
  transitions: FunnelTransition[];
  pipeline: Stage[];
  suppressed: string[];
  /** Cómo entra un lead. `[]` es NO DECLARADO y nunca afirma nada. */
  entradas: EntradaId[];
  /** El evento de fecha fija, si el canal tiene uno (el taller de todos los miércoles). */
  evento: EventoFunnel | null;
  /**
   * De dónde salió esto. Existe para que la PANTALLA pueda decir la verdad y para
   * que el PROMPT no afirme nada que no se declaró: con `origen !== 'declarado'`,
   * `entradas` viene vacío aunque el pipeline caiga al default.
   */
  origen: 'declarado' | 'sin-fila' | 'error';
};

function buildFunnel(
  pipeline: Stage[],
  suppressed: string[],
  extra?: { entradas?: EntradaId[]; evento?: EventoFunnel | null; origen?: FunnelConfig['origen'] },
): FunnelConfig {
  const { stages, transitions } = generateFunnel(pipeline, suppressed);
  return {
    stages, transitions, pipeline, suppressed,
    entradas: extra?.entradas ?? [],
    evento: extra?.evento ?? null,
    origen: extra?.origen ?? 'sin-fila',
  };
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
    // ⚠️ Los tres caminos que caen al default NO son el mismo. El pipeline sigue
    // cayendo a DEFAULT_PIPELINE porque una pantalla en blanco es peor que una
    // pantalla con el funnel más común — pero `origen` lo dice, y `entradas` queda
    // vacío, que es lo que impide que un prompt afirme «dejó sus datos en el
    // anuncio» sobre un cliente que nunca declaró nada (o sobre CUALQUIER cliente
    // durante una caída de Supabase, que era el caso peor).
    if (error) return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'error' });
    if (!data || !data.data) return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'sin-fila' });
    const cfg = data.data as Record<string, unknown>;
    const pipeline = sanearPipeline(cfg.pipeline) ?? DEFAULT_PIPELINE;
    const suppressed = Array.isArray(cfg.suppressed) ? cfg.suppressed.filter((s): s is string => typeof s === 'string') : [];
    return buildFunnel(pipeline, suppressed, {
      entradas: parseEntradas(cfg.entradas),
      evento: parseEvento(cfg.evento),
      origen: 'declarado',
    });
  } catch {
    return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'error' });
  }
}

/**
 * Guarda la config del funnel del workspace actual (una fila por workspace).
 *
 * ⚠️ MERGE, no reemplazo. Antes escribía `data: { pipeline, suppressed }` y con eso
 * BORRABA cualquier otra clave del jsonb — y el editor de /funnel autoguarda con un
 * debounce de 500 ms en cada tecla, así que alcanzaba con que alguien tocara una
 * etiqueta. `data.umbrales`, que `lib/crm-auto.ts` sí lee para los tiempos del CRM
 * automático, se borraba solo. Hoy ninguna fila lo tiene escrito (verificado en
 * prod: los 4 workspaces con fila tienen exactamente `pipeline` y `suppressed`), o
 * sea que era un lector sin escritor y el daño no había ocurrido todavía. Con
 * `entradas` y `evento` viviendo acá, dejaba de ser latente el primer día.
 */
export async function saveFunnel(
  pipeline: Stage[],
  suppressed: string[],
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = (await getTenantDb());
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const { data: actual } = await supabase.from('funnel_config').select('data').eq('workspace_id', ws).maybeSingle();
  const previo = actual?.data ?? {};
  const { error } = await supabase
    .from('funnel_config')
    .upsert(
      { id: ws, workspace_id: ws, data: mergeFunnelData(previo, pipeline, suppressed, extra), updated_at: new Date().toISOString() },
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
 * Quién firma un movimiento que no trae autor explícito: la persona logueada si
 * hay sesión, y si no MaKo — porque entonces lo movió el sistema (cron, webhook,
 * WhatsApp). Nunca lanza: en un cron no hay cookies que leer.
 */
async function autorDelMovimiento(explicito?: string): Promise<string> {
  if (explicito?.trim()) return explicito.trim();
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || AUTOR_SISTEMA;
  } catch {
    return AUTOR_SISTEMA;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Requisitos de un movimiento SIN formulario (MaKo, motor automático)
// ─────────────────────────────────────────────────────────────────────────────
// El wizard del CRM no deja mover un lead a una etapa cuyos requisitos no están
// cargados. Los callers que mueven sin pantalla (MaKo por WhatsApp, el motor del
// CRM automático, las opciones del modal de confirmaciones) no pasaban por ahí:
// dejaban leads en etapas con datos incompletos que la UI jamás habría permitido
// —un "Ganado" sin monto, un "Perdido" sin motivo— y esos leads reaparecían en el
// worklist sin que nadie supiera quién los movió.
//
// Acá vive lo que necesita ese caller: los faltantes calculados SOLO con el lead.

/** Datos que el caller aporta EN ESTE movimiento (los que todavía no están en la fila). */
export type AportadoAlMover = {
  monto?: number | null;
  /** Motivo de ESTE movimiento (el `motivo_perdida` guardado puede ser de una pérdida anterior). */
  motivo?: string | null;
  asistioJ1?: boolean | null;
  asistioJ2?: boolean | null;
  hoyISO?: string;
  /** ¿Se espera grabación de este encuentro? De `encuentroGrabable()`. Sin esto,
   *  quien cierra en persona no puede mover un lead sin inventar un link de Fathom. */
  grabable?: boolean;
};

/**
 * Qué le falta a este lead para poder MOVERSE a `stageKey`.
 *
 * Misma fuente que el CRM (`stepsForStage`), evaluada con la etapa DESTINO y la
 * etapa de origen VIGENTE — no con la etapa actual, que es lo que mira
 * `faltantesDeLead`. La higiene (setter/closer/empresa/teléfono) va en undefined
 * a propósito: nunca gatea un movimiento, ni acá ni en el wizard.
 *
 * `pipeline` son las etapas GENERADAS del workspace (getPipelineStages / los
 * `stages` del funnel), no el pipeline crudo: el nivel de requisitos se deriva de
 * `kind`, y una lista de etapas sin kind hace pasar cualquier movimiento.
 *
 * PENDIENTE (una cosa, un lugar): `valoresDeRequisitos` en app/crm/actions.ts es
 * el superset de esto —los mismos valores más lo que el wizard acaba de tipear y
 * los pagos ya cargados— y debería construirse sobre esta función. Quedó fuera
 * del alcance de este cambio: tocarla es tocar el camino que usa toda la UI.
 */
export function faltantesParaMover(
  lead: Lead,
  stageKey: string,
  pipeline?: readonly Stage[] | null,
  aportado: AportadoAlMover = {},
): Step[] {
  const stages = pipeline && pipeline.length ? pipeline : undefined;
  const info = stages ? funnelReqInfo(stages as Stage[], stageKey) : undefined;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url?.trim());
  return stepsForStage(stageKey, {
    nivel: info?.nivel,
    numReuniones: info?.numReuniones,
    esVenta: info?.esVenta,
    fechaJ1: lead.fecha_junta_1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ1: aportado.asistioJ1 ?? lead.asistio_j1,
    asistioJ2: aportado.asistioJ2 ?? lead.asistio_j2,
    calificado: lead.calificado,
    hasFathomUrl: links.length > 0,
    grabable: aportado.grabable,
    monto: aportado.monto ?? lead.monto_cierre_usd,
    // Venta recurrente: el importe vive en el MRR y `monto_cierre_usd` queda null.
    suscripcionMonto: lead.venta_tipo === 'suscripcion' ? (lead.suscripcion_monto_usd ?? null) : null,
    // Partido en dos: el guardado puede ser de una pérdida ANTERIOR y no da por
    // contestada la de ahora. Quien decide es stepsForStage con `etapaActual`.
    motivo: lead.motivo_perdida,
    motivoNuevo: aportado.motivo ?? null,
    // De dónde viene: la etapa EFECTIVA (override chequeado contra el funnel),
    // la misma que usa la ficha. Con el override crudo, los cientos de leads
    // apuntando a etapas que su funnel ya no tiene se evalúan contra un fantasma.
    etapaActual: etapaVigenteDe(lead, stages),
    hoyISO: aportado.hoyISO ?? hoyEnTijuana(),
    atJ1: lead.junta_1_at,
    atJ2: lead.junta_2_at,
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
    // `tienePlan` queda undefined (= no se exige): las cuotas viven en otro
    // módulo y este camino no las lee. El gate duro de una venta es el monto.
  });
}

/**
 * El movimiento no se hizo porque faltan datos. NO es un fallo del sistema: es una
 * respuesta esperable del negocio, y por eso viaja tipada (con la lista de pasos)
 * en vez de como un Error genérico que el caller solo puede loguear.
 */
export class RequisitosFaltantesError extends Error {
  readonly leadId: number;
  readonly stageKey: string;
  readonly faltan: Step[];
  constructor(leadId: number, stageKey: string, faltan: Step[]) {
    super(`Faltan datos para mover el lead ${leadId} a "${stageKey}": ${faltan.map((f) => f.label).join(', ')}.`);
    this.name = 'RequisitosFaltantesError';
    this.leadId = leadId;
    this.stageKey = stageKey;
    this.faltan = faltan;
  }
}

export const esRequisitosFaltantes = (e: unknown): e is RequisitosFaltantesError => e instanceof RequisitosFaltantesError;

/**
 * Mueve un lead a una etapa del tablero. Persiste el override `pipeline_stage`
 * y, en desenlaces terminales, sincroniza estado_lead (vía updateLead) para que
 * Revenue/CAPI sigan correctos. Para "ganado" exige monto.
 *
 * TODO movimiento queda en el historial, lo haga quien lo haga: antes esto era un
 * UPDATE mudo y los ocho callers (el motor automático, MaKo por WhatsApp, el
 * desenlace de las nutriciones, el bloqueo de un contacto…) movían leads sin
 * dejar una línea. Ahora audita acá, en el choke point, y no en cada caller.
 */
export async function setPipelineStage(
  id: number,
  stageKey: string,
  opts?: {
    monto?: number | null; motivo?: string | null;
    asistio_j1?: boolean | null; asistio_j2?: boolean | null; deadline?: string | null;
    /** Quién lo movió. Sin esto se resuelve solo: sesión → persona, sin sesión → MaKo. */
    autor?: string;
    /**
     * Qué hacer con los requisitos de la etapa destino. Los movimientos que vienen
     * de un formulario NO lo mandan: el wizard del CRM ya validó con los datos que
     * la persona acaba de tipear (y revalidar acá pediría de nuevo lo que todavía
     * no está persistido). Un movimiento SIN formulario tiene que elegir:
     *   · 'validar'          → si falta algo, NO mueve: lanza RequisitosFaltantesError.
     *   · { omitir: motivo } → mueve igual y el motivo queda en el historial. Es para
     *     los movimientos automáticos legítimos (nadie a quien preguntarle), nunca
     *     para tapar un requisito: si se saltea, se saltea DICIÉNDOLO.
     */
    requisitos?: 'validar' | { omitir: string };
  },
): Promise<void> {
  const supabase = (await getTenantDb());
  const estado = terminalEstadoFor(stageKey);
  const antes = await getLead(id);

  // 0) Requisitos. Va ANTES de cualquier escritura: un movimiento rechazado no
  //    puede dejar el estado_lead ya sincronizado con la etapa a la que no llegó.
  // Un salteo SIN motivo no es un salteo declarado: se valida igual (fail closed).
  // Si no, `{ omitir: '' }` sería el mismo agujero de antes, pero con tipos.
  const omitido = typeof opts?.requisitos === 'object' ? opts.requisitos.omitir.trim() : '';
  if (opts?.requisitos && !omitido) {
    // Sin poder leer el lead no hay nada contra qué validar: cortamos. Mover a
    // ciegas es justamente lo que este parámetro existe para impedir.
    if (!antes) throw new Error(`No se pudo leer el lead ${id} para validar los requisitos de "${stageKey}".`);
    // Las etapas GENERADAS (las mismas que mira el wizard): son las que traen
    // `kind`, y sin kind no hay nivel de requisitos — una lista pelada dejaría
    // pasar cualquier movimiento sin que nada avise.
    const stages = await getPipelineStages().catch(() => generateFunnel(DEFAULT_PIPELINE, []).stages);
    const faltan = faltantesParaMover(antes, stageKey, stages, {
      monto: opts.monto, motivo: opts.motivo,
      asistioJ1: opts.asistio_j1, asistioJ2: opts.asistio_j2,
    });
    if (faltan.length) throw new RequisitosFaltantesError(id, stageKey, faltan);
  }

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

  // 3) El rastro. Va el diff COMPLETO (etapa + estado + monto + motivo +
  //    asistencias) en una sola escritura para que la ficha lo muestre —y lo
  //    revierta— como un movimiento único. Si el caller vuelve a auditar después
  //    con su propio `before`, logLeadChanges descarta lo repetido.
  const autor = await autorDelMovimiento(opts?.autor);
  await logLeadChanges(id, antes, await getLead(id), autor);

  // 4) Si el movimiento se salteó los requisitos, el POR QUÉ va al historial junto
  //    al movimiento. Sin esta línea el salteo es indistinguible de un movimiento
  //    validado y el lead reaparece incompleto sin que nadie sepa por qué.
  if (omitido) {
    await logLeadEvent(id, 'Etapa sin validar', `Movido a "${stageKey}" sin validar los requisitos: ${omitido}`, autor);
  }

  void actualizarEtiquetaLead(id).catch(() => {}); // etiqueta WA por etapa (best-effort; cubre 'manual')
}

/**
 * Mover un lead desde un proceso AUTOMÁTICO — el motor del CRM (`lib/crm-auto`)
 * y el desenlace de las nutriciones (`lib/nutricion-desenlace`). Los dos son
 * crons: nadie está mirando y no hay a quién preguntarle si falta un dato.
 *
 * La regla es UNA sola para los dos, y por eso vive acá y no copiada en cada
 * cron: si falta algo, NO se mueve y el porqué queda escrito en el historial del
 * lead. Un movimiento automático que falla en silencio es lo peor de los dos
 * mundos — el desenlace se registró (la inscripción quedó sellada como
 * lograda/fallida) pero el lead se quedó en una etapa que ya no describe su
 * situación, y no hay una línea que lo explique. En el desenlace ese error se
 * iba a un `console.error` que no lee nadie.
 *
 * Se valida aunque hoy casi ningún destino automático tenga requisitos: el
 * funnel es configurable por workspace, y el día que un cliente le ponga un
 * requisito a una de esas etapas, el cron no puede ser el único camino que los
 * ignora.
 *
 * Devuelve false = no se movió, y el caller NO puede anunciar el cambio.
 */
export async function moverLeadAuto(
  leadId: number,
  to: string,
  opts: {
    /** Con qué nombre aparece el proceso en la línea del historial ("CRM automático", "Nutrición"). */
    canal: string;
    /** Autor del movimiento. Sin esto se resuelve solo (sin sesión → MaKo). */
    autor?: string;
    motivo?: string | null;
    asistio_j1?: boolean | null;
    asistio_j2?: boolean | null;
  },
): Promise<boolean> {
  const { canal, ...resto } = opts;
  try {
    await setPipelineStage(leadId, to, { ...resto, requisitos: 'validar' });
    return true;
  } catch (e) {
    // Solo "faltan datos" es un desenlace esperable del negocio. Cualquier otro
    // error (red, permisos, invariante rota) se propaga: confundirlos dejaría un
    // fallo real disfrazado de "le faltaba el monto".
    if (!esRequisitosFaltantes(e)) throw e;
    await logLeadEvent(leadId, canal, `No lo moví a "${to}": falta cargar ${e.faltan.map((f) => f.label).join(', ')}`, opts.autor);
    return false;
  }
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
  extra?: { comprobantesFaltantes?: number; r2RespuestasOk?: boolean; pipeline?: Stage[]; grabable?: boolean },
): Step[] {
  // El override manual (pipeline_stage) vale SOLO si esa etapa sigue existiendo en
  // el funnel del workspace; si no, se deriva del estado del lead — la misma regla
  // que usa el board (crm-map). Sin este chequeo, un lead parado en una etapa que
  // ya no existe se evaluaba contra una etapa fantasma y NO se le exigía nada:
  // medido en ws1, 686 leads en 'reactivacion' / 'noshow_r1' (etapas que su funnel
  // no tiene) quedaban fuera de "datos sin marcar" aunque el Kanban los mostrara.
  const override = lead.pipeline_stage?.trim();
  const vigente = !override || !extra?.pipeline || extra.pipeline.some((s) => s.key === override);
  const stage = override && vigente ? override : deriveStageKey(lead);
  // Si el caller pasa el funnel del workspace, derivamos nivel/reuniones/venta de
  // SU pipeline (funnels no-default); si no, stepsForStage cae al funnel default.
  const info = extra?.pipeline ? funnelReqInfo(extra.pipeline, stage) : undefined;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);
  const oblig = lead.deal_obligaciones;
  const tieneR2 = !!lead.fecha_junta_2 || lead.asistio_j2 != null;
  // Un lead en NUTRICIÓN (no agendó / se enfrió / manual) es un contacto frío: no
  // tiene sentido exigirle "Empresa" como dato sin marcar. undefined → se saltea.
  const enNutricion = NUTRI_KEYS.includes(stage);
  return stepsForStage(stage, {
    fechaJ1: lead.fecha_junta_1,
    asistioJ1: lead.asistio_j1,
    calificado: lead.calificado,
    fechaJ2: lead.fecha_junta_2,
    asistioJ2: lead.asistio_j2,
    hasFathomUrl: links.length > 0,
    grabable: extra?.grabable,
    monto: lead.monto_cierre_usd,
    // Venta recurrente: el importe vive en el MRR y `monto_cierre_usd` queda null.
    suscripcionMonto: lead.venta_tipo === 'suscripcion' ? (lead.suscripcion_monto_usd ?? null) : null,
    motivo: lead.motivo_perdida,
    setter: lead.setter,
    closer: lead.closer,
    telefono: lead.telefono,
    empresa: enNutricion ? undefined : lead.empresa,
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
    // Una suscripción ES su plan (el monto mensual), aunque no tenga ni una cuota
    // cargada: el mismo criterio que el wizard (`valoresDeRequisitos`). Sin esto,
    // un cierre recurrente movido con éxito reaparecía al toque en "Datos sin
    // marcar" pidiendo un plan de pagos que no existe para esa venta.
    tienePlan: lead.venta_tipo === 'suscripcion' ? undefined : tienePlan,
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
