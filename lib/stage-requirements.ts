// =============================================================================
// stage-requirements — requisitos ACUMULATIVOS de datos por etapa (fuente única)
// =============================================================================
// Para ESTAR en una etapa deben cumplirse los requisitos de toda la cadena
// previa del funnel canónico: un lead no puede ser "Ganado" sin R1 marcada
// (fecha + asistencia + calificado + Fathom), R2 marcada y monto. El Kanban,
// la ficha y el backstop del server consumen esta misma fuente.
//
// Regla "posible vs imposible": solo se exige lo que el humano PUEDE conseguir.
// Las fechas de reunión viven en Calendly/Google Calendar; el link de Fathom
// solo existe si la reunión YA ocurrió (a una futura no se le exige); el
// comportamiento (VSL/landing) es imposible de reconstruir y JAMÁS se exige.
//
// Devuelve PASOS ordenados (para el wizard progresivo: una pregunta por vez).

export type StepId =
  | 'fechaJ1' | 'asistenciaR1' | 'calificado' | 'fathomR1'
  | 'fechaJ2' | 'asistenciaR2' | 'fathomR2'
  | 'monto' | 'plan' | 'motivo' | 'setter';

export type Step = { id: StepId; label: string };

export interface StageReqValues {
  fechaJ1?: string | null;
  asistioJ1?: boolean | null;
  calificado?: boolean | null;
  fechaJ2?: string | null;
  asistioJ2?: boolean | null;
  /** Un solo set de links por lead: cubre R1 y R2 (etiquetados). */
  hasFathomUrl?: boolean;
  monto?: number | null;
  motivo?: string | null;
  setter?: string | null;
  /** undefined = el caller no sabe si hay plan (no se exige); boolean = se exige. */
  tienePlan?: boolean;
  /** Hoy en ISO (YYYY-MM-DD). Si falta, las fechas se asumen pasadas (estricto). */
  hoyISO?: string | null;
}

/** ¿La fecha ya pasó? Sin hoyISO asumimos que sí (comportamiento estricto). */
const yaPaso = (fecha: string | null | undefined, hoyISO: string | null | undefined) =>
  !!fecha && (!hoyISO || fecha.slice(0, 10) < hoyISO);

/** Nivel de la cadena canónica que exige cada etapa destino. */
const NIVEL: Record<string, number> = {
  // 1 = R1 agendada · 2 = R1 completa · 3 = R2 agendada · 4 = R2 completa · 5 = venta
  agenda: 1,
  agendaj2: 3,
  facturando: 4,
  ganado: 5,
};

/**
 * Pasos FALTANTES (en orden de wizard) para poder mover un lead a `stageKey`.
 * Acumulativo: cada nivel arrastra los requisitos de los anteriores.
 */
export function stepsForStage(stageKey: string, v: StageReqValues): Step[] {
  const steps: Step[] = [];

  // Salidas: solo motivo. Manual: solo setter (el flujo del Kanban pide motivo+deadline aparte).
  if (stageKey === 'perdido' || stageKey === 'descal') {
    if (!v.motivo?.trim()) steps.push({ id: 'motivo', label: 'Motivo' });
    return steps;
  }
  if (stageKey === 'manual') {
    if (!v.setter?.trim()) steps.push({ id: 'setter', label: 'Setter' });
    return steps;
  }

  const nivel = NIVEL[stageKey] ?? 0;
  if (nivel === 0) return steps; // lead / nutriciones: sin requisitos

  // ── Nivel 1: R1 agendada ──
  if (!v.fechaJ1?.trim()) steps.push({ id: 'fechaJ1', label: 'Fecha de la Reunión 1' });

  // ── Nivel 2: R1 completa (la fecha ya pasó, o la etapa destino implica que ocurrió) ──
  const r1DebeEstarCompleta = nivel >= 3 || (nivel >= 1 && yaPaso(v.fechaJ1, v.hoyISO));
  if (r1DebeEstarCompleta) {
    if (v.asistioJ1 == null) steps.push({ id: 'asistenciaR1', label: 'Asistencia a la Reunión 1' });
    // Calificado: crucial para Meta CAPI. Solo aplica si asistió (o está por marcarse).
    if (v.asistioJ1 !== false && v.calificado == null) steps.push({ id: 'calificado', label: '¿Era lead calificado?' });
    if (v.asistioJ1 !== false && !v.hasFathomUrl) steps.push({ id: 'fathomR1', label: 'Link de Fathom (R1)' });
  }

  // ── Nivel 3: R2 agendada ──
  if (nivel >= 3 && !v.fechaJ2?.trim()) steps.push({ id: 'fechaJ2', label: 'Fecha de la Reunión 2' });

  // ── Nivel 4: R2 completa ──
  const r2DebeEstarCompleta = nivel >= 4 || (nivel >= 3 && yaPaso(v.fechaJ2, v.hoyISO));
  if (r2DebeEstarCompleta && v.fechaJ2) {
    if (v.asistioJ2 == null) steps.push({ id: 'asistenciaR2', label: 'Asistencia a la Reunión 2' });
    if (v.asistioJ2 !== false && !v.hasFathomUrl) {
      // El set de links es único; si ya se pidió por R1 no se duplica el paso.
      if (!steps.some((s) => s.id === 'fathomR1')) steps.push({ id: 'fathomR2', label: 'Link de Fathom (R2)' });
    }
  }

  // ── Nivel 5: venta ──
  if (nivel >= 5) {
    if (!(Number(v.monto) > 0)) steps.push({ id: 'monto', label: 'Monto de cierre' });
    if (v.tienePlan === false) steps.push({ id: 'plan', label: 'Plan de pagos' });
  }

  return steps;
}

/** Compat: lista de etiquetas faltantes ([] = se puede mover). */
export function missingForStage(stageKey: string, v: StageReqValues): string[] {
  return stepsForStage(stageKey, v).map((s) => s.label);
}
