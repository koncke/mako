// =============================================================================
// journey — construye la línea de tiempo del recorrido de un lead
// =============================================================================
// A partir de las fechas reales del lead (alta, R1/R2, confirmación, cierre)
// arma los hitos del funnel en orden, con su estado. Compartido por el modal de
// detalle (CrmLead) y la ruta /crm/[id] (Lead). Función pura.

import { fmtDDMMYYYY } from './date-utils';

export type JourneyState = 'done' | 'failed' | 'pending' | 'upcoming' | 'lost';

export interface JourneyStep {
  key: string;
  label: string;
  sub?: string;
  date: string | null; // 'dd/mm/aaaa' o null
  state: JourneyState;
}

export interface JourneyInput {
  createdISO: string | null;
  fechaAgenda: string | null;
  fechaJ1: string | null;
  asistioJ1: boolean | null;
  fechaJ2: string | null;
  asistioJ2: boolean | null;
  fechaConfirmacion: string | null;
  fechaPrimerPago: string | null;
  fechaCierre: string | null;
  estadoLead: string;
  monto: number;
  /** Hoy en ISO (YYYY-MM-DD) para distinguir reunión futura de pasada; opcional. */
  hoyISO?: string | null;
}

const fmt = (s: string | null): string | null => (s ? fmtDDMMYYYY(s) : null);

function meetingStep(key: string, label: string, date: string | null, asistio: boolean | null, hoyISO?: string | null): JourneyStep {
  if (asistio === true) return { key, label, sub: 'Asistió', date: fmt(date), state: 'done' };
  if (asistio === false) return { key, label, sub: 'No-show', date: fmt(date), state: 'failed' };
  // Sin asistencia marcada: si la reunión es futura, todavía no hay nada que
  // marcar ("Agendada"); si ya pasó (o no hay fecha), sí falta marcarla.
  const esFutura = !!date && !!hoyISO && date.slice(0, 10) >= hoyISO;
  return { key, label, sub: esFutura ? 'Agendada' : 'Agendada · falta marcar asistencia', date: fmt(date), state: 'upcoming' };
}

export function buildJourney(i: JourneyInput): JourneyStep[] {
  const steps: JourneyStep[] = [];
  steps.push({ key: 'form', label: 'Entró como lead', sub: 'Alta / formulario', date: fmt(i.createdISO), state: 'done' });

  const r1date = i.fechaJ1 || i.fechaAgenda;
  if (r1date || i.asistioJ1 != null) steps.push(meetingStep('r1', 'Reunión 1', r1date, i.asistioJ1, i.hoyISO));
  if (i.fechaJ2 || i.asistioJ2 != null) steps.push(meetingStep('r2', 'Reunión 2', i.fechaJ2, i.asistioJ2, i.hoyISO));

  if (i.fechaConfirmacion) steps.push({ key: 'conf', label: 'Confirmó el cierre', date: fmt(i.fechaConfirmacion), state: 'done' });
  if (i.fechaPrimerPago) steps.push({ key: 'pago', label: 'Primer pago', date: fmt(i.fechaPrimerPago), state: 'done' });

  if (i.estadoLead === 'ganado') steps.push({ key: 'cierre', label: 'Cierre ganado', sub: i.monto > 0 ? '$' + i.monto.toLocaleString('en-US') : undefined, date: fmt(i.fechaCierre), state: 'done' });
  else if (i.estadoLead === 'perdido') steps.push({ key: 'cierre', label: 'Perdido', sub: 'Se trabajó y no compró', date: fmt(i.fechaCierre), state: 'lost' });
  else if (i.estadoLead === 'descalificado') steps.push({ key: 'cierre', label: 'Descalificado', sub: 'No era buen fit', date: fmt(i.fechaCierre), state: 'lost' });
  else steps.push({ key: 'open', label: 'En proceso', sub: 'Sigue abierto', date: null, state: 'upcoming' });

  return steps;
}
