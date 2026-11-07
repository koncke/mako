// =============================================================================
// Los CUPOS del historial del Video Generator: un avatar no empuja a un anuncio
// =============================================================================
// SIN `server-only` y sin React, para que tenga test (tests/video-historial-cupos.test.ts).
// Lo mismo que hace `app/video-generator/escenario-reuso.ts`: la regla que decide
// qué DESAPARECE del historial no puede vivir sin un test que la ejecute.
//
// ── El síntoma (item 558, 6/11/2026) ────────────────────────────────────────
// El historial del Video Generator guarda 10 entradas. Cada video de «AI Avatar»
// entra ahí como un plan más —las dos acciones de avatar llaman a
// `guardarEnHistorial` (app/ai-avatar/actions.ts, app/video-editor/avatar/actions.ts)—
// así que hacer avatares empujaba anuncios afuera. Y con el anuncio se va el único
// puntero a sus clips, que están PAGADOS: los .mp4 quedan en el bucket colgados de
// un `planId` que sólo vivía en esa fila de `app_settings`.
//
// Es el mismo daño que ya tenía cosechado el tope (docs/hallazgos-generativa.md →
// «El tope de 10 del historial evicta un anuncio terminado sin avisar»), con una
// diferencia que lo empeora: el que empuja no es otro anuncio del cliente, es una
// herramienta distinta usando la misma lista.
//
// ── La cura: UN CUPO POR TIPO, no un tope compartido ────────────────────────
// Un avatar y un anuncio no compiten por el mismo lugar. Cada tipo tiene su cupo
// y se recorta DENTRO de él, así que ninguna cantidad de avatares puede tirar un
// anuncio (y al revés tampoco).
//
// ⚠️ Y los LOOKS de AI Avatar siguen viviendo en otra clave
// (`ai-avatar.looks`, app/ai-avatar/looks.ts): un look no es un plan.

/**
 * Qué clase de cosa es una entrada del historial.
 *
 * ⚠️ `'anuncio'` es el DEFAULT y nunca se escribe. Es lo que hace que el cambio
 * sea invisible para lo ya guardado: toda entrada anterior —y toda la que escriba
 * el Video Generator— no tiene el campo y se lee como anuncio, que es exactamente
 * dónde estaba antes de esto. Lo único que se marca es el avatar, y lo marca un
 * solo lugar (`conAvatar`, app/video-editor/avatar/avatares.ts).
 */
export type TipoPlan = 'anuncio' | 'avatar';

/**
 * El cupo de cada tipo. Son DOS números, no uno partido en dos.
 *
 * `anuncio: 10` es el tope histórico, tal cual: bajarlo tiraría historial de
 * alguien el día del despliegue, y eso no se hace.
 *
 * `avatar: 10` es el mismo número a propósito. Un clip de avatar cuesta los
 * mismos créditos que un clip de anuncio —lo filma el mismo motor— así que no hay
 * razón para darle menos pista antes de huerfanar su .mp4. El costo del cupo
 * nuevo es texto en `app_settings` y una consulta de montaje por entrada en
 * `app/m/video/datos.ts`: el techo pasa de 10 a 20 entradas.
 */
export const CUPOS: Record<TipoPlan, number> = { anuncio: 10, avatar: 10 };

const TIPOS: readonly TipoPlan[] = ['anuncio', 'avatar'];

/** Lo mínimo que necesita el recorte. `PlanGuardado` encaja; un fixture de test también. */
export type EntradaDelHistorial = {
  id: string;
  tipo?: TipoPlan;
  video?: Record<string, { url?: string } | undefined>;
};

/**
 * El tipo de una entrada, DEFENSIVO.
 *
 * Lo que entra acá salió de un `JSON.parse` de `app_settings` y de un `esEntrada`
 * que mira `id`, `at` y `plan` y nada más: el `tipo` llega sin validar. Cualquier
 * cosa que no sea exactamente `'avatar'` se lee como anuncio — el default es el
 * conservador, porque un anuncio mal leído como avatar se mudaría al cupo de los
 * avatares, donde una tanda de avatares nuevos lo evicta. Al revés no pasa nada:
 * se queda donde ya estaba.
 */
