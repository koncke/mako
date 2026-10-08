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
import { getPipelineStagesDefault } from './funnels';
import { reunionesDe } from './funnel-etapas';
import { encuentroGrabable } from './encuentro-ws';
import { getTenantDb, runWithWorkspace, listarWorkspaces, getWorkspaceActual, OWNER_WS } from './workspace';
import { hoyEnTijuana } from './date-utils';
import { leerTodo } from './supabase-paginado';
import { buscarReunionesAutomatico } from './auto-reuniones';
import { contactoIdPorTelefono, getContactMessages } from './chatwoot';
import { crearConfirmacion, type CrearConfirmacionInput } from './mako-confirmaciones';
import { crmAutoHabilitado } from './envio-flags';
import { emitirDelCatalogo } from './avisos';
import {
  AUTO_UMBRALES, planLeadAuto, plazoDeEtapa, sanearPlazosPorEtapa, resumenEstancados, rotuloReunion,
  type AutoAccion, type AutoLead, type AutoReglaId, type AutoUmbrales, type EstancadoAplicado, type RotulosReunion,
} from './crm-auto-plan';

// El planificador PURO (AUTO_UMBRALES/AutoAccion/AutoLead/planLeadAuto) vive en
// crm-auto-plan.ts (sin server-only) para poder testearlo. Se re-exporta acá para
// no romper los imports existentes desde '@/lib/crm-auto'.
export { AUTO_UMBRALES, planLeadAuto, plazoDeEtapa };
export type { AutoAccion, AutoLead, AutoReglaId };

const AUTO_COLS =
  'id, nombre, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_realizada, nutricion_manual_deadline, created_at, updated_at';

export type AutoEvalWs = { acciones: AutoAccion[]; totalLeads: number; porRegla: Record<string, number> };

/**
 * Umbrales efectivos del workspace ACTUAL: los defaults del motor pisados por
 * `funnels.data.umbrales` del funnel DEL NEGOCIO (si el cliente ajustó sus
 * tiempos). Tolerante: cualquier valor ausente o inválido cae al default.
 *
 * DEFAULT y no por lead: el motor barre la cartera entera de una, y los tiempos
 * («cuándo un lead está frío») son una política del negocio. El día que un funnel
 * quiera los suyos, esto se resuelve por participación dentro del loop.
 *
 * ⚠️ Y DESDE HOY TAMBIÉN EL PLAZO POR ETAPA (`umbrales.porEtapa`), con la MISMA
 * tolerancia: una etapa sin plazo declarado cae al umbral global de siempre, así que un
 * workspace que no declaró nada sigue viendo exactamente lo que ve hoy. Lo que se declara
 * se cruza contra las etapas REALES del embudo de este workspace —un plazo escrito sobre
 * una columna que ese embudo no tiene no gobierna a nadie— y lo descartado se LOGUEA con
 * motivo: sin esa línea, «escribí el plazo en la etapa equivocada» y «no escribí ninguno»
 * se ven exactamente igual desde afuera.
 */
async function umbralesDelWorkspace(): Promise<AutoUmbrales> {
  try {
    const { umbralesDelFunnelDefault } = await import('./funnels');
    const u = (await umbralesDelFunnelDefault()) as (Partial<AutoUmbrales> & { porEtapa?: unknown }) | null;
    if (!u || typeof u !== 'object') return AUTO_UMBRALES;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
    // El embudo se lee de la caché de la corrida (la misma que usa `etapaDibujable`): no
    // suma una query por workspace. `null` = no se pudo leer → no se descarta nada.
    const { plazos, descartes } = sanearPlazosPorEtapa(u.porEtapa, (await etapasDelWs())?.etiquetas);
    if (descartes.length) console.warn(`[crm-auto] plazos por etapa descartados: ${descartes.join(' · ')}`);
    return {
      diasLeadSinAgenda: num(u.diasLeadSinAgenda, AUTO_UMBRALES.diasLeadSinAgenda),
      diasSinAgendaFrio: num(u.diasSinAgendaFrio, AUTO_UMBRALES.diasSinAgendaFrio),
      diasReactivacion: num(u.diasReactivacion, AUTO_UMBRALES.diasReactivacion),
      horasPostReunion: num(u.horasPostReunion, AUTO_UMBRALES.horasPostReunion),
      porEtapa: plazos,
    };
  } catch {
    return AUTO_UMBRALES;
  }
}

