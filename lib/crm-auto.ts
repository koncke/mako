// =============================================================================
// CRM automático — motor de auto-transiciones (MaKo mueve el lead solo)
// =============================================================================
// Planificador PURO (planLeadAuto): dado un lead + hoy, devuelve las acciones que
// MaKo propondría (mover de etapa, revisar Fathom/WhatsApp). No escribe nada: el
// cron /api/cron/crm-automatico las MUESTRA (dry-run) o —cuando se cablee la fase
// de aplicación— las ejecuta con red de confirmación.
//
// Reglas (ver AUTO_REGLAS en lib/pipeline.ts para la versión legible):
//   T1  reunión pasada sin marcar   → revisar Fathom (asistió / No Show R1·R2)
//   T2  Lead estancado sin agendar  → Nutrición - No Agenda
//   T3  Nutrición manual vencida    → revisar WhatsApp (No responde/Perdido | Datos sin marcar)
//   T6  frío hace X días            → Nutrición - Reactivación
// (T4 "R2 → Facturando" queda cubierto por T1 sobre la R2 + la derivación del
//  funnel; T5 "completar datos sin marcar" es la fase de resolución del commit.)
// =============================================================================

import 'server-only';

import type { EstadoLead } from './leads';
import { getLead, updateLead, setPipelineStage, applyFathomRecording, logLeadEvent } from './leads';
import { pipelineStageOf } from './pipeline';
import { getTenantDb, runWithWorkspace, listarWorkspaces, OWNER_WS } from './workspace';
import { hoyEnTijuana } from './date-utils';
import { buscarReunionesAutomatico } from './auto-reuniones';
import { contactoIdPorTelefono, getContactMessages } from './chatwoot';
import { crearConfirmacion, existeConfirmacion, type CrearConfirmacionInput } from './mako-confirmaciones';

// Umbrales del motor. Por ahora fijos; se harán configurables desde la tab Funnel
// (funnel_config) para que cada negocio ajuste sus tiempos.
export const AUTO_UMBRALES = { diasLeadSinAgenda: 2, diasReactivacion: 30, horasPostReunion: 3 };

export type AutoReglaId = 'T1' | 'T2' | 'T3' | 'T6';

export type AutoAccion = {
  regla: AutoReglaId;
  tipo: 'reunion_check' | 'lead_a_nutri' | 'manual_vencida' | 'reactivacion';
  leadId: number;
  lead: string;                       // nombre legible
  descripcion: string;                // qué haría MaKo (para el dry-run y el historial)
  confirmar: boolean;                 // true = pide confirmación al entrar al CRM
  which?: 'j1' | 'j2';                // T1: qué reunión revisar
  resolver?: 'fathom' | 'chat';       // trabajo async que hace el commit (fase 2)
  move?: { to: string };              // destino directo (T2 / T6)
};

// Subconjunto del lead que necesita el planificador (barato de traer).
export type AutoLead = {
  id: number;
  nombre: string | null;
  estado_lead: EstadoLead;
  pipeline_stage: string | null;
  fecha_agenda: string | null;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  junta_1_at: string | null;
  junta_2_at: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  nutricion_realizada?: boolean;
  nutricion_manual_deadline: string | null;
  created_at: string;
  updated_at: string | null;
};

