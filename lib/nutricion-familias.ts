// =============================================================================
// Familias de cohortes: triggers que se REPARTEN un mismo universo de leads
// =============================================================================
// Una familia son dos o más triggers que parten el MISMO cohorte en mitades que
// tienen que ser excluyentes. Es distinto de dos cohortes cualesquiera: acá el
// riesgo no es que sobre gente, es que el mismo lead entre por las dos puertas
// y reciba dos mensajes que se contradicen.
//
// ⚠️ VIVE EN UN MÓDULO PROPIO, SIN NINGÚN IMPORT, A PROPÓSITO. Estaba en
// `lib/nutricion.ts`, que arrastra `lib/workspace.ts` y con eso todo el runtime
// de Next: ningún test lo puede importar. Y esto gobierna cuántos mensajes
// recibe una persona real, o sea que es justo lo que no puede quedarse sin red.
// Es el mismo criterio que `exigirClienteDePrueba` y que `lib/model-catalogo.ts`.

/** Agendó DESPUÉS de recibir tu bienvenida: ya te escuchó. Se retoma la charla. */
export const TRIGGER_AGENDA_CONOCIDO = 'agendado_ya_contactado';
/** Agendó sin haber recibido nada tuyo: este es el primer mensaje. Te presentás. */
export const TRIGGER_AGENDA_NUEVO = 'agendado_primer_contacto';

/**
 * Las dos mitades de la post-agenda.
 *
 * La condición que las separa —«¿ya le hablamos?»— NO es estable: mandarle el
 * audio a un lead de «primer contacto» lo convierte en «ya contactado». Por eso
 * la exclusión no puede ser «cada uno filtra su mitad»: quien está inscripto en
 * CUALQUIERA de las dos queda fuera de las dos, y la decisión se toma una sola
 * vez, al entrar.
 */
export const FAMILIA_POST_AGENDA: readonly string[] = [TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO];

/** A qué mitad de la post-agenda le toca un lead. Puro, y por eso testeable. */
export function mitadPostAgenda(yaLeHablamos: boolean): string {
  return yaLeHablamos ? TRIGGER_AGENDA_CONOCIDO : TRIGGER_AGENDA_NUEVO;
}

/**
 * De las secuencias que un evento dispara, las que le corresponden a ESTE lead.
 *
 * Existe porque el enrolamiento por evento no pasa por `leadsDeCohorte`: agarra
 * el lead y lo mete en TODAS las secuencias del evento. Sin este filtro, el que
 * agenda entra a las dos mitades de la post-agenda y recibe los dos audios de
 * apertura — uno presentándose y el otro retomando una charla, con minutos de
 * diferencia y desde el mismo número.
 *
 * ⚠️ ESTÁ ACÁ, PURA, Y NO INLINE EN `enrolarPorEvento`, PORQUE ALLÁ NO SE PUEDE
 * PROBAR. La primera versión de su test era un `assert.match` sobre el fuente
 * de la función, y al romper el filtro a propósito el test **siguió pasando**:
 * la cadena que buscaba aparecía en la línea de al lado. Un test que no falla
 * cuando rompés lo que persigue no mide nada — y éste protege cuántos mensajes
 * recibe una persona real.
 *
 * Lo que NO decide: si el lead ya está inscripto. Eso lo sabe la base y lo
 * resuelve el llamador; acá solo vive la regla.
 */
export function secuenciasParaElLead<T extends { trigger_tipo: string }>(secuencias: T[], yaLeHablamos: boolean): T[] {
  const deLaFamilia = secuencias.filter((s) => FAMILIA_POST_AGENDA.includes(s.trigger_tipo));
  // Con una sola de las dos configurada no hay ambigüedad que resolver, y
  // filtrar sería peor: al lead le tocaría no recibir nada porque justo la
  // mitad que le corresponde no existe todavía.
  if (deLaFamilia.length < 2) return secuencias;
  const quiero = mitadPostAgenda(yaLeHablamos);
  return secuencias.filter((s) => !FAMILIA_POST_AGENDA.includes(s.trigger_tipo) || s.trigger_tipo === quiero);
}
