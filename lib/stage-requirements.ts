// =============================================================================
// stage-requirements — requisitos de datos por etapa (fuente única)
// =============================================================================
// Qué datos exige cada etapa para poder mover un lead ahí. Fuente única para el
// Kanban, la ficha de edición y el backstop del server, para que las invariantes
// dejen de vivir duplicadas (y divergentes) en cada superficie.
//
// Regla "posible vs imposible": solo se exigen datos que el humano PUEDE
// conseguir. La fecha de una reunión siempre se puede buscar (Calendly/Google
// Calendar); el link de Fathom solo existe si la reunión YA ocurrió, así que
// para reuniones futuras no se exige.
//
// Opera sobre valores YA RESUELTOS (no sobre el shape de UI), para poder validar
// también server-side. Devuelve la lista de datos faltantes ([] = se puede mover).

export interface StageReqValues {
  fechaJ1?: string | null;
  fechaJ2?: string | null;
  hasFathomUrl?: boolean;
  monto?: number | null;
  motivo?: string | null;
  setter?: string | null;
  /** Hoy en ISO (YYYY-MM-DD). Si falta, el Fathom se exige como antes (estricto). */
  hoyISO?: string | null;
}

/** ¿La fecha ya pasó? Sin hoyISO asumimos que sí (comportamiento estricto). */
const yaPaso = (fecha: string | null | undefined, hoyISO: string | null | undefined) =>
  !!fecha && (!hoyISO || fecha.slice(0, 10) < hoyISO);

export function missingForStage(stageKey: string, v: StageReqValues): string[] {
  const m: string[] = [];
  switch (stageKey) {
    case 'agenda':
      if (!v.fechaJ1?.trim()) m.push('Fecha de la Reunión 1');
      else if (yaPaso(v.fechaJ1, v.hoyISO) && !v.hasFathomUrl) m.push('Link de Fathom');
      break;
    case 'agendaj2':
    case 'facturando':
      if (!v.fechaJ2?.trim()) m.push('Fecha de la Reunión 2');
      else if (yaPaso(v.fechaJ2, v.hoyISO) && !v.hasFathomUrl) m.push('Link de Fathom');
      break;
    case 'ganado':
      if (!(Number(v.monto) > 0)) m.push('Monto de cierre');
      break;
    case 'perdido':
    case 'descal':
      if (!v.motivo?.trim()) m.push('Motivo');
      break;
    case 'manual':
      if (!v.setter?.trim()) m.push('Setter');
      break;
    // noshow / nutri / nopaga / postagenda: no exigen datos para mover.
  }
  return m;
}
