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

import { getLead, updateLead, moverLeadAuto, applyFathomRecording, logLeadEvent } from './leads';
import { pipelineStageOf, MAKO_SETTER } from './pipeline';
import { encuentroGrabable } from './encuentro-ws';
import { getTenantDb, runWithWorkspace, listarWorkspaces, getWorkspaceActual, OWNER_WS } from './workspace';
import { hoyEnTijuana } from './date-utils';
import { buscarReunionesAutomatico } from './auto-reuniones';
import { contactoIdPorTelefono, getContactMessages } from './chatwoot';
import { crearConfirmacion, type CrearConfirmacionInput } from './mako-confirmaciones';
import { crmAutoHabilitado } from './envio-flags';
import { AUTO_UMBRALES, planLeadAuto, type AutoAccion, type AutoLead, type AutoReglaId, type AutoUmbrales } from './crm-auto-plan';

// El planificador PURO (AUTO_UMBRALES/AutoAccion/AutoLead/planLeadAuto) vive en
// crm-auto-plan.ts (sin server-only) para poder testearlo. Se re-exporta acá para
// no romper los imports existentes desde '@/lib/crm-auto'.
export { AUTO_UMBRALES, planLeadAuto };
export type { AutoAccion, AutoLead, AutoReglaId };

const AUTO_COLS =
  'id, nombre, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_realizada, nutricion_manual_deadline, created_at, updated_at';

export type AutoEvalWs = { acciones: AutoAccion[]; totalLeads: number; porRegla: Record<string, number> };

/**
 * Umbrales efectivos del workspace ACTUAL: los defaults del motor pisados por
 * funnel_config.data.umbrales (si el cliente ajustó sus tiempos). Tolerante:
 * cualquier valor ausente o inválido cae al default.
 */
async function umbralesDelWorkspace(): Promise<AutoUmbrales> {
  try {
    const supabase = await getTenantDb();
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    const { data } = await supabase.from('funnel_config').select('data').eq('workspace_id', ws).maybeSingle();
    const u = (data?.data as { umbrales?: Partial<AutoUmbrales> } | null)?.umbrales;
    if (!u || typeof u !== 'object') return AUTO_UMBRALES;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
    return {
      diasLeadSinAgenda: num(u.diasLeadSinAgenda, AUTO_UMBRALES.diasLeadSinAgenda),
      diasSinAgendaFrio: num(u.diasSinAgendaFrio, AUTO_UMBRALES.diasSinAgendaFrio),
      diasReactivacion: num(u.diasReactivacion, AUTO_UMBRALES.diasReactivacion),
      horasPostReunion: num(u.horasPostReunion, AUTO_UMBRALES.horasPostReunion),
    };
  } catch {
    return AUTO_UMBRALES;
  }
}

