// =============================================================================
// aviso-quitar-etapa — lo que se le dice a quien quita una etapa (o una nutrición) que tiene leads
// =============================================================================
// Módulo PURO (lo usan el «···» de la columna del tablero, app/crm/CrmBoard.tsx, y el pop-up de etapas,
// app/crm/EtapasModal.tsx; lo ejecuta tests/crm-aviso-quitar-etapa.test.ts).
//
// ⚠️ HASTA EL 17/10/2026 LAS DOS PUERTAS DECÍAN COSAS DISTINTAS, Y NINGUNA ERA LO QUE PASA. El tablero: «pasan a la
// primera etapa del funnel»; el pop-up: «quedan fuera del funnel hasta que los muevas». Lo que pasa (medido en el
// código, docs/relevo/crm.md §0-α): el lead no se toca; el tablero lo dibuja en la etapa que le dan SUS DATOS
// (`etapaVigenteDe` / `mapToCrmLead`: la reunión agendada, la asistencia, el pago, el desenlace) y, si ésa tampoco
// está en este CRM, en la primera columna; y la tarjeta sigue diciendo en qué etapa estaba (`stageFuera`). Un agregado
// (otro CRM por `lead_funnel`) va a la etapa de entrada. Una frase para las dos, así no se vuelven a separar.
// =============================================================================

/** El cuerpo de la confirmación. `n` = cuántos leads tiene; `null` = no se pudo contar. */
export function avisoAlQuitarEtapa(n: number | null, opts?: { nutricion?: boolean }): string {
  const quienes = n == null
    ? 'No se pudo contar cuántos leads tiene. Los que estén ahí no se borran'
    : n === 1 ? 'Su lead no se borra' : `Sus ${n} leads no se borran`;
  const adonde = `: ${n === 1 ? 'pasa' : 'pasan'} a la etapa que ${n === 1 ? 'le dan sus' : 'les dan sus'} datos (agenda, asistencia, pago) o, si no está en este CRM, a la primera, y la tarjeta dice dónde ${n === 1 ? 'estaba' : 'estaban'}.`;
  const nutri = opts?.nutricion ? '' : ' La nutrición que salía de esta etapa también se va.';
  return `${quienes}${adonde}${nutri}`;
}
