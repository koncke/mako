// =============================================================================
// Las dos señales que le llegan a Meta, ofrecidas al mover un lead (08-T22)
// =============================================================================
// Módulo puro (sin 'use client' ni 'server-only') para poder testearlo solo.
//
// Desde el 17/09 mover de etapa ya no exige los datos de la etapa: se guarda y
// lo que falta queda pendiente (ver registrarPendientes en app/crm/actions.ts).
// Hay DOS datos que igual se ofrecen en el momento, y es por Meta:
//
//   · `calificado`                → evento Lead
//   · `asistió a la R1` + calif.  → evento QualifiedLead
//
// Son los únicos del CRM que le llegan a Meta (lib/leads.ts, updateLead). Mover
// de etapa no le manda nada — ni siquiera pasar a Ganado: no existe un evento de
// compra. Si estos dos se postergan con todo lo demás, Meta los recibe una semana
// tarde o nunca, que es justo lo que la regla vieja quería evitar y no lograba.
//
// Se OFRECEN, no se exigen: el botón de mover funciona sin tocarlos. Cada uno es
// un toque, y solo aparecen si hoy faltan y si hay una reunión de la que hablar.
// =============================================================================

export type LeadParaSenales = {
  fechaJ1: string | null;
  asistioJ1: boolean | null;
  calificado: boolean | null;
};

/** Lo mínimo de una transición del funnel que importa acá. */
export type TransicionParaSenales = { asistioJ1?: boolean; category?: string } | undefined;

export type SenalesAOfrecer = {
  /** Ofrecer «¿asistió a la Reunión 1?» (hoy está sin marcar). */
  asistio: boolean;
  /** Ofrecer «¿era calificado?» (sin marcar, y la asistencia no es "no"). */
  calificado: boolean;
  /** La asistencia que ya se sabe o que el movimiento implica; null = no se sabe. */
  asistioConocida: boolean | null;
};

/**
 * La asistencia que un movimiento IMPLICA, o undefined si no implica nada.
 *
 * ⚠️ Una transición de PÉRDIDA no implica asistencia. El funnel generado marca
 * «Se perdió» con `asistioJ1: true`, y copiar ese flag escribía "asistió a la
 * reunión" en leads de los que nadie sabía si se presentaron. Es el mismo error
 * que se corrigió en agosto en el wizard de «¿Qué hacer ahora?» (salidasDeEtapa):
 * el arrastre del tablero lo seguía teniendo. Avanzar sí implica haber asistido;
 * un no-show implica no haber asistido; perderse no dice nada.
 */
export function asistenciaImplicita(tr: TransicionParaSenales): boolean | undefined {
  if (!tr || tr.category === 'perdida') return undefined;
  return tr.asistioJ1;
}

export function senalesAOfrecer(lead: LeadParaSenales, opts: { tr?: TransicionParaSenales; hoyISO: string }): SenalesAOfrecer {
  const nada: SenalesAOfrecer = { asistio: false, calificado: false, asistioConocida: lead.asistioJ1 };
  // Sin fecha de R1 no hay reunión de la que hablar: updateLead anula asistencia
  // y calificado cuando falta la fecha, así que preguntarlos sería inútil.
  if (!lead.fechaJ1) return nada;
  // Una reunión que todavía no ocurrió no tiene asistencia que marcar. La de hoy
  // sí cuenta: si alguien mueve al lead, es porque ya pasó algo.
  if (lead.fechaJ1.slice(0, 10) > opts.hoyISO) return nada;
  const asistio = lead.asistioJ1 ?? asistenciaImplicita(opts.tr) ?? null;
  // No asistió: no hay calificación posible (updateLead la anula).
  if (asistio === false) return { asistio: false, calificado: false, asistioConocida: false };
  return { asistio: asistio === null, calificado: lead.calificado === null, asistioConocida: asistio };
}

export const hayAlgoQueOfrecer = (s: SenalesAOfrecer) => s.asistio || s.calificado;
