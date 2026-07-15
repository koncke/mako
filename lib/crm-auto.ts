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
//   T2  Lead sin agendar            → Nutrición - No Agenda (reciente) · Reactivación (frío)
//   T3  Nutrición manual vencida    → revisar WhatsApp (No responde/Perdido | Datos sin marcar)
//   T6  frío hace X días            → Nutrición - Reactivación
// (T4 "R2 → Facturando" queda cubierto por T1 sobre la R2 + la derivación del
//  funnel; T5 "completar datos sin marcar" es la fase de resolución del commit.)
// =============================================================================

import 'server-only';

import { getLead, updateLead, setPipelineStage, applyFathomRecording, logLeadEvent } from './leads';
import { pipelineStageOf } from './pipeline';
import { getTenantDb, runWithWorkspace, listarWorkspaces, OWNER_WS } from './workspace';
import { hoyEnTijuana } from './date-utils';
import { buscarReunionesAutomatico } from './auto-reuniones';
import { contactoIdPorTelefono, getContactMessages } from './chatwoot';
import { crearConfirmacion, type CrearConfirmacionInput } from './mako-confirmaciones';
import { AUTO_UMBRALES, planLeadAuto, type AutoAccion, type AutoLead, type AutoReglaId } from './crm-auto-plan';

// El planificador PURO (AUTO_UMBRALES/AutoAccion/AutoLead/planLeadAuto) vive en
// crm-auto-plan.ts (sin server-only) para poder testearlo. Se re-exporta acá para
// no romper los imports existentes desde '@/lib/crm-auto'.
export { AUTO_UMBRALES, planLeadAuto };
export type { AutoAccion, AutoLead, AutoReglaId };

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

async function aplicarAccion(a: AutoAccion, yaConf: Set<string>): Promise<'auto' | 'confirma' | 'skip'> {
  const lead = await getLead(a.leadId);
  if (!lead) return 'skip';

  // T2 — Lead que no agendó → No Agenda (reciente) o Reactivación (frío). Auto.
  if (a.tipo === 'lead_a_nutri') {
    // Espejo del gate del planner (solo leads abiertos): si entre plan y apply el
    // lead pasó a terminal (ganado/perdido) por un path que dejó el override stale,
    // NO lo tocamos (mover a reactivación lo re-abriría y corrompería Revenue/CAPI).
    if (lead.estado_lead !== 'abierto') return 'skip';
    const to = a.move?.to === 'reactivacion' ? 'reactivacion' : 'nutri';
    const cur = pipelineStageOf(lead);
    if (cur === to) return 'skip';                                       // ya está ahí
    // Guard anti-carrera: No Agenda solo desde el Instant form; Reactivación desde
    // el Instant form o desde No Agenda (reclasificar al que entró viejo).
    if (to === 'nutri' && cur !== 'lead') return 'skip';
    if (to === 'reactivacion' && cur !== 'lead' && cur !== 'nutri') return 'skip';
    await setPipelineStage(a.leadId, to);
    const label = to === 'reactivacion' ? 'Nutrición - Reactivación' : 'Nutrición - No Agenda';
    await logLeadEvent(a.leadId, 'CRM automático', `T2: → ${label} (${a.descripcion})`, 'MaKo');
    return 'auto';
  }

  // T6 — Frío → Reactivación (aplica + confirmación, revert al estado previo).
  if (a.tipo === 'reactivacion') {
    if (lead.pipeline_stage === 'reactivacion') return 'skip';
    if (yaConf.has(a.leadId + '|T6')) return 'skip';
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
    if (yaConf.has(a.leadId + '|' + clave)) return 'skip'; // ya resuelta/pendiente (anti-loop)
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
    if (yaConf.has(a.leadId + '|T3')) return 'skip'; // ya resuelta/pendiente (anti-loop)
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
  // Precargar en UNA query todas las (lead, clave) que ya tienen confirmación
  // (cualquier estado) — anti-loop sin N queries por acción.
  const yaConf = new Set<string>();
  try {
    const { data } = await (await getTenantDb()).from('mako_confirmaciones').select('lead_id, clave');
    for (const r of (data ?? []) as Array<{ lead_id: number; clave: string }>) yaConf.add(r.lead_id + '|' + r.clave);
  } catch { /* si falla, crearConfirmacion igual dedup-ea por índice único */ }
  let auto = 0, confirmaciones = 0, externas = 0, restantes = 0;
  for (const a of acciones) {
    const esExterna = a.tipo === 'reunion_check' || a.tipo === 'manual_vencida';
    if (esExterna && externas >= MAX_EXTERNAS_POR_CORRIDA) { restantes++; continue; }
    try {
      const r = await aplicarAccion(a, yaConf);
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