/** Días enteros entre una fecha/ISO pasada y hoy (0 si falta la fecha). */
function diasEntre(hoyISO: string, isoAntes: string | null): number {
  if (!isoAntes) return 0;
  const [ay, am, ad] = isoAntes.slice(0, 10).split('-').map(Number);
  const [hy, hm, hd] = hoyISO.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(hy, hm - 1, hd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Reglas del CRM automático para UN lead (puro, sin efectos). Devuelve las
 * acciones que MaKo propondría hoy. El cron las muestra (dry-run) o las aplica.
 *
 * Nota T1: hoy fecha_junta_* guarda el DÍA (no la hora — el webhook de Calendly la
 * descarta). Por eso disparamos cuando el día de la reunión ya pasó (< hoy), que
 * es seguro (la grabación de Fathom aparece después de la llamada). Al persistir
 * junta_1_at/junta_2_at con hora se podrá afinar al "3 h después" exacto.
 */
export function planLeadAuto(l: AutoLead, hoyISO: string, nowMs: number = Date.now()): AutoAccion[] {
  const out: AutoAccion[] = [];
  const nombre = l.nombre?.trim() || `Lead ${l.id}`;
  const hoy = hoyISO.slice(0, 10);
  const stage = pipelineStageOf(l);

  // ¿La reunión ya pasó lo suficiente para revisar Fathom? Con hora exacta
  // (junta_*_at) dispara a las N horas EXACTAS después; sin ella (leads viejos),
  // cuando el día de la reunión ya pasó.
  const reunionPasada = (fechaAt: string | null, fecha: string | null): boolean =>
    fechaAt ? nowMs >= Date.parse(fechaAt) + AUTO_UMBRALES.horasPostReunion * 3600000
            : !!fecha && fecha.slice(0, 10) < hoy;

  if (l.estado_lead === 'abierto') {
    // T1 — reunión pasada sin asistencia marcada → revisar Fathom.
    const r1 = l.fecha_junta_1 ?? l.fecha_agenda;
    if (l.asistio_j1 == null && reunionPasada(l.junta_1_at, r1)) {
      out.push({
        regla: 'T1', tipo: 'reunion_check', leadId: l.id, lead: nombre, which: 'j1', resolver: 'fathom', confirmar: true,
        descripcion: `R1 del ${r1?.slice(0, 10) ?? l.junta_1_at?.slice(0, 10) ?? 'la fecha agendada'} sin marcar → buscar grabación en Fathom: si aparece asistió (marca todo), si no No Show R1`,
      });
    } else if (l.asistio_j1 === true && l.fecha_junta_2 && l.asistio_j2 == null && reunionPasada(l.junta_2_at, l.fecha_junta_2)) {
      out.push({
        regla: 'T1', tipo: 'reunion_check', leadId: l.id, lead: nombre, which: 'j2', resolver: 'fathom', confirmar: true,
        descripcion: `R2 del ${l.fecha_junta_2.slice(0, 10)} sin marcar → buscar grabación en Fathom: si aparece asistió → Facturando, si no No Show R2`,
      });
    }

    // T2 — Lead estancado en el instant form → Nutrición No Agenda.
    if (stage === 'lead' && !l.fecha_agenda && !l.fecha_junta_1) {
      const d = diasEntre(hoy, l.created_at);
      if (d >= AUTO_UMBRALES.diasLeadSinAgenda) {
        out.push({
          regla: 'T2', tipo: 'lead_a_nutri', leadId: l.id, lead: nombre, confirmar: false, move: { to: 'nutri' },
          descripcion: `${d} días en Instant form sin agendar → Nutrición - No Agenda`,
        });
      }
    }

    // T3 — Nutrición manual vencida → revisar WhatsApp para decidir el desenlace.
    if (l.pipeline_stage === 'manual' && l.nutricion_manual_deadline && l.nutricion_manual_deadline.slice(0, 10) < hoy) {
      out.push({
        regla: 'T3', tipo: 'manual_vencida', leadId: l.id, lead: nombre, resolver: 'chat', confirmar: true,
        descripcion: `Nutrición manual vencida el ${l.nutricion_manual_deadline.slice(0, 10)} → revisar chat: con mensajes = No responde/Perdido, sin mensajes = Datos sin marcar`,
      });
    }
  }

  // T6 — Reactivación de fríos (No responde / Perdido) tras un tiempo enfriados.
  if ((l.estado_lead === 'no_responde' || l.estado_lead === 'perdido') && l.pipeline_stage !== 'reactivacion') {
    const d = diasEntre(hoy, l.updated_at ?? l.created_at);
    if (d >= AUTO_UMBRALES.diasReactivacion) {
      const et = l.estado_lead === 'no_responde' ? 'No responde' : 'Perdido';
      out.push({
        regla: 'T6', tipo: 'reactivacion', leadId: l.id, lead: nombre, confirmar: true, move: { to: 'reactivacion' },
        descripcion: `${et} hace ${d} días → Nutrición - Reactivación (re-contacto)`,
      });
    }
  }

  return out;
}

const AUTO_COLS =
  'id, nombre, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_realizada, nutricion_manual_deadline, created_at, updated_at';

export type AutoEvalWs = { acciones: AutoAccion[]; totalLeads: number; porRegla: Record<string, number> };

/** Evalúa el CRM automático para el workspace ACTUAL (dry-run puro, no escribe). */
export async function evaluarAutoWorkspace(hoyISO: string = hoyEnTijuana()): Promise<AutoEvalWs> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('leads').select(AUTO_COLS);
  if (error) throw new Error(`crm-auto evaluar: ${error.message}`);
  const leads = (data ?? []) as AutoLead[];
  const nowMs = Date.now();
  const acciones = leads.flatMap((l) => planLeadAuto(l, hoyISO, nowMs));
  const porRegla = acciones.reduce<Record<string, number>>((a, x) => { a[x.regla] = (a[x.regla] ?? 0) + 1; return a; }, {});
  return { acciones, totalLeads: leads.length, porRegla };
}

export type AutoEvalTodos = { ws: number; ok: boolean; error?: string } & Partial<AutoEvalWs>;

/** Evalúa el CRM automático para TODOS los workspaces activos (dry-run). */
export async function evaluarAutoTodos(hoyISO: string = hoyEnTijuana()): Promise<AutoEvalTodos[]> {
  let workspaces: Array<{ id: number; estado?: string }>;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch {
    workspaces = [{ id: OWNER_WS }];
  }
  const out: AutoEvalTodos[] = [];
  for (const w of workspaces) {
    try {
      const r = await runWithWorkspace(w.id, () => evaluarAutoWorkspace(hoyISO));
      out.push({ ws: w.id, ok: true, ...r });
    } catch (e) {
      out.push({ ws: w.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// APLICACIÓN — MaKo ejecuta las acciones (mueve el lead + red de confirmación)
// ─────────────────────────────────────────────────────────────────────────────
// Los "auto" (T2) se aplican y quedan en el historial. Los "confirma" (T1/T3/T6)
// se aplican TAMBIÉN, pero dejan una fila en mako_confirmaciones para que el
// humano confirme o revierta al entrar al CRM. Solo corre en modo commit del cron.

// T1/T3 pegan a APIs externas (Fathom/Chatwoot): acotamos por corrida para no
// pasarnos del maxDuration del cron. Los "auto" (T2) son baratos: se aplican todos.
const MAX_EXTERNAS_POR_CORRIDA = 25;

/**
 * Registra la confirmación y, si el insert falla (dejaría una mutación huérfana
 * sin fila para revisar/revertir), COMPENSA deshaciendo el cambio recién aplicado
 * con su patch revert. Así apply-then-confirm nunca deja un cambio automático que
 * el humano no pueda ver ni deshacer desde el modal.
 */
async function confirmarOCompensar(leadId: number, input: CrearConfirmacionInput): Promise<'auto' | 'confirma' | 'skip'> {
  const ok = await crearConfirmacion(input);
  if (ok) return 'confirma';
  const rev = input.revert;
  if (input.aplicado && rev && Object.keys(rev).length) {
    try {
      const patch: Record<string, unknown> = { ...rev };
      delete patch.fathom_remove_url; // sentinela, no es columna
      if (Object.keys(patch).length) await (await getTenantDb()).from('leads').update(patch).eq('id', leadId);
    } catch (e) {
      console.error(`[crm-auto] compensar revert lead ${leadId} falló:`, e);
    }
  }
  return 'skip';
}

async function aplicarAccion(a: AutoAccion): Promise<'auto' | 'confirma' | 'skip'> {
  const lead = await getLead(a.leadId);
  if (!lead) return 'skip';

  // T2 — Lead estancado → Nutrición No Agenda (auto, sin confirmación).
  if (a.tipo === 'lead_a_nutri') {
    if (pipelineStageOf(lead) !== 'lead') return 'skip'; // cambió desde la evaluación
    await setPipelineStage(a.leadId, 'nutri');
    await logLeadEvent(a.leadId, 'CRM automático', `T2: → Nutrición - No Agenda (${a.descripcion})`, 'MaKo');
    return 'auto';
  }

  // T6 — Frío → Reactivación (aplica + confirmación, revert al estado previo).
  if (a.tipo === 'reactivacion') {
    if (lead.pipeline_stage === 'reactivacion') return 'skip';
    if (await existeConfirmacion(a.leadId, 'T6')) return 'skip';
    const prevEstado = lead.estado_lead;
    const prevStage = lead.pipeline_stage ?? null;
    const prevMotivo = lead.motivo_perdida ?? null; // updateLead lo nulifica al reabrir → restaurarlo en el revert
    await setPipelineStage(a.leadId, 'reactivacion');
    return confirmarOCompensar(a.leadId, {
      leadId: a.leadId, leadNombre: lead.nombre, regla: 'T6', tipo: a.tipo, clave: 'T6',
      titulo: `Reactivación de ${lead.nombre ?? 'lead'}`,
      detalle: a.descripcion, aplicado: true,
      cambios: [{ campo: 'Etapa', antes: prevEstado === 'no_responde' ? 'No responde' : 'Perdido', despues: 'Nutrición - Reactivación' }],
      revert: { estado_lead: prevEstado, pipeline_stage: prevStage, motivo_perdida: prevMotivo },
    });
  }

  // T1 — Reunión pasada → busca en Fathom: asistió (marca) o No Show.
  if (a.tipo === 'reunion_check') {
    const which = a.which ?? 'j1';
    const clave = `T1:${which}`;
    if (await existeConfirmacion(a.leadId, clave)) return 'skip'; // ya resuelta/pendiente (anti-loop)
    const asistField = which === 'j1' ? 'asistio_j1' : 'asistio_j2';
    const prevAsist = which === 'j1' ? lead.asistio_j1 : lead.asistio_j2;
    if (prevAsist != null) return 'skip'; // ya lo marcó un humano entre medio
    const prevStage = lead.pipeline_stage ?? null;
    const prevFechaJ1 = lead.fecha_junta_1;
    const auto = await buscarReunionesAutomatico(lead);
    const fathom = which === 'j1' ? auto.fathomR1 : auto.fathomR2;
    const asistio = which === 'j1' ? auto.asistioJ1 : auto.asistioJ2;

    if (fathom) {
      // R1 sin fecha_junta_1 (solo tenía fecha_agenda): fijamos la fecha real primero,
      // si no updateLead nulifica la asistencia por su regla de coherencia.
      if (which === 'j1' && !lead.fecha_junta_1) {
        const fechaR1 = auto.fechaJ1 ?? lead.fecha_agenda;
        if (fechaR1) { await updateLead(a.leadId, { fecha_junta_1: fechaR1 }); lead.fecha_junta_1 = fechaR1; }
      }
      const { addedLink } = await applyFathomRecording(lead, which, fathom.url, asistio);
      const revert: Record<string, unknown> = { [asistField]: prevAsist, pipeline_stage: prevStage };
      if (which === 'j1' && prevFechaJ1 !== lead.fecha_junta_1) revert.fecha_junta_1 = prevFechaJ1;
      if (addedLink) revert.fathom_remove_url = fathom.url; // revert quirúrgico: quita solo este link, no pisa el array
      return confirmarOCompensar(a.leadId, {
        leadId: a.leadId, leadNombre: lead.nombre, regla: 'T1', tipo: a.tipo, clave,
        titulo: `Asistencia ${which === 'j1' ? 'R1' : 'R2'} de ${lead.nombre ?? 'lead'}`,
        detalle: a.descripcion, aplicado: true,
        cambios: [
          { campo: which === 'j1' ? 'Asistió R1' : 'Asistió R2', antes: 'Sin marcar', despues: 'Sí (grabación en Fathom)' },
          { campo: 'Grabación Fathom', antes: null, despues: fathom.label || 'agregada' },
        ],
        revert,
      });
    }
    // Sin grabación → No Show.
    await setPipelineStage(a.leadId, which === 'j1' ? 'noshow_r1' : 'noshow_r2', which === 'j1' ? { asistio_j1: false } : { asistio_j2: false });
    return confirmarOCompensar(a.leadId, {
      leadId: a.leadId, leadNombre: lead.nombre, regla: 'T1', tipo: a.tipo, clave,
      titulo: `No Show ${which === 'j1' ? 'R1' : 'R2'} de ${lead.nombre ?? 'lead'}`,
      detalle: a.descripcion, aplicado: true,
      cambios: [{ campo: which === 'j1' ? 'Asistió R1' : 'Asistió R2', antes: 'Sin marcar', despues: 'No asistió → No Show' }],
      revert: { [asistField]: prevAsist, pipeline_stage: prevStage },
    });
  }

  // T3 — Nutrición manual vencida → revisar WhatsApp para decidir.
  if (a.tipo === 'manual_vencida') {
    if (lead.pipeline_stage !== 'manual') return 'skip';
    if (await existeConfirmacion(a.leadId, 'T3')) return 'skip'; // ya resuelta/pendiente (anti-loop)
    let inbound = 0;
    try {
      const tel = lead.telefono ?? lead.telefono_normalizado;
      if (tel) {
        const cid = await contactoIdPorTelefono(tel);
        if (cid) {
          const msgs = await getContactMessages(cid);
          inbound = msgs.filter((m) => m.messageType === 0).length;
        }
      }
    } catch {
      inbound = -1; // no se pudo consultar el chat (fallo transitorio de Chatwoot)
    }

    // Fallo transitorio de Chatwoot: NO clasificamos ni marcamos nada; que la
    // próxima corrida reintente (sin quemar el cupo anti-loop de T3).
    if (inbound === -1) return 'skip';

    if (inbound > 0) {
      // Hubo conversación → No responde (con opción a Perdido).
      const prevStage = lead.pipeline_stage ?? null;
      const prevEstado = lead.estado_lead;
      const prevDeadline = lead.nutricion_manual_deadline ?? null;
      await setPipelineStage(a.leadId, 'noresp');
      return confirmarOCompensar(a.leadId, {
        leadId: a.leadId, leadNombre: lead.nombre, regla: 'T3', tipo: a.tipo, clave: 'T3',
        titulo: `Nutrición manual vencida — ${lead.nombre ?? 'lead'}`,
        detalle: `${inbound} mensaje(s) del lead en WhatsApp → clasificado como No responde. Si desistió, marcalo Perdido.`,
        aplicado: true,
        cambios: [{ campo: 'Etapa', antes: 'Nutrición - Manual', despues: 'No responde' }],
        revert: { estado_lead: prevEstado, pipeline_stage: prevStage, nutricion_manual_deadline: prevDeadline },
        opciones: [{ key: 'perdido', label: 'Marcar Perdido', stage: 'perdido', tone: 'danger' }],
      });
    }
    // inbound === 0 → sin mensajes reales; no cambia nada, pide decidir.
    return confirmarOCompensar(a.leadId, {
      leadId: a.leadId, leadNombre: lead.nombre, regla: 'T3', tipo: a.tipo, clave: 'T3',
      titulo: `Nutrición manual vencida — ${lead.nombre ?? 'lead'}`,
      detalle: 'Sin mensajes del lead en WhatsApp. Decidí el desenlace o dejalo para completar los datos.',
      aplicado: false,
      cambios: [],
      opciones: [
        { key: 'noresp', label: 'No responde', stage: 'noresp', tone: 'neutral' },
        { key: 'perdido', label: 'Perdido', stage: 'perdido', tone: 'danger' },
        { key: 'dejar', label: 'Dejar para completar datos', stage: null, tone: 'neutral' },
      ],
    });
  }

  return 'skip';
}

export type AplicarResult = { ws: number; ok: boolean; error?: string; auto?: number; confirmaciones?: number; restantes?: number };

/** Aplica las acciones del CRM automático en el workspace ACTUAL (modo commit). */
export async function aplicarAutoWorkspace(hoyISO: string = hoyEnTijuana()): Promise<AplicarResult> {
  const { acciones } = await evaluarAutoWorkspace(hoyISO);
  let auto = 0, confirmaciones = 0, externas = 0, restantes = 0;
  for (const a of acciones) {
    const esExterna = a.tipo === 'reunion_check' || a.tipo === 'manual_vencida';
    if (esExterna && externas >= MAX_EXTERNAS_POR_CORRIDA) { restantes++; continue; }
    try {
      const r = await aplicarAccion(a);
      if (r === 'auto') auto++;
      else if (r === 'confirma') confirmaciones++;
      if (esExterna) externas++;
    } catch (e) {
      console.error(`[crm-auto] aplicar lead ${a.leadId} (${a.regla}) falló:`, e);
    }
  }
  return { ws: 0, ok: true, auto, confirmaciones, restantes };
}

/** Aplica el CRM automático en TODOS los workspaces activos (modo commit del cron). */
export async function aplicarAutoTodos(hoyISO: string = hoyEnTijuana()): Promise<AplicarResult[]> {
  let workspaces: Array<{ id: number; estado?: string }>;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch {
    workspaces = [{ id: OWNER_WS }];
  }
  const out: AplicarResult[] = [];
  for (const w of workspaces) {
    try {
      const r = await runWithWorkspace(w.id, () => aplicarAutoWorkspace(hoyISO));
      out.push({ ...r, ws: w.id });
    } catch (e) {
      out.push({ ws: w.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