/** Evalúa el CRM automático para el workspace ACTUAL (dry-run puro, no escribe). */
export async function evaluarAutoWorkspace(hoyISO: string = hoyEnTijuana()): Promise<AutoEvalWs> {
  const supabase = await getTenantDb();
  // Paginado por `id`: el `.select()` suelto devolvía 1000 de 1066 leads en ws1,
  // así que el motor nunca evaluaba a los 66 restantes (nunca se les movía la
  // etapa) y reportaba `totalLeads: 1000` como si fuera el total real.
  const [leads, umbrales] = await Promise.all([
    leerTodo<AutoLead>(supabase, 'leads', AUTO_COLS).catch((e: unknown) => {
      throw new Error(`crm-auto evaluar: ${e instanceof Error ? e.message : String(e)}`);
    }),
    umbralesDelWorkspace(),
  ]);
  const nowMs = Date.now();
  // Cómo llamó el dueño a sus reuniones, para que T1 no le hable de «R1» a quien vende
  // una «1ª sesión sin costo». Sale de la caché del embudo (la misma que ya leyó
  // `umbralesDelWorkspace`), así que no suma una query; sin embudo legible → R1/R2.
  const rotulos = (await etapasDelWs())?.reuniones;
  const acciones = leads.flatMap((l) => planLeadAuto(l, hoyISO, nowMs, umbrales, rotulos));
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
/**
 * El CHOKE POINT de todo movimiento automático: por acá pasan las siete reglas.
 *
 * ⚠️ NO ESCRIBE UNA ETAPA QUE EL EMBUDO DEL WORKSPACE NO TIENE, desde el 27/09/2026.
 * El motor escribía `reactivacion`, `noshow_r1` y `noshow_r2` sin mirar el funnel, y
 * el tablero no puede dibujar una columna que no existe: esos leads terminan en la
 * etapa derivada o, si ni esa está, en la PRIMERA columna. Medido en el relevamiento
 * del 25/09: **1.057 de los 1.138 leads del ws1** dibujados donde no están.
 *
 * Y no falla ruidoso: el `update` de Postgres es perfectamente válido, así que el
 * motor reporta que movió y el tablero muestra otra cosa. Un dato que ninguna
 * pantalla puede representar no es un dato guardado, es un dato perdido con recibo.
 *
 * El rechazo se REGISTRA (AGENTS.md: «una política puede rechazar; no puede no dejar
 * rastro»): sin la línea, «el motor no movió nada» y «el motor movió a una columna
 * que no existe» se ven exactamente igual desde afuera.
 */
async function moverAuto(
  leadId: number,
  to: string,
  extra?: { asistio_j1?: boolean | null; asistio_j2?: boolean | null },
): Promise<boolean> {
  if (!(await etapaDibujable(to))) {
    console.warn(`[crm-auto] lead ${leadId}: NO se movió a «${to}» — ese embudo no tiene esa etapa, y el tablero lo dibujaría en la primera columna.`);
    return false;
  }
  return moverLeadAuto(leadId, to, { canal: 'CRM automático', autor: AUTOR, ...extra });
}

/**
 * ¿El embudo de ESTE workspace tiene esa etapa?
 *
 * Se cachea por corrida: el motor recorre todos los workspaces y cada uno resuelve su
 * funnel una sola vez. Si la lectura falla se contesta `true` — un motor que se apaga
 * porque no pudo leer el funnel es peor que uno que mueve de más, y la falla de
 * lectura no es un hecho sobre el embudo (AGENTS.md: «un chequeo que no puede mirar se
 * abstiene»).
 */
// Guarda key → RÓTULO, no sólo las keys. El rótulo hace falta porque el aviso de abajo lo
// lee un dueño: «noresp» o «st0» son nombres internos y quien abre el WhatsApp no tiene de
// dónde sacarlos (AGENTS.md: «el nombre interno de una cosa no es el nombre de la cosa»).
// Y por la MISMA razón guarda cómo se llaman las dos reuniones (`reuniones`): T1 las nombra
// en la descripción, el historial y la confirmación.
// `null` = no se pudo leer el embudo.
type EtapasWs = { etiquetas: Map<string, string>; reuniones: RotulosReunion };
const etapasPorWs = new Map<number, EtapasWs | null>();

/**
 * Las etapas del embudo de este workspace (key → rótulo) y los rótulos de sus dos
 * reuniones, cacheadas por corrida.
 *
 * Las reuniones salen de `reunionesDe` (lib/funnel-etapas.ts), que es la fuente ÚNICA del
 * mapeo «la reunión N del embudo → j1/j2»: un segundo filtro por `kind` acá podría
 * contar distinto y nombrar la R2 con el rótulo de la R1. Un rótulo vacío NO cae a la key
 * (`agenda` es un nombre interno): queda ausente y `rotuloReunion` dice «R1»/«R2».
 */
async function etapasDelWs(): Promise<EtapasWs | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  if (!etapasPorWs.has(ws)) {
    try {
      const stages = await getPipelineStagesDefault();
      const etiquetas = new Map(stages.map((x) => [x.key, x.label || x.key]));
      const [k1, k2] = reunionesDe(stages);
      const rotulo = (k: string | undefined) => (k ? stages.find((x) => x.key === k)?.label?.trim() || undefined : undefined);
      etapasPorWs.set(ws, { etiquetas, reuniones: { j1: rotulo(k1), j2: rotulo(k2) } });
    } catch (e) {
      console.error(`[crm-auto] no pude leer el embudo del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
      etapasPorWs.set(ws, null);
    }
  }
  return etapasPorWs.get(ws) ?? null;
}

async function etapaDibujable(key: string): Promise<boolean> {
  // Sin workspace resuelto no hay embudo contra el que comparar: se abstiene.
  if ((await getWorkspaceActual()) == null) return true;
  const etapas = await etapasDelWs();
  return !etapas || etapas.etiquetas.has(key);
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
    // ⚠️ EL NOMBRE DE LA REUNIÓN ES SÓLO TEXTO: cómo la llamó el dueño en su embudo, o
    // «R1»/«R2» si no la nombró. Lo que la identifica sigue siendo `which`, y `clave` se
    // queda en `T1:${which}`: es la llave anti-loop de mako_confirmaciones. Medido el
    // 06/10/2026: el ws1 tiene 35 confirmaciones T1 bajo 'T1:j1'/'T1:j2' (32 resueltas, 3
    // pendientes). Derivar la clave del rótulo las re-propondría todas y movería leads a
    // No Show — con el envío de WhatsApp del ws1 prendido, eso son mensajes a leads reales.
    // Por lo mismo `asistField`, `noshow_r1/_r2` y el revert no miran el rótulo.
    const reunion = rotuloReunion(which, (await etapasDelWs())?.reuniones);
    const prevStage = lead.pipeline_stage ?? null;
    const prevFechaJ1 = lead.fecha_junta_1;
    // Sin Google: lo que el motor escribe en la ficha sin que nadie lo mire después lo
    // leen los análisis con IA, y la agenda no pasa por ninguna (lib/agenda-sin-ia.ts).
    const auto = await buscarReunionesAutomatico(lead, { conGoogle: false });
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
      //
      // ⚠️ `marcarAsistencia` NO ES REDUNDANTE CON `asistio`, y confundirlos le
      // afirma a un cliente que su lead vino a una reunión que nadie verificó.
      // `applyFathomRecording` resuelve `attended ?? true`, así que un `null` —que
      // acá significa «hay grabación y NADIE dijo si vino»— entra como un «sí» y
      // mueve la etapa, que el revert de abajo no deshace. (Desde el 05/10/2026 la
      // asistencia ya NO manda un evento a Meta: ver lib/leads.ts. Lo que se afirma
      // mal sigue siendo una reunión a la que nadie verificó que vino.)
      // El `null` existe desde que `buscarReunionesAutomatico` lee
      // también los links que una persona pegó en la ficha (lib/auto-reuniones.ts:172,
      // `asistioJ1: anaLinkR1 ? true : null`): un link pegado a mano prueba que la
      // reunión se grabó, no quién estuvo. Sólo la grabación ANALIZADA lo afirma.
      const { addedLink, markedAsistencia } = await applyFathomRecording(
        lead, which, fathom.url, asistio, { marcarAsistencia: asistio != null },
      );
      // Si no se marcó nada y el link ya estaba, la regla no hizo NADA: una
      // confirmación que no cambió un dato es ruido en la bandeja del dueño.
      if (!markedAsistencia && !addedLink) return 'skip';
      await logRegla(a.leadId, 'T1', markedAsistencia
        ? `asistencia a ${reunion} tomada de la grabación de Fathom (${a.descripcion})`
        : `grabación de ${reunion} enganchada a la ficha; la asistencia queda sin marcar (${a.descripcion})`);
      const revert: Record<string, unknown> = { [asistField]: prevAsist, pipeline_stage: prevStage };
      if (which === 'j1' && prevFechaJ1 !== lead.fecha_junta_1) revert.fecha_junta_1 = prevFechaJ1;
      if (addedLink) revert.fathom_remove_url = fathom.url; // revert quirúrgico: quita solo este link, no pisa el array
      return confirmarOCompensar(a.leadId, {
        leadId: a.leadId, leadNombre: lead.nombre, regla: 'T1', tipo: a.tipo, clave,
        titulo: markedAsistencia
          ? `Asistencia ${reunion} de ${lead.nombre ?? 'lead'}`
          : `Grabación de ${reunion} de ${lead.nombre ?? 'lead'}`,
        detalle: a.descripcion, aplicado: true,
        // Cada fila cuelga de que ESO haya pasado. Una fila que afirma un cambio
        // que no ocurrió es peor que no mostrarla: la persona confirma a ciegas.
        cambios: [
          ...(markedAsistencia
            ? [{ campo: `Asistió ${reunion}`, antes: 'Sin marcar', despues: 'Sí (grabación en Fathom)' }]
            : []),
          ...(addedLink ? [{ campo: 'Grabación Fathom', antes: null, despues: fathom.label || 'agregada' }] : []),
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
    await logRegla(a.leadId, 'T1', `→ No Show ${reunion}: no apareció ninguna grabación en Fathom (${a.descripcion})`);
    return confirmarOCompensar(a.leadId, {
      leadId: a.leadId, leadNombre: lead.nombre, regla: 'T1', tipo: a.tipo, clave,
      titulo: `No Show ${reunion} de ${lead.nombre ?? 'lead'}`,
      detalle: a.descripcion, aplicado: true,
      cambios: [{ campo: `Asistió ${reunion}`, antes: 'Sin marcar', despues: 'No asistió → No Show' }],
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

/**
 * El aviso de leads estancados — UNO por corrida, con todo lo que se movió adentro.
 *
 * ⚠️ UNO Y NO N. Emitido adentro del loop, una corrida que mueve 30 leads manda 30
 * WhatsApps: es la misma forma de «una acción en LOTE necesita UN deshacer, no N»
 * (AGENTS.md), y el que queda arriba tapa a los otros 29.
 *
 * ⚠️ VA `texto` Y NO `contexto`. Con `contexto`, `emitirDelCatalogo` le paga a un modelo
 * para que redacte el mensaje con esos datos adentro — y un dato exacto que pasa por las
 * manos de un LLM deja de ser exacto. Acá los datos exactos son cuántos leads se movieron
 * y de qué columna, que es todo lo que el mensaje dice.
 *
 * El dedup de ~20 h es el que convierte «nueve corridas por día» (vercel.json:
 * `20 15-23 * * *`) en un mensaje por día. El HECHO igual queda en el feed: `emitirAviso`
 * escribe la fila ANTES de mirar el interruptor y antes del espaciado, así que silenciar
 * el WhatsApp no borra la bitácora.
 *
 * Best-effort a propósito: si el aviso falla, el motor ya movió los leads y eso no se
 * deshace por un WhatsApp caído.
 */
async function avisarEstancados(aplicadas: EstancadoAplicado[]): Promise<boolean> {
  try {
    const etapas = await etapasDelWs();
    const texto = resumenEstancados(aplicadas, (k) => etapas?.etiquetas.get(k) ?? k);
    if (!texto) return false;
    const ws = (await getWorkspaceActual()) ?? undefined;
    const r = await emitirDelCatalogo('crm-lead-estancado', { ws, texto, dedupTtlMin: 1200 });
    return r.ok && !r.deduped;
  } catch (e) {
    console.error(`[crm-auto] el aviso de leads estancados no salió: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export type AplicarResult = { ws: number; ok: boolean; modo?: 'commit' | 'off'; error?: string; auto?: number; confirmaciones?: number; restantes?: number; aviso?: boolean };

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
  // Lo que de VERDAD se movió, para el aviso. Sólo entran los resultados 'auto' y
  // 'confirma' —los dos aplicaron el cambio— y nunca un 'skip': un mensaje que se manda
  // solo no puede afirmar lo que no verificó.
  const aplicadas: EstancadoAplicado[] = [];
  for (const a of acciones) {
    const esExterna = a.tipo === 'reunion_check' || a.tipo === 'manual_vencida';
    if (esExterna && externas >= MAX_EXTERNAS_POR_CORRIDA) { restantes++; continue; }
    try {
      const r = await aplicarAccion(a, yaConf);
      if (r === 'auto') auto++;
      else if (r === 'confirma') confirmaciones++;
      if (r !== 'skip' && a.desde) aplicadas.push({ regla: a.regla, desde: a.desde, plazoDias: a.plazoDias });
      if (esExterna) externas++;
    } catch (e) {
      console.error(`[crm-auto] aplicar lead ${a.leadId} (${a.regla}) falló:`, e);
    }
  }
  const aviso = aplicadas.length ? await avisarEstancados(aplicadas) : false;
  return { ws: 0, ok: true, auto, confirmaciones, restantes, aviso };
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