export function tipoDePlan(e: { tipo?: unknown }): TipoPlan {
  return e.tipo === 'avatar' ? 'avatar' : 'anuncio';
}

/**
 * Cuántos clips PAGADOS tiene una entrada. Es lo que decide si se puede tirar.
 *
 * No es «cuántas tomas» ni «está terminado»: es cuántos costaron créditos. Un
 * anuncio a medio filmar con tres clips vale tanto como uno completo a la hora de
 * decidir si desaparece.
 */
export function clipsPagados(e: EntradaDelHistorial): number {
  return Object.values(e.video ?? {}).filter((v) => v?.url).length;
}

/**
 * Los que sobreviven al cupo de SU tipo, **en el mismo orden en que entraron**.
 *
 * Dentro de cada cupo valen las dos reglas que ya tenía el tope compartido:
 *
 *   1. ⚠️ SE SACA PRIMERO LO QUE NO SE PAGÓ. El tope recortaba por fecha a secas
 *      y evictaba anuncios TERMINADOS: sus siete clips quedaban en el bucket sin
 *      nadie que supiera que existen. Un anuncio sin un solo clip filmado no le
 *      cuesta nada a nadie perderlo: el guion se vuelve a escribir.
 *   2. ⚠️ EL `protegido` NUNCA SE CAE, tenga clips o no. Es el que se está
 *      guardando: recortar el anuncio en el que la persona está trabajando sería
 *      el peor momento posible. En la LECTURA no hay protegido, y está bien: nadie
 *      está trabajando sobre nada.
 *
 * ⚠️ Y SE RE-EMITE EN EL ORDEN DE ENTRADA, que es lo que antes NO pasaba. El
 * recorte viejo devolvía `[nuevo, ...pagados, ...sin pagar]`: cruzar el tope una
 * vez reordenaba el historial GUARDADO y lo dejaba así, con los pagados flotando
 * arriba. Y la lista se lee como «el último tocado primero» —lo dice
 * `app/m/video/datos.ts`— y se recorre de nuevo a viejo (`avataresDelHistorial`).
 * Acá la prioridad decide sólo QUIÉN se queda; el orden lo sigue decidiendo quien
 * llamó.
 */
export function recortarPorCupo<T extends EntradaDelHistorial>(
  entradas: readonly T[],
  opciones: { protegido?: string } = {},
): T[] {
  const sobreviven = new Set<T>();
  for (const tipo of TIPOS) {
    const cupo = CUPOS[tipo];
    const delTipo = entradas.filter((e) => tipoDePlan(e) === tipo);
    if (delTipo.length <= cupo) {
      for (const e of delTipo) sobreviven.add(e);
      continue;
    }
    const protegido = opciones.protegido ? delTipo.filter((e) => e.id === opciones.protegido) : [];
    const resto = delTipo.filter((e) => !protegido.includes(e));
    const prioridad = [
      ...protegido,
      ...resto.filter((e) => clipsPagados(e) > 0),
      ...resto.filter((e) => clipsPagados(e) === 0),
    ].slice(0, cupo);
    for (const e of prioridad) sobreviven.add(e);
  }
  return entradas.filter((e) => sobreviven.has(e));
}

/**
 * Las que se van a caer, para poder REGISTRARLAS.
 *
 * Un recorte silencioso se lee después como «no había nada», que es justo lo que
 * no se puede saber. Separado del recorte porque son dos preguntas: quién se queda
 * (lo de arriba) y qué hay que contar de los que no (quien escribe).
 */
export function tirados<T extends EntradaDelHistorial>(antes: readonly T[], despues: readonly T[]): T[] {
  const quedan = new Set(despues.map((e) => e.id));
  return antes.filter((e) => !quedan.has(e.id));
}
