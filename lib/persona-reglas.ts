// =============================================================================
// persona-reglas — lo que exige «La cara de tu marca», sin server-only
// =============================================================================
// Lo leen la pantalla (app/onboarding/PersonaView.tsx, 'use client') y la API de MaKo (lib/onboarding-hechos.ts, al
// marcar cg_persona). Con dos números, la API cerraría el paso con menos fotos de las que la pantalla exige. Vive
// aparte y no en lib/persona.ts (que lleva server-only) para que el navegador lo pueda importar sin el resto.

/** Cuántas fotos de la persona pide el paso «La cara de tu marca» (cg_persona) antes de describirla. */
export const MIN_FOTOS_PERSONA = 5;
