// =============================================================================
// reunion-grabada — los datos de la reunión que terminó y quedó grabada (puro, con test)
// =============================================================================
// El aviso de Fathom («Reunión ocurrió / grabación lista», `reunion-ocurrio-fathom`) pasa a ser una automatización de la
// plataforma (15/10/2026, el evento `reunion_grabada`, docs/diseno-avisos-plataforma.md). Lo emite el webhook de Fathom
// (app/api/webhooks/fathom/route.ts) con estos datos; aparte de lib/lead-resumen.ts porque aquél es `server-only`.

/**
 * LOS DATOS DE LA REUNIÓN QUE TERMINÓ, por nombre (15/10/2026: el aviso de Fathom pasa a ser una automatización de la
 * plataforma, `reunion_grabada`): «{{grabacion_reunion}}» y «{{grabacion_duracion}}» (lib/variables-aviso.ts). Sin
 * duración, la clave FALTA (un dato vacío es un valor para `textoConDatos` y su renglón quedaría con el emoji solo).
 */
export function datosPostLlamada(input: { reunion: 'R1' | 'R2'; duracionMin: number | null }): { grabacion_reunion: string; grabacion_duracion?: string } {
  return { grabacion_reunion: input.reunion, ...(input.duracionMin ? { grabacion_duracion: `${input.duracionMin} min` } : {}) };
}
