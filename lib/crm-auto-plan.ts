// =============================================================================
// crm-auto-plan — planificador PURO del CRM automático (sin IO, testeable)
// =============================================================================
// Decide QUÉ acciones propondría MaKo para un lead (T1/T2/T3/T6). Sin efectos ni
// server-only: lo consumen el motor (lib/crm-auto.ts) y los tests (tests/*.test.ts).

import type { EstadoLead } from './leads';
import { pipelineStageOf } from './pipeline';

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
 * T1 dispara a las N horas EXACTAS después de la reunión cuando hay junta_*_at
 * (hora del webhook de Calendly); para leads viejos sin hora, cuando el día ya pasó.
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