/** Evalúa el CRM automático para el workspace ACTUAL (dry-run puro, no escribe). */
export async function evaluarAutoWorkspace(hoyISO: string = hoyEnTijuana()): Promise<AutoEvalWs> {
  const supabase = await getTenantDb();
  const [{ data, error }, umbrales] = await Promise.all([
    supabase.from('leads').select(AUTO_COLS),
    umbralesDelWorkspace(),
  ]);
  if (error) throw new Error(`crm-auto evaluar: ${error.message}`);
  const leads = (data ?? []) as AutoLead[];
  const nowMs = Date.now();
  const acciones = leads.flatMap((l) => planLeadAuto(l, hoyISO, nowMs, umbrales));
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

// Todo lo que mueve el motor lo firma MaKo. Se pasa EXPLÍCITO a setPipelineStage
// (que si no resolvería la sesión del request) porque el cron corre sin nadie
// logueado y, sobre todo, porque acá el actor real ES el sistema: el historial
// tiene que decirlo aunque la corrida la haya disparado una persona a mano.
const AUTOR = MAKO_SETTER;

/** Deja la línea explicativa de la regla que movió al lead (el "por qué" del movimiento). */
async function logRegla(leadId: number, regla: AutoReglaId, texto: string): Promise<void> {
  await logLeadEvent(leadId, 'CRM automático', `${regla}: ${texto}`, AUTOR);
}

/**
 * Mueve un lead desde el motor, con los MISMOS requisitos que el wizard del CRM.
 *
 * El motor solo mueve a nutrición y a salidas (No Agenda, Reactivación, No Show,
 * No responde): etapas sin requisitos, así que hoy validar no rechaza nada. Se
 * valida igual porque el funnel es configurable por workspace — el día que una de
 * esas etapas tenga requisitos, el motor no puede ser el único camino que los
 * ignora.
 *
 * La regla de "validá, y si falta algo no muevas pero escribí por qué" es la
 * MISMA que necesita el desenlace de las nutriciones, así que vive en un solo
 * lugar (`moverLeadAuto`, lib/leads.ts) y acá solo se le pone el nombre con el
 * que este motor firma el historial.
 *
 * Devuelve false = no se movió (el caller corta y no crea la confirmación, que
 * anunciaría un cambio que nunca pasó).
 */
async function moverAuto(
  leadId: number,
  to: string,
  extra?: { asistio_j1?: boolean | null; asistio_j2?: boolean | null },
): Promise<boolean> {
  return moverLeadAuto(leadId, to, { canal: 'CRM automático', autor: AUTOR, ...extra });
}

/** Asigna a MaKo como setter de una nutrición automática — y lo deja registrado. */
async function asignarSetterMaKo(leadId: number, setterActual: string | null | undefined): Promise<void> {
  if (setterActual?.trim()) return;
  const { error } = await (await getTenantDb()).from('leads').update({ setter: MAKO_SETTER }).eq('id', leadId);
  if (error) { console.error(`[crm-auto] setter MaKo en lead ${leadId} falló: ${error.message}`); return; }
  // 'Setter' es un campo del historial (AUDIT_FIELDS): sin esta línea el lead
  // aparecía con un setter que nadie le puso.
  await logLeadEvent(leadId, 'Setter', MAKO_SETTER, AUTOR);
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
    // El cambio de etapa lo audita setPipelineStage (campo 'Etapa'); acá se suma
    // el POR QUÉ, que la línea de etapa sola no cuenta.
    if (!(await moverAuto(a.leadId, to))) return 'skip';
    // Nutrición automática la corre MaKo → setter='MaKo' si estaba vacío (nunca queda sin setter).
    await asignarSetterMaKo(a.leadId, lead.setter);
    const label = to === 'reactivacion' ? 'Nutrición - Reactivación' : 'Nutrición - No Agenda';
    await logRegla(a.leadId, 'T2', `→ ${label} (${a.descripcion})`);
    return 'auto';
  }

  // T6 — Frío → Reactivación (aplica + confirmación, revert al estado previo).
  if (a.tipo === 'reactivacion') {
    if (lead.pipeline_stage === 'reactivacion') return 'skip';
    if (yaConf.has(a.leadId + '|T6')) return 'skip';
    const prevEstado = lead.estado_lead;
    const prevStage = lead.pipeline_stage ?? null;
    const prevMotivo = lead.motivo_perdida ?? null; // updateLead lo nulifica al reabrir → restaurarlo en el revert
    if (!(await moverAuto(a.leadId, 'reactivacion'))) return 'skip';
    // Reactivación la corre MaKo → setter='MaKo' si estaba vacío.
    await asignarSetterMaKo(a.leadId, lead.setter);
    await logRegla(a.leadId, 'T6', `→ Nutrición - Reactivación (${a.descripcion})`);
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
      // applyFathomRecording audita el diff (asistencia + etapa) como 'Fathom' —
      // la fuente del dato. Acá se agrega quién decidió mirar: el motor.
      const { addedLink } = await applyFathomRecording(lead, which, fathom.url, asistio);
      await logRegla(a.leadId, 'T1', `asistencia a ${which === 'j1' ? 'R1' : 'R2'} tomada de la grabación de Fathom (${a.descripcion})`);
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
    // ⚠️ SIN GRABACIÓN NO ES «NO VINO». Concluir No Show por la ausencia de un
    // video solo es válido si de ese encuentro se esperaba un video: una llamada
    // 1:1 remota, con Fathom conectado. Un taller presencial no se graba nunca, y
    // sin este gate el motor le marcaba No Show —todas las semanas— a las veinte
    // personas que sí habían ido.
    //
    // El que decide es la CONEXIÓN VIVA, no un campo declarado: así también deja
    // de castigar a cualquier workspace que simplemente no tiene Fathom, que era
    // el caso más común y nadie lo había mirado. Cuando no se puede concluir, no
    // se afirma nada: se le pregunta a una persona.
    if (!(await encuentroGrabable())) {
      return confirmarOCompensar(a.leadId, {
        leadId: a.leadId, leadNombre: lead.nombre, regla: 'T1', tipo: a.tipo, clave,
        titulo: `¿Fue a la reunión ${lead.nombre ?? 'el lead'}?`,
        detalle: `${a.descripcion}. Este encuentro no deja grabación, así que no puedo saberlo solo.`,
        aplicado: false,
        cambios: [],
        opciones: [
          { key: 'fue', label: 'Sí, fue', stage: null, tone: 'primary' },
          { key: 'noshow', label: 'No fue', stage: which === 'j1' ? 'noshow_r1' : 'noshow_r2', tone: 'danger' },
        ],
      });
    }

    // Sin grabación → No Show.
    const movido = await moverAuto(
      a.leadId,
      which === 'j1' ? 'noshow_r1' : 'noshow_r2',
      which === 'j1' ? { asistio_j1: false } : { asistio_j2: false },
    );
    if (!movido) return 'skip';
    await logRegla(a.leadId, 'T1', `→ No Show ${which === 'j1' ? 'R1' : 'R2'}: no apareció ninguna grabación en Fathom (${a.descripcion})`);
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
      if (!(await moverAuto(a.leadId, 'noresp'))) return 'skip';
      await logRegla(a.leadId, 'T3', `→ No responde: venció la nutrición manual y hay ${inbound} mensaje(s) del lead en WhatsApp`);
      return confirmarOCompensar(a.leadId, {
        leadId: a.leadId, leadNombre: lead.nombre, regla: 'T3', tipo: a.tipo, clave: 'T3',
        titulo: `Nutrición manual vencida — ${lead.nombre ?? 'lead'}`,
        detalle: `${inbound} mensaje(s) del lead en WhatsApp → clasificado como No responde. Si desistió, márcalo Perdido.`,
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
      detalle: 'Sin mensajes del lead en WhatsApp. Decide el desenlace o déjalo para completar los datos.',
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

export type AplicarResult = { ws: number; ok: boolean; modo?: 'commit' | 'off'; error?: string; auto?: number; confirmaciones?: number; restantes?: number };

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

/**
 * Aplica el CRM automático en los workspaces activos. El commit se decide POR
 * WORKSPACE con crmAutoHabilitado() (setting crm_auto_enabled; el dueño hereda
 * el env CRM_AUTO_ENABLED; cliente sin setting = apagado): un workspace apagado
 * se reporta modo 'off' sin tocar ningún lead.
 *   opts.soloWs  → restringe la corrida a UN workspace (piloto).
 *   opts.forzar  → ignora el flag (solo para el ?commit=1 manual del cron, que
 *                  exige ws explícito — nunca fuerza a todos a la vez).
 */
export async function aplicarAutoTodos(
  hoyISO: string = hoyEnTijuana(),
  opts?: { soloWs?: number; forzar?: boolean },
): Promise<AplicarResult[]> {
  let workspaces: Array<{ id: number; estado?: string }>;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch {
    workspaces = [{ id: OWNER_WS }];
  }
  if (opts?.soloWs != null) workspaces = workspaces.filter((w) => w.id === opts.soloWs);
  const out: AplicarResult[] = [];
  for (const w of workspaces) {
    try {
      const r = await runWithWorkspace(w.id, async (): Promise<AplicarResult> => {
        // El flag se lee ADENTRO del contexto del workspace: afuera, getSetting
        // cae al dueño y aplicaría su config a todos los clientes.
        if (!opts?.forzar && !(await crmAutoHabilitado())) return { ws: w.id, ok: true, modo: 'off' };
        return { ...(await aplicarAutoWorkspace(hoyISO)), ws: w.id, modo: 'commit' };
      });
      out.push(r);
    } catch (e) {
      out.push({ ws: w.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
