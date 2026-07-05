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
import { pipelineStageOf } from './pipeline';
import { getTenantDb, runWithWorkspace, listarWorkspaces, OWNER_WS } from './workspace';
import { hoyEnTijuana } from './date-utils';

// Umbrales del motor. Por ahora fijos; se harán configurables desde la tab Funnel
// (funnel_config) para que cada negocio ajuste sus tiempos.
export const AUTO_UMBRALES = { diasLeadSinAgenda: 2, diasReactivacion: 30 };

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
export function planLeadAuto(l: AutoLead, hoyISO: string): AutoAccion[] {
  const out: AutoAccion[] = [];
  const nombre = l.nombre?.trim() || `Lead ${l.id}`;
  const hoy = hoyISO.slice(0, 10);
  const stage = pipelineStageOf(l);

  if (l.estado_lead === 'abierto') {
    // T1 — reunión pasada sin asistencia marcada → revisar Fathom.
    const r1 = l.fecha_junta_1 ?? l.fecha_agenda;
    if (l.asistio_j1 == null && r1 && r1.slice(0, 10) < hoy) {
      out.push({
        regla: 'T1', tipo: 'reunion_check', leadId: l.id, lead: nombre, which: 'j1', resolver: 'fathom', confirmar: true,
        descripcion: `R1 del ${r1.slice(0, 10)} sin marcar → buscar grabación en Fathom: si aparece asistió (marca todo), si no No Show R1`,
      });
    } else if (l.asistio_j1 === true && l.fecha_junta_2 && l.asistio_j2 == null && l.fecha_junta_2.slice(0, 10) < hoy) {
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
  'id, nombre, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada, nutricion_manual_deadline, created_at, updated_at';

export type AutoEvalWs = { acciones: AutoAccion[]; totalLeads: number; porRegla: Record<string, number> };

/** Evalúa el CRM automático para el workspace ACTUAL (dry-run puro, no escribe). */
export async function evaluarAutoWorkspace(hoyISO: string = hoyEnTijuana()): Promise<AutoEvalWs> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('leads').select(AUTO_COLS);
  if (error) throw new Error(`crm-auto evaluar: ${error.message}`);
  const leads = (data ?? []) as AutoLead[];
  const acciones = leads.flatMap((l) => planLeadAuto(l, hoyISO));
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
